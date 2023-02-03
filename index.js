/**
 * Samuel Moon
 * 
 * Notes (update 12/23/19):
 * 1. Environment variables are set on the lambda configuration page.
 *    API Gateway URL set on process.env.APIGATEWAY
 * 2. Timeout is set at 15 minutes. Storing JSON outside handler or in
 *    the /tmp/ directory is unreliable, as they are reliant on Lambda's
 *    execution context.
 * 3. Execution context is garbage collected on videos that take a long
 *    time to process. Will need to use S3 to store fileContext JSON.
 */

'use strict';
const { FilesReader, SkillsWriter, SkillsErrorEnum } = require("./skills-kit-2.0");
const {VideoIndexer, ConvertTime} = require("./video-indexer");
const AWS = require("aws-sdk");
const sendErrorEmail = require("./email").sendErrorEmail;
const fs = require("fs"); 

var s3 = new AWS.S3();
// const cloneDeep = require("lodash/cloneDeep"); // For deep cloning json objects

module.exports.handler = async (event) => {
    
    // VideoIndexer event
    if (event && event.queryStringParameters && event.queryStringParameters.state === "Processed") {
        
        console.debug(`VideoIndexer finished processing event received: ${JSON.stringify(event)}`);

        try {
            const videoId = event.queryStringParameters.id;
            const requestId = event.queryStringParameters.requestId;

            let videoIndexer = new VideoIndexer(process.env.APIGATEWAY); // Initialized with callback endpoint
            await videoIndexer.getToken(false);

            let params = {
                Bucket: process.env.S3_BUCKET,
                Key: requestId
            }

            let bucketData = await s3.getObject(params).promise();
            console.log(bucketData);

            // "Body" is capital "B", not lowercase like "body".
            let fileContext = JSON.parse(bucketData.Body.toString());
            console.log(fileContext);
            console.log(fileContext.fileWriteToken);

            let skillsWriter = new SkillsWriter(fileContext);

            const indexerData = await videoIndexer.getData(videoId); // Can create skill cards after data extraction
                                                                    // This method also stores videoId for future use.

            const cards = [];

            let fileDuration = indexerData.summarizedInsights.duration.seconds;

            // Keywords
            let keywords = [];
            indexerData.summarizedInsights.keywords.forEach(kw => {
                if (kw.name.trim()) {
                    keywords.push({
                        text: kw.name,
                        appears: kw.appearances.map(time => {
                            return {start: time.startSeconds, end: time.endSeconds};
                            // return {start: time.startSeconds, end: time.endSeconds};
                        })
                    })
                }
            });
            console.log(keywords);
            cards.push(skillsWriter.createTopicsCard(keywords, fileDuration));

            // Transcripts (sometimes text is empty string such as "")
            let transcripts = [];
            let textDoc = ""; 
            indexerData.videos[0].insights.transcript.forEach(tr => {
                // Check if empty or whitespace
                if (tr.text.trim()) {
                    transcripts.push({
                        text: tr.text,
                        appears: tr.instances.map(time => {
                            return {start: ConvertTime(time.start), end: ConvertTime(time.end)};
                        })
                    })
                    textDoc += `${tr.instances.map(time => {
                        ConvertTime(time.start)
                    })} \xa0\xa0\xa0\xa0\xa0\xa0\xa0\xa0 ${tr.text} \n`
                }
            })
            console.log(transcripts);
            console.log(textDoc); 

            cards.push(skillsWriter.createTranscriptsCard(transcripts, fileDuration));

            // Faces (sometimes there are no faces detected)
            if (indexerData.videos[0].insights.faces) {
                let faces = [];
                let timestamps = []; 
                indexerData.videos[0].insights.faces.forEach(fa => {
                    faces.push({
                        text: fa.name,
                        image_url: videoIndexer.getFace(fa.thumbnailId),
                        appears: fa.thumbnails.instances.forEach(ins =>{
                            timestamps.push({start: ConvertTime(ins.start), end: ConvertTime(ins.end)});
                        })
                    })
                });
                console.log(faces);
                cards.push(await skillsWriter.createFacesCard(faces, fileDuration));
            }
        
            await skillsWriter.saveDataCards(cards);

        } catch(e) {
            console.error(e);
            sendErrorEmail(e);
        }
        return;
    }

    let parsedBody = JSON.parse(event.body);
    console.log(parsedBody);

    if (parsedBody.hasOwnProperty("type") && parsedBody.type == "skill_invocation") {
        try {
            console.debug(`Box event received: ${JSON.stringify(event)}`);
            let videoIndexer = new VideoIndexer(process.env.APIGATEWAY); // Initialized with callback endpoint
            await videoIndexer.getToken(true);
            
            // instantiate your two skill development helper tools
            let filesReader = new FilesReader(event.body);
            let fileContext = filesReader.getFileContext();
    
            // S3 write fileContext JSON to save tokens for later use.
            let params = {
                Bucket: process.env.S3_BUCKET,
                Key: fileContext.requestId,
                Body: JSON.stringify(fileContext)
            }
            let s3Response = await s3.upload(params).promise()
            console.log(s3Response);
    
            let skillsWriter = new SkillsWriter(fileContext);
            
            await skillsWriter.saveProcessingCard();
        
            console.debug("sending video to VI");
            await videoIndexer.upload(fileContext.fileName, fileContext.requestId, fileContext.fileDownloadURL,JSON.parse(event.body).skill.name); // Will POST a success when it's done indexing.
            console.debug("video sent to VI");
    
            console.debug("returning response to box");
            return {statusCode: 200};
        } catch(e) {
            console.error(e);
            sendErrorEmail(e);
        }
    }
    else {
        console.debug("Unknown request");
        console.log(event);

        return {statusCode: 400, body: "Unknown Request"};
    }
};