/* TRAFFIC ALERTS NODEJS SERVER FUNCTIONS 
 * Martin Bumba and Sara Fatih
 * */

/* Safe decode Base64Image 
 * Params:
 *  dataString - (string) with Base64 encoded image
 * Returns:
 * (string) image or null when error
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

//Set function(s) to export variable
exports.decodeBase64Image = decodeBase64Image;
