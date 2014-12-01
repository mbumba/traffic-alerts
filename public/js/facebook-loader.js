var fbApiInit = false;
window.fbAsyncInit = function() {
    FB.init({
        appId: '314024255447342', //set your FB API id here
        cookie: true,
        xfbml: true,
        version: 'v2.1'
    });
    fbApiInit = true;
};

(function(d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) {
        return;
    }
    js = d.createElement(s);
    js.id = id;
    js.src = "//connect.facebook.net/en_US/sdk.js";
    fjs.parentNode.insertBefore(js, fjs);
}(document, 'script', 'facebook-jssdk'));