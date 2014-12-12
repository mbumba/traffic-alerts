/* TRAFFIC ALERTS NODEJS SERVER 
 * Martin Bumba and Sara Fatih
 * 2014
 * */

/* LOADING LIBS */
//load our server configuration
var config = require('./config');
//load our helper functions
var functions = require('./functions');
//load ImageType library for checking image files
var imageType = require('image-type');
//load validator for user inputs
var validator = require('validator');
//load FileSystem library for working with files
var fs = require('fs');
//load CronJob library fro periodic tasks
var CronJob = require('cron').CronJob;
//load MySQL database library
var mysql = require('mysql');
//create MySQL pool connection for threaded MySQL queries
var mysqlPool = mysql.createPool({
    connectionLimit: 10,
    host: config.mysql.host,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.databaseName
});
//load FACEBOOK library and check if exists main config parameters
var FB = require('fb');
if (!config.facebook.appId || !config.facebook.appSecret) {
    functions.error("Facebook appId and appSecret required in config.js");
}

/* MAIN HTTP SERVER */
//load and initialize express
var express = require('express');
var app = express();
//create server
var server = require('http').createServer(app);

//STATIC ROUTING TO FOLDER WITH CLIENT PART, IF YOU DON'T WANT USE CLIENT PART COMMENT FOLLOWING LINE
app.use(express.static(__dirname + '/public'));


//initialize web server and listening on port
server.listen(config.port, function() {
    functions.log('Web server is listening at port: ' + config.port);
});

/* Web sockets */
//load Socket.IO library
var io = require('socket.io')(server);

