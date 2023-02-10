// Samuel Moon
const https = require("https"); // Low level API for HTTPS request/response

/**
 * @param {*} apiGateway - Used for callback when uploaded video indexing is finished.
 * 
 * Methods are wrapped in promises for async implmentation.
 */

function VideoIndexer(apiGateway) {
    const uri = apiGateway;
    const encodedURI = encodeURI(uri);
    this.apiGateway = encodedURI;
    this.location = "trial"; // Trial VideoIndexer accounts has its own location.
    this.accountId = process.env.VI_ACCOUNT_ID; // Your VideoIndexer account ID
    this.authKey = process.env.VI_AUTH_KEY_1; // API key for VideoIndexer
    this.authKey2 = process.env.VI_AUTH_KEY_2; // API key for VideoIndexer
    this.hostname = "api.videoindexer.ai";
    this.accessToken = "";
    this.language = "";
}

/**
 * Uploaded video is public for testing purposes. Change this flag to "Private" to use
 * authentication tokens.
 * 
 * Removed "async" from function prototype as there are no awaits within the scope.
 * https://api-portal.videoindexer.ai/docs/services/Operations/operations/Upload-Video?
 */
VideoIndexer.prototype.upload = function (fileName, requestId, fileUrl, skillname) {
    console.log(skillname);
    if (skillname.includes("English")) {
        this.language = "en-US";
    }
    else if (skillname.includes("Spanish")) {
        this.language = "es-ES";
    } else {
        this.language = "en-US";
    }
    fileName = fileName.split(" ").join("");
    let callback = this.apiGateway + "?requestId=" + requestId;
    const options = {
        host: this.hostname,
        path: `/${this.location}/Accounts/${this.accountId}/Videos?name=${fileName}&privacy=Private&language=${this.language}&callbackUrl=${callback}&videoUrl=${fileUrl}`,
        method: "POST",
        headers: {
            "Authorization": `Bearer ${this.accessToken}`
        }
    };
    console.debug("Request Path: \n" + options.path);
    console.debug("Request headers: \n" + options.headers);
    console.debug("before upload video:\n" + this.accessToken);
    return new Promise((resolve, reject) => {

        const request = https.request(options, (result) => {
            console.log('statusCode upload:', result.statusCode);
            console.log('headers upload:', result.headers);

            if (result.statusCode === 200) {
                resolve("Success: Upload Video");
            }
        });

        request.on('error', (e) => {
            console.error(e);
            reject(e);
        });

        request.end();
    });

};

/**
 * Access token will be required for private videos.
 */
VideoIndexer.prototype.getData = function (videoId) {
    VideoIndexer.prototype.videoId = videoId; // Add as property for face thumbnail images
    const options = {
        host: this.hostname,
        path: `/${this.location}/Accounts/${this.accountId}/Videos/${videoId}/Index`,
        headers: {
            "Accept": "application/json",
            "Authorization": `Bearer ${this.accessToken}`
        }
    }

    return new Promise((resolve, reject) => {
        const request = https.get(options, (result) => {
            console.log('statusCode:', result.statusCode);
            console.log('headers:', result.headers);

            let data = []
            result.on("data", (d) => {
                data.push(d);
            });

            result.on("end", () => {
                data = JSON.parse(Buffer.concat(data));
                resolve(data);
            });

        });

        request.on('error', (e) => {
            console.error(e);
            reject(e);
        });

        request.end();
    });
}

/**
 * Builds the URI for thumbnails stored on VideoIndexer
 * No async because we already have the thumbnail IDs locally.
 */
VideoIndexer.prototype.getFace = function (id) {
    return `https://api.videoindexer.ai/${this.location}/Accounts/${this.accountId}/Videos/${this.videoId}/Thumbnails/${id}?accessToken=${this.accessToken}`;
}

/**
 * If the uploaded video is listed "private", then you'll need a subscription key
 * to request an authorization token.
 */
VideoIndexer.prototype.getToken = function (allowEdit) {
    const options = {
        host: this.hostname,
        path: `/auth/${this.location}/Accounts/${this.accountId}/AccessToken?allowEdit=${allowEdit}`,
        headers: {
            "Ocp-Apim-Subscription-Key": this.authKey
        }
    };

    return new Promise((resolve, reject) => {
        const request = https.get(options, (result) => {
            console.log(result);
            console.log('statusCode:', result.statusCode);
            console.log('headers:', result.headers);

            let data = [];
            result.on('data', (d) => {
                data.push(d)
            });

            result.on("end", () => {
                data = Buffer.concat(data).toString();
                data = data.substring(1, data.length - 1); // Wasted like 6 hours on this because token is wrapped in "double quote" characters
                // Need to find out what's causing the encoding issue that inserts double quotes around the token
                this.accessToken = data;
                console.log(this.accessToken);
                resolve("Success: Authorization Token");
            });

        })
        request.on('error', (e) => {
            console.error(e);
            reject(e);
        });

        request.end();
    });
};



function ConvertTime(hhmmss) {
    const time = hhmmss.split(":");
    return time[0] * 3600.0 + time[1] * 60.0 + time[2] * 1.0;
}

module.exports = { VideoIndexer, ConvertTime };