/* TRAFFIC ALERTS NODEJS SERVER CONFIGURATION
 * Martin Bumba and Sara Fatih
 * */
var config = { };

config.port         =      process.env.PORT                    || 8888;
config.imagesPath   =      'uploads/';
config.allowedIcons =      [1, 2, 3, 4];

config.facebook     = {
    appId:                 process.env.FACEBOOK_APPID          || '130243393813697',
    appSecret:             process.env.FACEBOOK_APPSECRET      || 'c82696768ae4ad8b63db874cb64eb558',
};
config.mysql = {
    host: 'localhost',
    user: '',
    password: '',
    databaseName: 'traffic_alerts'
};
module.exports = config;

