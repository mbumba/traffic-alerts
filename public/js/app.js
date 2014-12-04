/* TRAFFIC ALERTS CLIENT SIDE APPLICATION
 * Martin Bumba and Sara Fatih
 * 2014
 * */
(function(document, window, google, validator, moment) {
    'use strict';

    /* 
     * URL of host, where running the TrafficAlerts server, this variable should including port like: http://cloud-25.skelabb.ltu.se:80
     * If is null it will use current host and port
     */ 
    var host = null;
    
    
    
    //main object variable    
    var app = app || {};
    
    //socket
    var socket = null;

    //map variables
    var map = null;
    var mapCentered = false;


    //GEO variables
    var geoLat = null;
    var geoLng = null;
    var geoInitialized = false;

    //maps markers and info window
    var positionMarker = null;
    var alertMarkers = {};
    var infoWindow = new google.maps.InfoWindow({maxWidth: 400});
    var infoWindowListener = null;
    var infoWindowListenerClose = null;
    var clickMapListenerHandle = null;

    //stored picture
    var takenPicture = null;
    var myVideo = null;

    //constants
    var allowedIcons = [1, 2, 3, 4];
    var iconsPath = 'images/icons/';

    var initialized = false;
    //initialize application
    app.init = function() {

        //load last GEO from local storage
        if (localStorage.getItem("lat") && localStorage.getItem("lng")) {
            geoLat = localStorage.getItem("lat");
            geoLng = localStorage.getItem("lng");
        }

        //wait for FB API which is loaded asysnchronously and  then check login
        app.fbEnsureInit(app.checkLogin);

        //initialize geolocation
        navigator.geolocation.watchPosition(app.positionCallback, app.positionError,
                {
                    timeout: Infinity,
                    enableHighAccuracy: true,
                    maximumAge: 3 * 24 * 60 * 60 * 1000
                });



   

        //initialize camera
        navigator.myGetMedia = (navigator.getUserMedia ||
                navigator.webkitGetUserMedia ||
                navigator.mozGetUserMedia ||
                navigator.msGetUserMedia);
        
        //when mygetmedia is available
        if (typeof navigator.myGetMedia !== 'undefined') {
            navigator.myGetMedia({video: true}, app.cameraCallback, app.cameraError);
        }
        
        //this part is for users with Chrome > 30 and is for change the camera to back one                        
        if (typeof MediaStreamTrack !== 'undefined' && typeof MediaStreamTrack.getSources !== 'undefined') {            
            MediaStreamTrack.getSources(app.chooseRightSource);
        }
        //form expiries input set to datetimepicker
        $('#form-expires').datetimepicker({
            autoclose: true,
            todayBtn: true,
            minuteStep: 15,
            format: 'MM d, yyyy hh:ii',
            minView: 0,
            maxView: 3,
            startView: 1
        }).on("show", function() {
            var d = new Date((new Date()).getTime() + (15*60*1000));
            $(this).datetimepicker('setStartDate', d);  
        });



        //create nice input type="file"
        $('input[type=file]').bootstrapFileInput();

        //for bootstrap navigation auto collapse after click on item
        $('.navbar-nav').click(function() {
            if ($('.navbar-header .navbar-toggle').css('display') !== 'none') {
                $('.navbar-collapse').collapse('hide');
            }
        });

    };


    //FACEBOOK METHODS
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

    //check if user is logged in
    app.checkLogin = function() {
        //add event listener for FB login button
        document.getElementById('login-button').addEventListener('click', app.loginViaFacebook);

        //get login status from Facebook
        FB.getLoginStatus(function(response) {
            if (response.status === 'connected') {
                app.connectToServer();
            }
            else {
                document.getElementById('login-overlay').style.display = 'block';
            }
        });
    };

    //login to application via FB
    app.loginViaFacebook = function() {
        //call external login aneg wait for response callback
        FB.login(function(response) {
            if (response.status === 'connected') {
                app.connectToServer();
            }
        });
    };

    //open server connection
    app.connectToServer = function() {
        if(!host)
            socket = new io();
        else 
            socket = new io(host);
        
        socket.on('connect', app.connectedToServer);
        socket.connect();
    };

    //if is connected to server emits  log me with FB token
    app.connectedToServer = function() {
        socket.emit('log-me', FB.getAuthResponse()['accessToken'], app.serverLoggedIn);
    };


    app.serverLoggedIn = function(res, error) {
        if (res) {
            if (!initialized)
                app.initComponents();
        }
        else
            app.alert('danger', 'Error in logging into server side(' + error + ').');
    };
    //MAIN METHODS FOR INITIALIZE OR HIDE COMPONENTS
    //initialize componets after sucessful login
    app.initComponents = function() {
        //listeners of messages from server
        socket.on('new-alert', app.receivedNewAlert);
        socket.on('removed-alert', app.receivedRemovedAlert);
        //imidietaly afer connect get list of alerts + log me to server with FBtoken, callback
        socket.emit('get-list', app.receivedAlertsList);

        //set style to elemnts
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('navbar-inner').style.display = 'block';
        document.getElementById('wrapper').style.display = 'block';
        document.getElementById('form-position').value = null;

        //initialize map and GEO components
        app.loadMap();

        //listener for history pop state
        window.addEventListener('popstate', app.historyPopState);
        //listeners for menu
        document.getElementById('menu-refresh').addEventListener('click', app.refreshMap);
        document.getElementById('menu-logout').addEventListener('click', app.logout);
        document.getElementById('menu-new-alert').addEventListener('click', app.showNewAlertModal);
        //listeners for form elements
        document.getElementById('form-take-photo').addEventListener('click', app.takePhoto);
        document.getElementById('form-file-select').addEventListener('change', app.fileSelected);
        document.getElementById('form-get-actual-position').addEventListener('click', app.getPosition);
        document.getElementById('form-get-position-from-map').addEventListener('click', app.getPositionFromMap);
        document.getElementById('form-publish').addEventListener('click', app.publishAlert);

        //listener for info window
        infoWindowListener = google.maps.event.addListener(infoWindow, 'domready', app.infoWindowLoaded);

        infoWindowListenerClose = google.maps.event.addListener(infoWindow, 'closeclick', app.infoWindowClosed);
        //jquery listener for click in alert box
        $('.alert-messages').on('click', '.show-alert', app.newAlertLinkListener);

        FB.api('me', function(response) {
            if (response.name) {
                document.getElementById('menu-logout').innerHTML = document.getElementById('menu-logout').innerHTML + ' [' + response.name + ']';
            }
        });


        initialized = true;
    };

    //deinitialize components and show login
    app.deinitComponents = function() {
        //close and clear socket
        socket.removeListener('connect', app.connectedToServer);
        socket.removeListener('new-alert', app.receivedNewAlert);
        socket.removeListener('removed-alert', app.receivedRemovedAlert);
        socket.disconnect();
        socket = null;
        //set styles for components
        document.getElementById('navbar-inner').style.display = 'none';
        document.getElementById('wrapper').style.display = 'none';
        document.getElementById('login-overlay').style.display = 'block';
        document.getElementById('form-position').value = null;

        //remove event listeners
        window.removeEventListener('popstate', app.historyPopState);

        document.getElementById('menu-refresh').removeEventListener('click', app.refreshMap);
        document.getElementById('menu-logout').removeEventListener('click', app.logout);
        document.getElementById('menu-new-alert').removeEventListener('click', app.showNewAlertModal);
        document.getElementById('form-take-photo').removeEventListener('click', app.takePhoto);
        document.getElementById('form-file-select').removeEventListener('change', app.fileSelected);
        document.getElementById('form-get-actual-position').removeEventListener('click', app.getPosition);


        document.getElementById('form-publish').removeEventListener('click', app.publishAlert);
        google.maps.event.removeListener(infoWindowListener);
        google.maps.event.removeListener(infoWindowListenerClose);

        $('.alert-messages').off('click', '.show-alert', app.newAlertLinkListener);

        //remove markers and then map
        google.maps.event.clearInstanceListeners(window);
        app.removeAllMarkers(true);
        positionMarker.setMap(null);
        positionMarker = null;
        map = null;
        
        //deinitialize form componets
        if(myVideo) 
            app.cameraToggle(2);
        else {
            takenPicture = null;
            document.getElementById('video-frame').style.display = 'none';
            document.getElementById('preview').style.display = 'block';
            document.getElementById('preview').src = "images/no-photo.png";
        }
        $('#new-alert').modal('hide');
        document.getElementById('form-note').value = '';
        document.getElementById('form-position').value = null;
        document.getElementById('form-expires').value = null;


        document.getElementById('menu-logout').innerHTML = '<span class="glyphicon glyphicon-log-out"> </span> Logout';
        initialized = false;
    };

    //METHODS FOR GEOLOCATION
    //event position loaded
    app.positionCallback = function(position) {
        //store position to global variable
        geoLat = position.coords.latitude.toFixed(6);
        geoLng = position.coords.longitude.toFixed(6);

        //save to local storage
        localStorage.setItem("lat", geoLat);
        localStorage.setItem("lng", geoLng);


        if (map !== null && positionMarker !== null) {
            var position = new google.maps.LatLng(geoLat, geoLng);
            //set my position marker in map
            positionMarker.setPosition(position);

            //center the map at first time
            if (!mapCentered) {
                map.setCenter(position);
                mapCentered = true;
            }
        }
        geoInitialized = true;
        document.getElementById('form-get-actual-position').style.display = 'inline-block';


    };
    //event geolocation error 
    app.positionError = function(error) {
        app.alert('danger', 'Sensor of position cannot be initialized. Some features of this application are disabled, if you want to use those please refresh browser and allow the position sensor.');
    };



    //METHODS FOR CAMERA
    //method for choose right source (rear camera)
    app.chooseRightSource = function(sourceInfos) {
        var lastVideoSource = null;
        for (var i = 0; i < sourceInfos.length; i++) {
            var sourceInfo = sourceInfos[i];
            if (sourceInfo.kind === 'video') {
                lastVideoSource = sourceInfo.id;    
            }             
        }
        if(lastVideoSource) 
            navigator.myGetMedia({video: {optional: [{sourceId: lastVideoSource}]}}, app.cameraCallback, app.cameraError);
    };
    //event camera connected, set stream to video frame
    app.cameraCallback = function(stream) {
        document.getElementById('form-take-photo').style.display = 'block';
        if (!takenPicture) {
            document.getElementById('video-frame').style.display = 'block';
            document.getElementById('preview').style.display = 'none';
        }
        myVideo = document.getElementById('video-frame');
        myVideo.src = window.URL ? window.URL.createObjectURL(stream) : stream;

    };
    //event camera error event
    app.cameraError = function(error) {
        app.alert('warning', 'Camera cannot be initialized. Some features of this application are disabled, if you want to use those please refresh browser and allow camera.');
    };

    //MENU ITEMS EVENTS
    app.refreshMap = function(e) {
        e.preventDefault();
        app.removeAllMarkers(false);
        socket.emit('get-list', app.receivedAlertsList);
    };
    //event click on logout
    app.logout = function() {
        FB.logout(function(response) {
            app.deinitComponents();
        });
    };
    //event click on "New alert"
    app.showNewAlertModal = function() {
        if (clickMapListenerHandle !== null) {
            google.maps.event.removeListener(clickMapListenerHandle);
            clickMapListenerHandle = null;
        }
        $('#new-alert').modal('show');
    };

    app.newAlertLinkListener = function(e) {
        e.preventDefault();
        app.showAlert($(this).attr("data-id"), true);
    };


    //FORM ELEMENTS
    //event click on "Take a photo"
    app.takePhoto = function(e) {
        e.preventDefault();
        app.cameraToggle(e.target.getAttribute("data-type"));
    };
    //toggle camera 
    app.cameraToggle = function(type) {
        if (type == 1) {
            var canvas = document.createElement('canvas');
            document.body.appendChild(canvas);
            var context = canvas.getContext('2d');
            canvas.width = (myVideo.videoWidth < 800) ? myVideo.videoWidth : 800; //video.videoWidth / 4
            canvas.height = (myVideo.videoHeight < 600) ? myVideo.videoHeight : 600;
            context.drawImage(myVideo, 0, 0, canvas.width, canvas.height);
            //save canvas image as data url
            var dataURL = canvas.toDataURL('image/jpeg');
            //set preview image src to dataURL          
            document.getElementById('preview').src = dataURL;
            document.getElementById('video-frame').style.display = 'none';
            document.getElementById('preview').style.display = 'block';
            document.getElementById('form-take-photo').setAttribute('data-type', 2);
            document.getElementById('form-take-photo').innerHTML = 'Try it again';
            takenPicture = dataURL;
        }
        else {
            document.getElementById('video-frame').style.display = 'block';
            document.getElementById('preview').style.display = 'none';
            document.getElementById('form-take-photo').setAttribute('data-type', 1);
            document.getElementById('form-take-photo').innerHTML = '<span class="glyphicon glyphicon-camera"> </span> Take a photo';
            takenPicture = null;
        }
    };
    //if uploaded image is selected - load that
    app.fileSelected = function(e) {
        e.preventDefault();
        var file = e.target.files[0];

        if (!file.type.match(/image\/jpeg/)) {
            app.alert('danger', 'Choosen file must be JPEG image!');
            return;
        }
        var fr = new FileReader();
        fr.onloadend = function(evt) {
            if (evt.target.readyState === FileReader.DONE) {
                var image = new Image;
                image.src = evt.target.result;
                image.onload = function() {
                    var canvas = document.createElement('canvas');
                    document.body.appendChild(canvas);
                    var context = canvas.getContext('2d');
                    canvas.width = (image.width < 800) ? image.width : 800;
                    canvas.height = (image.height < 600) ? image.height : 600;
                    context.drawImage(image, 0, 0, canvas.width, canvas.height);
                    var dataURL = canvas.toDataURL('image/jpeg');
                    takenPicture = dataURL;
                    document.getElementById('video-frame').style.display = 'none';
                    document.getElementById('form-take-photo').innerHTML = 'Try take a photo from camera';
                    document.getElementById('form-take-photo').setAttribute('data-type', 2);
                    document.getElementById('preview').src = takenPicture;
                    document.getElementById('preview').style.display = 'block';
                };
            }
        };
        fr.readAsDataURL(e.target.files[0]); // get captured image as data URI
    };

    //click on button for get actual position from position sensor
    app.getPosition = function(e) {
        e.preventDefault();
        if (geoInitialized) {
            document.getElementById('form-position').value = geoLat + "; " + geoLng;
        }
    };

    //click on button for get actual position from MAP
    app.getPositionFromMap = function(e) {
        e.preventDefault();
        if (clickMapListenerHandle !== null) {
            google.maps.event.removeListener(clickMapListenerHandle);
            clickMapListenerHandle = null;
        }
        clickMapListenerHandle = google.maps.event.addListener(map, 'click', app.clickedOnMap);
        $('#new-alert').modal('hide');
        app.alert('info', 'Please click (tap) to map to specify exact position.', 4000);
    };
    //event clicked on position in map
    app.clickedOnMap = function(e) {
        document.getElementById('form-position').value = e.latLng.lat().toFixed(6) + "; " + e.latLng.lng().toFixed(6);
        $('#new-alert').modal('show');
        google.maps.event.removeListener(clickMapListenerHandle);
        clickMapListenerHandle = null;
    };
    //event "Publish alert"
    app.publishAlert = function(e) {
        e.preventDefault();

        //check taken picture
        if (takenPicture === null) {
            app.alert('danger', 'Photo is required, to send this form. Please take a picture.');
            return;
        }

        //check GEO coordinates
        var position = document.getElementById('form-position').value;
        if (!position) {
            app.alert('danger', 'GEO position is required for send a form, please wait for right coordinates.');
            return;
        }
        var positionSplit = position.split('; ');
        if (!(positionSplit.length === 2 && validator.isFloat(positionSplit[0]) && validator.isFloat(positionSplit[1]))) {
            app.alert('danger', 'GEO position is required for send a form, please wait for right coordinates.');
            return;
        }


        //get and check icon
        var icons = document.getElementsByName('form-icon');
        var icon = null;
        for (var i = 0; i < icons.length; i++) {
            if (icons[i].checked) {
                icon = icons[i].value;
            }
        }
        if (!validator.isIn(icon, allowedIcons)) {
            app.alert('danger', 'Icon have to be choosen properly.');
            return;
        }

        //get and check expires date
        var expires = new Date(document.getElementById('form-expires').value);
        if (!expires) {
            app.alert('danger', 'Expires date must be valid date.');
            return;
        }

        if (!validator.isAfter(expires, new Date((new Date()).getTime() + (5 * 60 * 1000)))) {
            app.alert('danger', 'Expires date must be more in future.');
            return;
        }
        //get and check note
        var note = document.getElementById('form-note').value;
        if (!validator.isLength(note, 4)) {
            app.alert('danger', 'Note must have length between 4 and 250 characters.');
            return;
        }

        
        app.alert('info', 'New alert is sending to server.');
        
        //emit alert to server
        socket.emit('publish-alert', takenPicture, positionSplit[0], positionSplit[1], icon, note, expires, function(data, err) {
            if (err) {
                app.alert('danger', err);
                return;
            }
            app.addMarker(data);
            app.alert('success', 'Alert has been sucessfully published.');
        });

        //hide modal and clear the form
        $('#new-alert').modal('hide');
        document.getElementById('form-note').value = '';
        document.getElementById('form-position').value = null;
        document.getElementById('form-expires').value = null;
        if(myVideo) 
            app.cameraToggle(2);
        else {
            takenPicture = null;
            document.getElementById('video-frame').style.display = 'none';
            document.getElementById('preview').style.display = 'block';
            document.getElementById('preview').src = "images/no-photo.png";
        }

    };



    //MAP METHODS
    //load map
    app.loadMap = function() {
        var location = new google.maps.LatLng(geoLat, geoLng);
        var mapOptions = {
            zoom: 13,
            center: location,
            mapTypeId: google.maps.MapTypeId.ROADMAP
        };
        //create map
        map = new google.maps.Map(document.getElementById('map-canvas'),
                mapOptions);

        //create position marker
        positionMarker = new google.maps.Marker({
            map: map,
            animation: google.maps.Animation.DROP,
            icon: 'images/icons/my-location.png',
            title: 'My position',
            zIndex: google.maps.Marker.MAX_ZINDEX + 1
        });
    };

    //app add new marker
    app.addMarker = function(data) {
        if (!alertMarkers[data.id]) {
            var position = new google.maps.LatLng(data.lat, data.lng);
            var icon;
            if (data.owner === 1) {
                icon = iconsPath + data.icon + 'e.png';
            }
            else {
                icon = iconsPath + data.icon + '.png';
            }

            alertMarkers[data.id] = new google.maps.Marker({
                position: position,
                map: map,
                title: data.note,
                animation: google.maps.Animation.DROP,
                icon: icon
            });


            google.maps.event.addListener(alertMarkers[data.id], 'click', function(e) {
                //new alert modal showed? - hide it
                $('#new-alert').modal('hide');

                var removeButton = '';
                if (data.owner == 1) {
                    removeButton = '<p><button class="btn btn-danger btn-block" id="remove-alert" data-id="' + data.id + '"><span class="glyphicon glyphicon-remove"> </span> Remove this alert</button></p>';
                }
                var published = new Date(data.published);
                var expiresOn = new Date(data.expire_on);
                var now = (new Date()).getTime();
                var percentage = validator.toInt(((now - published.getTime()) * 100) / (expiresOn.getTime() - published.getTime()));
                var imgHost = "";
                if(host)
                    imgHost = host + '/';
                var contentString = '<div id="infowindow-content">' +
                        '<p><span class="label label-default">Published on: ' + moment(published).format('MMMM DD, YYYY HH:mm') + '</span> <span class="label label-warning">Expires on: ' + moment(expiresOn).format('MMMM DD, YYYY HH:mm') + '</span></p>' +
                        '<img src="' + imgHost + data.path + '" alt="Photo" id="content-image" />' +
                        '<p><strong>Note: </strong>' + data.note + '</p>' +
                        '<div class="nopopup"><div class="fb-like" data-href="' + document.URL.replace(/#.*$/, '') + '#show-' + data.id + '" data-layout="button_count" data-action="like" data-show-faces="true" data-share="false"></div></div>' +
                        '<div class="progress"> <div class="progress-bar" role="progressbar" aria-valuenow="' + percentage + '" aria-valuemin="0" aria-valuemax="100" style="width: ' + percentage + '%;">' + percentage + '% </div> </div>' +
                        removeButton +
                        '</div>';

                infoWindow.setContent(contentString);
                infoWindow.open(map, alertMarkers[data.id]);




                FB.XFBML.parse();


                //save or not to browser history
                if (!e.notSave) {
                    var state = {key: 'show', id: data.id};
                    window.history.pushState(state, 'Alert ' + data.id, '#show-' + data.id);
                }

            });

        }
        //return alertMarkers[data.id];
    };

    //remove marker
    app.removeMarker = function(id) {
        if (alertMarkers[id]) {
            alertMarkers[id].setMap(null);
            delete alertMarkers[id];
        }
    };
    //remove all markers excepet marker of current location
    app.removeAllMarkers = function(position) {
        for (var id in alertMarkers) {
            app.removeMarker(id);
        }
        alertMarkers = {};

    };

    //google maps info window loaded
    app.infoWindowLoaded = function() {
        if (document.getElementById('remove-alert'))
            document.getElementById('remove-alert').addEventListener('click', app.removeAlert);
    };
    app.infoWindowClosed = function(e) {
        location.hash = '';
    };
    //click on remove alert info window
    app.removeAlert = function(e) {
        e.preventDefault();
        var id = e.target.getAttribute("data-id")
        if (window.confirm("Are you sure, that you want remove this alert?")) {
            socket.emit('remove-alert', id, function(response, err) {
                if (err) {
                    app.alert('danger', err);
                    return;
                }
                app.removeMarker(response);
                app.alert('success', 'Alert has been sucessfully removed.');

            });
        }
    };

    //show alert - map info box
    app.showAlert = function(id, saveHistory) {
        if (alertMarkers[id]) {
            var obj = {
                notSave: !saveHistory
            }
            //if map is not yet centered, don't centering it from this point
            mapCentered = true;
            //show alert
            google.maps.event.trigger(alertMarkers[id], 'click', obj);
        }
    };



    //SOCKET EVENTS 
    //received new alert
    app.receivedNewAlert = function(data) {
        app.addMarker(data);
        app.alert('info', 'New alert were published. You can show it directly by click <a href="#show-' + data.id + '" class="show-alert" data-id="' + data.id + '">here</a>.', 5000);

    };

    //receive alert removed
    app.receivedRemovedAlert = function(id) {
        app.removeMarker(id);
    };

    //CALLBACK for request on new alerts list
    app.receivedAlertsList = function(data, err) {
        if (err) {
            app.alert('danger', err);
            return;
        }
        for (var i = 0; i < data.length; i++) {
            app.addMarker(data[i]);
        }
        //check if some alert it could be showed
        if (location.hash !== null) {
            var regExp = /#show\-(\d+)/gi;
            var results = regExp.exec(location.hash);
            if (results) {
                app.showAlert(results[1]);
            }
        }
    };

    //HISTORY
    app.historyPopState = function(e) {
        var state = e.state;
        if (state && state.key && state.id) {
            if (state.key === 'show') {
                app.showAlert(state.id, false);
            }
        }
    };

    //ALERTS
    //show alert message
    app.alert = function(type, message, duration) {
        if (!duration)
            duration = 3000;
        var htmlAlert = '<div class="alert alert-' + type + ' alert-dismissible" role="alert"><button type="button" class="close" data-dismiss="alert"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button> ' + message + '</div>';

        // Prepend so that alert is on top, could also append if we want new alerts to show below instead of on top.
        $(".alert-messages").prepend(htmlAlert);

        // Since we are prepending, take the first alert and tell it to fade in and then fade out.
        // Note: if we were appending, then should use last() instead of first()
        $(".alert-messages .alert").first().hide().fadeIn(200).delay(duration).fadeOut(1000, function() {
            $(this).remove();
        });
    };



    if (window.addEventListener)
        window.addEventListener('load', app.init, false);
    else
        window.attachEvent('onload', app.init, false);
}(document, window, google, validator, moment));