//listen on socket for new connection
io.on('connection', function(socket) {
    //local variables for connection
    var facebookAppId = null;
    var facebookUserId = null;
    var messagePrefix = socket.request.connection.remoteAddress + ' :: ';
    
    
    functions.log(messagePrefix + 'is connected to server');
    
    /*  Alerts which are emitted to client are represented like (object) with following specification
        (object) alert                           
     *  alert.id                 - id of alert
     *  alert.facebook_app_id    - id of FB application in which, alert was published, thanks by this you can differentiate if alert is from your Facebook APP
     *  alert.lat                - latitude
     *  alert.lng                - longtitude
     *  alert.icon               - icon type [1, 2, 3, 4]
     *  alert.path               - relative path of alert image, if you want to show image in your site only join the server host part before image path
     *  alert.note               - note
     *  alert.owner              - (bool) true if this userand this Facebook APP is owner, false in another case
     *  alert.published          - MySQL DATETIME FORMAT yyyy-MM-dd'T'HH:mm:ssZ, when alert was published
     *  alert.expire_on          - MySQL DATETIME FORMAT yyyy-MM-dd'T'HH:mm:ssZ, when alert will expire
     **/
  
    
    
    /* API 
     * ON MESSAGE 'log-me' - login client by valid Facebook token to server side
     * Params: 
     *  facebookUserToken - valid facebook user token for some FB application
     *  callback(result, error) - function which will be called in client side
     *    result - true or null
     *    error - message or null
     *    
     */
    socket.on('log-me', function(facebookUserToken, callback) {
        //strictly check callback function
        if (typeof (callback) !== 'function')
            return;
        //sanitize FB user access token
        facebookUserToken = validator.escape(validator.toString(facebookUserToken));
        //check FB user token and get id and name if is valid
        FB.api('me', {fields: ['id', 'name'], access_token: facebookUserToken}, function(user) {
            if (!user || user.error) {
                callback(null, 'Facebook auth. token error, token is not valid!');
                functions.log(messagePrefix + 'FB token error, token is not valid!');
                return;
            }
            //FB user token is valid, now get the facebook application id to differentiate 
            FB.api('app', {fields: ['id', 'name'], access_token: facebookUserToken}, function(app) {
                if (!app || app.error) {
                    callback(null, 'Facebook auth. token error - cannot get FB app ID!');
                    functions.log(messagePrefix + 'FB token error - cannot get FB app ID');
                    return;
                }
                /*
                If token is sucesfully checked set the FB user id and FB app id into prepared variables */
                facebookUserId = user.id;
                facebookAppId = app.id;
                
                //print log message
                functions.log(messagePrefix + 'has been authenticated as [FB app id: ' +facebookAppId + ', FB user id:' + facebookUserId + ', full name: ' + user.name + ']');
                
                //join this socket connection to the room for token checked clients
                socket.join('token-checked');

                //change message preffix
                messagePrefix = messagePrefix + facebookAppId  + ' - ' + facebookUserId + ' >> ';

                //call callback with true (user is sucesfully authenticated to server)
                callback(true);
            });
            

        });
    });
    
    /* API 
     * ON MESSAGE 'get-list' (get list of alerts)
     * Params: 
     *  callback(result, error) - function which will be called in client side
     *    result - array of (object) alert or null
     *    error - null or (string) message
     */
    socket.on('get-list', function(callback) {
        //check if user is authenticated to server
        if (facebookUserId) {
            //strictly check callback function
            if (typeof (callback) !== 'function')
                return;
            //if token is sucesfully checked join this socket to the room
            socket.join('token-checked');
            mysqlPool.query('SELECT `id`, `facebook_app_id`, `lat`, `lng`, `path`, `icon`, `note`, IF((`facebook_app_id` = ? AND `facebook_user_id` = ?), 1, 0) AS `owner`, `published`, `expire_on` FROM `alerts`', [facebookAppId, facebookUserId], function(err, rows) {
                if (err === null) {
                    callback(rows);
                }
                else
                    callback(null, 'Error in getting rows from database! Please, try it later..');
            });
        }
        else
            callback(null, 'You are not correctly logged into server. Please at first call message log-in with FB token!');

    });

    /* API 
     * ON MESSAGE 'publish-alert' - publish new alert
     * Params: 
     *  image - (string) Base64 encoded JPEG image data
     *  lat - (float) latitude 
     *  lng - (float) longtitude 
     *  icon - (int between 1-4) image type
     *  note - (string) text for note
     *  expires - (Date) expires date
     *  callback(result, error) - function which will be called in client side
     *    result - (object) alert or null
     *    error - null or (string) message
     */
    socket.on('publish-alert', function(image, lat, lng, icon, note, expires, callback) {       
        //check if user is authenticated to server
        if (facebookUserId) {
            //strictly check callback function
            if (typeof (callback) !== 'function')
                return;
            //check lat and lng
            if (!(validator.isFloat(lat) && validator.isFloat(lng))) {
                callback(null, 'Lat or lng have no valid value (float expected).');
                functions.log(messagePrefix + ' bad arguments lat, lng'); // + (!res ? 'error occurred' : res.error)
                return;
            }

            //check note
            if (!(note !== null && note.length >= 4)) {
                callback(null, 'Note has no valid value (min 4 characters expected).');
                functions.log(messagePrefix + ' bad argument note'); // + (!res ? 'error occurred' : res.error)
                return;
            }
            //sanitize note
            note = validator.escape(note);

            //check icon
            if (!validator.isIn(icon, config.allowedIcons)) {
                callback(null, 'Icon has no valid value.');
                functions.log(messagePrefix + " bad argument icon"); // + (!res ? 'error occurred' : res.error)
                return;
            }

            //check if image is not null or false
            if(!image) {
                callback(null, 'Image in alert is not valid!');
                functions.log(messagePrefix + " bad argument image");
                return;  
            }            
            //parse image
            var imageBuffer = functions.decodeBase64Image(image);

            //check image
            if (!(imageBuffer !== null && imageType(imageBuffer.data) === 'jpg')) {
                callback(null, 'Image in alert is not valid!');
                functions.log(messagePrefix + " bad argument image");
                return;
            }
            
            //validate expires datetime
            var expire_on = validator.toDate(expires);
            if (!expire_on) {
                callback(null, 'Date is not valid!');
                functions.log(messagePrefix + " wrong date");
                return;
            }
            if (!validator.isAfter(expire_on, new Date((new Date()).getTime() + (5 * 60 * 1000)))) {
                callback(null, 'Date must be more in future!');
                functions.log(messagePrefix + " date is not enough in future");
                return;
            }

            //if everything is ok
            mysqlPool.query('INSERT INTO `alerts` SET ?, `published` = NOW() ', {facebook_app_id: facebookAppId, facebook_user_id: facebookUserId, lat: lat, lng: lng, icon: icon, note: note, expire_on: expire_on}, function(err, result) {
                //db error?
                if (err) {
                    callback(null, 'Error in saving alert to database. Please try to insert new alert later..');
                    functions.log(messagePrefix + " insert db error: " + err);
                    return;
                }

                //set path to image
                var path = config.imagesPath + result.insertId + '.jpg';

                //writes the file
                fs.writeFile('public/' + path, imageBuffer.data, function(err) {
                    //error writing file ?
                    if (err) {
                        callback(null, 'Error in saving alert to database. Please try to insert new alert later..');
                        functions.log(messagePrefix + ' writing image error for path=' + path); // + (!res ? 'error occurred' : res.error)
                        return;
                    }

                    //update row and set path
                    mysqlPool.query("UPDATE `alerts` SET `path` = ? WHERE `id` = ?", [path, result.insertId], function(err) {
                        //error with updating row ?
                        if (err) {
                            callback(null, 'Error in saving alert to database. Please try to insert new alert later..');
                            functions.log(messagePrefix + ' error updating path for id=' + result.insertId);
                            return;
                        }

                        functions.log(messagePrefix + 'Alert with id=' + result.insertId + ' is sucesfully saved');

                        //notify clients
                        mysqlPool.query('SELECT `id`, `facebook_app_id`, `lat`, `lng`, `icon`, `path`, `note`, `published`, `expire_on` FROM `alerts` WHERE `id` = ?', result.insertId, function(err, rows) {
                            if (err === null) {
                                var row = rows[0];
                                //notify sender
                                row.owner = 1;   
                                callback(row);                                
                                
                                //notify other connected and token checked clients
                                row.owner = 0;
                                
                                /* API 
                                 * EMIT MESSAGE 'new-alert' - new alert published - notify clients
                                 * Params: 
                                 *  row - (object) alert
                                 */
                                socket.broadcast.to('token-checked').emit('new-alert', row);
                            }
                        });
                    });
                });
            });
        }
        else
            callback(null, 'You are not correctly logged into server. Please at first call message log-in with FB token!');
    });
   
    /* API 
     * ON MESSAGE 'remove-alert' - remove alert by owner
     * Params: 
     *  id - (int) id of alert
     *  callback(result, error) - function which will be called in client side
     *    result - id of removed alert
     *    error - null or (string) message
     */
    socket.on('remove-alert', function(id, callback) {  
        //check if user is authenticated to server
        if (facebookUserId) {
            //strictly check callback function
            if (typeof (callback) !== 'function')
            return;
            //check if parameter id is valid number
            if (!(validator.isInt(id))) {
                callback(null, 'Bad argument ID.');
                functions.log(messagePrefix + ' bad argument id'); // + (!res ? 'error occurred' : res.error)
                return;
            }
            mysqlPool.query('SELECT `id`, `path` FROM `alerts` WHERE `id` = ? AND `facebook_app_id` = ? AND `facebook_user_id` = ? ', [id, facebookAppId, facebookUserId], function(err, rows) {
                if (err === null && rows.length === 1) {
                    //remove file
                    fs.unlink('public/' + rows[0].path, function(err) {
                        if (err) {
                            callback(null, 'Error in deleting alert. Please, try it later..');
                            functions.log(messagePrefix + " delete file error: " + err);

                            return;
                        }
                        //remove from DB
                        mysqlPool.query('DELETE FROM `alerts` WHERE `id` = ?', [id], function(err, result) {
                            //db error?
                            if (err) {
                                callback(null, 'Error in deleting alert. Please, try it later..');
                                functions.log(messagePrefix + " delete from db error: " + err);
                                return;
                            }
                            functions.log(messagePrefix + 'Alert with id=' + id + ' has been removed.');
                            //notify owner
                            callback(id);
                            //notify other connected and token checked clients except owner
                            
                            /* API 
                             * EMIT MESSAGE 'removed-alert' - alert removed, notify clients
                             * Params: 
                             *  id - id of removed alert
                             */
                            socket.broadcast.to('token-checked').emit('removed-alert', id);
                        });
                    });
                }
                else {
                    functions.log(messagePrefix + 'no permissions for remove alert with id=' + id);
                    callback(null, 'Alert cannot been removed. You are probably not logged into application in which alert was published or this alert is not yours!');
                    return;
                }
            });
        }
        else {
            functions.log(messagePrefix + 'Alert with id=' + id + ' has been removed.');
            callback(null, 'You are not correctly logged into server. Please at first call message log-in with FB token!');
        }

    });
    
    /* API 
     * ON DISCONNECT - on disconnected client 
     */
    socket.on('disconnect', function() {
        socket.leave(socket.room);
        facebookUserId = null;
        facebookAppId = null;
        functions.log(messagePrefix + 'has been disconnected');
        messagePrefix = null;
    });


});


//setup CronJob for expirated alerts (check every minute each minute)
new CronJob('00 * * * * *', function() {
    mysqlPool.query('SELECT `id`, `path`, `expire_on` FROM `alerts` WHERE `expire_on` <= NOW()', function(err, rows) {
        if (err) {
            functions.log("CRON: MySQL error - " + err);
            return;
        }
        //for each row
        rows.forEach(function(row) {

            //remove image
            fs.unlink('public/' + row.path, function(err) {
                if (err) {
                    functions.log("CRON: delete file error: " + err);
                    return;
                }
                //remove from DB
                mysqlPool.query('DELETE FROM `alerts` WHERE `id` = ?', [row.id], function(err, result) {
                    //db error?
                    if (err) {
                        functions.log("CRON: delete from db error: " + err);
                        return;
                    }
                    //sucesfully removed
                    functions.log('CRON: alert with id=' + row.id + ' has been removed, because of expiration date.');
                    //broadcast message to everyone about remove
                    /* API 
                     * EMIT MESSAGE 'removed-alert' - alert removed, notify clients
                     * Params: 
                     *  id - id of removed alert
                     */
                    io.to('token-checked').emit('removed-alert', row.id);
                });
            });

        });

    });
}, null, true);