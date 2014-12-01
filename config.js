/* TRAFFIC ALERTS NODEJS SERVER CONFIGURATION
 * Martin Bumba and Sara Fatih
 * */
var config = { };

config.port         =      process.env.PORT                    || 8888;  //PORT in which application will run
config.imagesPath   =      'uploads/';                                   //Folder for uploaded images
config.allowedIcons =      [1, 2, 3, 4];                                 //Allowed icon types

config.facebook     = {
    appId:                 process.env.FACEBOOK_APPID          || '000000',  //SET FACEBOOK APPID
    appSecret:             process.env.FACEBOOK_APPSECRET      || '000000',  //SET FACEBOOK APPSECRET
};
config.mysql = {            //SETE MYSQL CREDENTIALS HERE
    host: 'localhost',
    user: '',
    password: '',
    databaseName: 'traffic_alerts'
};


module.exports = config;

