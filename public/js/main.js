(function(window) {
    'use strict';

    var app = app || {};

    //socket
    var socket = null;

    //map variables
    var map = null;
    var mapCentered = false;

    //GEO variables
    var geoLat = null;
    var geoLng = null;
    var geoCoder = null;

    var positionMarker = null;
    var alertMarkers = null;

    var myVideo = null;


    //initialize application
    app.init = function() {
        app.fbEnsureInit(app.checkLogin);

        document.getElementById('login-button').addEventListener('click', app.loginViaFacebook);

        //load last GEo from local storage
        if (localStorage.getItem("lat") && localStorage.getItem("lng")) {
            geoLat = localStorage.getItem("lat");
            geoLng = localStorage.getItem("lng");
        }
        navigator.geolocation.watchPosition(app.positionCallback, app.positionError);

    };

    //check if user is logged in
    app.checkLogin = function() {
        FB.getLoginStatus(function(response) {
            if (response.status === 'connected') {
                app.initComponents();
            }
            else {
                document.getElementById('login-overlay').style.display = 'block';
            }
        });
    };

    //login to application via FB
    app.loginViaFacebook = function() {
        FB.login(function(response) {
            if (response.status === 'connected') {
                app.initComponents();
            }
        });
    };

    //ensure that FB plugin is loaded
    app.fbEnsureInit = function(callback) {
        if (!window.fbApiInit) {
            setTimeout(function() {
                app.fbEnsureInit(callback);
            }, 50);
        } else {
            if (callback) {
                callback();
            }
        }
    };
    //initialize componets after sucessful login
    app.initComponents = function() {
        //initialize socket connection
        socket = new io();
        //emit message with facebook access token
        socket.emit('token', FB.getAuthResponse()['accessToken']);

        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('navbar-inner').style.display = 'block';

        //initialize map and GEO components
        geoCoder = new google.maps.Geocoder();
        app.loadMap();


        document.getElementById('wrapper').style.display = 'block';


        //initialize camera
        navigator.myGetMedia = (navigator.getUserMedia ||
                navigator.webkitGetUserMedia ||
                navigator.mozGetUserMedia ||
                navigator.msGetUserMedia);
        navigator.myGetMedia({video: true}, app.cameraCallback, app.cameraError);
        
        //listeners for menu
        document.getElementById('menu-logout').addEventListener('click', app.logout);
        document.getElementById('menu-new-alert').addEventListener('click', app.newAlert);
        //listeners for form elemnts
        document.getElementById('form-take-photo').addEventListener('click', function(e) {
            app.takePhoto(e);
        });
    };

    //event position loaded
    app.positionCallback = function(position) {
        //store position to global variable
        geoLat = position.coords.latitude;
        geoLng = position.coords.longitude;

        //save to local storage
        localStorage.setItem("lat", geoLat);
        localStorage.setItem("lng", geoLng);

   
        if (map !== null) {
            var position = new google.maps.LatLng(geoLat, geoLng);

            //set my position marker in map
            if (positionMarker === null) {
                positionMarker = new google.maps.Marker({
                    position: position,
                    map: map,
                    title: 'My position'
                });
            }
            else {
                 positionMarker.setPosition(position);
            }

            //center the map at first time
            if (!mapCentered) {
                map.setZoom(13);
                map.setCenter(position);
                mapCentered = true;
            }
        }

    };

    //event postition error 
    app.positionError = function(error) {
        console.log(error);
    };

    //event camera connected, set stream to video frame
    app.cameraCallback = function(stream) {
        myVideo = document.getElementById('video-frame');
        myVideo.src = window.URL ? window.URL.createObjectURL(stream) : stream;
        myVideo.play();
    };

    //event camera error event
    app.cameraError = function(error) {
        console.log(error);
    };

    //event click on "New alert"
    app.logout = function() {
        FB.logout(function(response) {
            app.hideComponents();
        });
    };

    //event click on "New alert"
    app.newAlert = function() {

    };

    //event click on "Take a photo"
    app.takePhoto = function(e) {
        e.preventDefault();
        //...
    };

    //load map
    app.loadMap = function() {
        var location = new google.maps.LatLng(geoLat, geoLng);

        var mapOptions = {
            zoom: 12,
            center: new google.maps.LatLng(location),
            mapTypeId: google.maps.MapTypeId.ROADMAP
        };
        map = new google.maps.Map(document.getElementById('map-canvas'),
                mapOptions);
    };
    //refresh map and load new alerts
    app.refreshMap = function() {
        var mapOptions = {
            zoom: 8,
            center: new google.maps.LatLng(-34.397, 150.644),
            mapTypeId: google.maps.MapTypeId.ROADMAP
        };
        map = new google.maps.Map(document.getElementById('map-canvas'),
                mapOptions);
    };

    //hide components and show login
    app.hideComponents = function() {
        document.getElementById('navbar-inner').style.display = 'none';
        document.getElementById('wrapper').style.display = 'none';
        socket.close();
        socket = null;
        document.getElementById('login-overlay').style.display = 'block';
    };


    if (window.addEventListener)
        window.addEventListener('load', app.init, false);
    else
        window.attachEvent('onload', app.init, false);
}(window));
