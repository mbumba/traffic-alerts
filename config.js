
var config = { };

config.port  =      process.env.PORT                    || 8888;

config.facebook = {
    appId:          process.env.FACEBOOK_APPID          || '130243393813697',
    appSecret:      process.env.FACEBOOK_APPSECRET      || '...',

};

module.exports = config;

