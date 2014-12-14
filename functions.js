/* TRAFFIC ALERTS NODEJS SERVER 
 * Martin Bumba and Sara Fatih
 * 2014
 * */

/* Decode Base64Image 
 * Params:
 *  dataString - (string) with Base64 encoded image
 * Returns:
 * null if it is not valid image or
 * (object) with properties
 *   type - type of image
 *   data - with data of image
 */
function decodeBase64Image(dataString) {
    var matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/),
            response = {};

    if (matches.length !== 3) {
        return null;
    }

    response.type = matches[1];
    response.data = new Buffer(matches[2], 'base64');

    return response;
}
/* Simple log message with datetime
 * Params:
 *  message - (string) log message
 */
function log(message) {
    console.log('[' + getDateTime() + '] ' + message);
}
/* Simple get datetime in this format: DD.MM.YYYY HH:MM:SS 
 * Params: *  
 * Returns:
 * (string) in format DD.MM.YYYY HH:MM:SS 
 */
function getDateTime() {

    var date = new Date();

    var hour = date.getHours();
    hour = (hour < 10 ? '0' : '') + hour;

    var min  = date.getMinutes();
    min = (min < 10 ? '0' : '') + min;

    var sec  = date.getSeconds();
    sec = (sec < 10 ? '0' : '') + sec;

    var year = date.getFullYear();

    var month = date.getMonth() + 1;
    month = (month < 10 ? '0' : '') + month;

    var day  = date.getDate();
    day = (day < 10 ? '0' : '') + day;

    return day + '.' + month  + '.' + year + ' ' + hour + ':' + min + ':' + sec;

}

//Set function to export variable
exports.decodeBase64Image = decodeBase64Image;
exports.log = log;
