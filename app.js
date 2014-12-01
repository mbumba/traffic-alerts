/* TRAFFIC ALERTS NODEJS SERVER 
 * Martin Bumba and Sara Fatih
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
// Static routing to public folder
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
    var facebookId = null;
    var messagePrefix = socket.request.connection.remoteAddress + ' :: ';
    
    
    functions.log(messagePrefix + 'is connected to server');
    
    
    /* API 
     * ON MESSAGE 'log-me' - login client by valid Facebook token
     * Params: 
     *  facebookToken - valid facebook token for this application
     *  callback(result, error) - function which will be called in client side
     */
    socket.on('log-me', function(facebookToken, callback) {
        if (typeof (callback) !== 'function')
            return;
        FB.api('me', {fields: ['id', 'name'], access_token: facebookToken}, function(res) {
            if (!res || res.error) {
                callback(null, 'Facebook auth. token error!');
                functions.log(messagePrefix + 'FB token error');
                return;
            }
            //if token is sucesfully checked            
            //set the facebook ID in variable
            facebookId = res.id;
            functions.log(messagePrefix + 'has been logged in [Facebook id:' + facebookId + ', full name: ' + res.name + ']');
            //join this socket to the room fro token checked
            socket.join('token-checked');

            //change message preffix
            messagePrefix = messagePrefix + facebookId + ' >> ';

            //call callback
            if (callback !== null)
                callback(true);

        });
    });
    
    /* API 
     * ON MESSAGE 'get-list' (get list of alerts)
     * Params: 
     *  callback(result, error) - function which will be called in client side
     */
    socket.on('get-list', function(callback) {
        if (typeof (callback) !== 'function')
            return;
        if (facebookId) {
            //if token is sucesfully checked join this socket to the room
            socket.join('token-checked');
            mysqlPool.query('SELECT `id`, `lat`, `lng`, `path`, `icon`, `note`, IF(`facebook_id` = ?, 1, 0) AS `owner`, `published`, `expire_on` FROM `alerts`', facebookId, function(err, rows) {
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
     */
    socket.on('publish-alert', function(image, lat, lng, icon, note, expires, callback) {
        if (typeof (callback) !== 'function')
            return;
        if (facebookId) {

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

            //get buffer from image
            var imageBuffer = functions.decodeBase64Image(image);

            //check image
            if (imageBuffer !== null && imageType(imageBuffer) === 'jpg') {
                callback(null, 'Image in alert is not valid!');
                functions.log(messagePrefix + " bad argument image");
                return;
            }
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
            mysqlPool.query('INSERT INTO `alerts` SET ?, `published` = NOW() ', {facebook_id: facebookId, lat: lat, lng: lng, icon: icon, note: note, expire_on: expire_on}, function(err, result) {
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
                        mysqlPool.query('SELECT `id`, `lat`, `lng`, `icon`, `path`, `note`, `published`, `expire_on` FROM `alerts` WHERE `id` = ?', result.insertId, function(err, rows) {
                            if (err === null) {
                                var row = rows[0];
                                row.owner = 1;
                                
                                //notify sender
                                callback(row);
                                row.owner = 0;

                                //notify other connected and token checked clients
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
     */
    socket.on('remove-alert', function(id, callback) {
        if (typeof (callback) !== 'function')
            return;
        if (facebookId) {
            //check if is valid id
            if (!(validator.isInt(id))) {
                callback(null, 'Bad argument ID.');
                functions.log(messagePrefix + ' bad argument id'); // + (!res ? 'error occurred' : res.error)
                return;
            }
            mysqlPool.query('SELECT `id`, `path` FROM `alerts` WHERE `id` = ? AND `facebook_id` = ?', [id, facebookId], function(err, rows) {
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
                            socket.broadcast.to('token-checked').emit('removed-alert', id);
                        });
                    });
                }
                else {
                    callback(null, 'Alert cannot been removed. This alert is probably not yours!');
                    return;
                }
            });
        }
        else
            callback(null, 'You are not correctly logged into server. Please at first call message log-in with FB token!');

    });
    
    /* API 
     * ON DISCONNECT - on disconnect client 
     */
    socket.on('disconnect', function() {
        socket.leave(socket.room);
        facebookId = null;
        functions.log(messagePrefix + 'has been disconnected');
        messagePrefix = null;
    });


});


//setup CronJob for expirated alerts (do each minute)
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
                    io.to('token-checked').emit('removed-alert', row.id);
                });
            });

        });

    });
}, null, true);