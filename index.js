// Setup basic express server
var config = require('./config');
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var FB = require('fb');

if(!config.facebook.appId || !config.facebook.appSecret) {
    throw new Error('facebook appId and appSecret required in config.js');
}

server.listen(config.port, function () {
  console.log('Server listening at port %d', config.port);
});

// Routing
app.use(express.static(__dirname + '/public'));



io.on('connection', function (socket) {
  	
  console.log("somebody is here");


  
});
