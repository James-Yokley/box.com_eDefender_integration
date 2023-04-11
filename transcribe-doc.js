'use strict';
const fs = require("fs");
const docx = require("docx");
const { Readable } = require('stream');
const { Buffer } = require("buffer");
const BoxSDK = require("box-node-sdk");
const path = require('path');
const config = require('./config.json');

// maximum number of tries for filename duplicates
const MAX_TRIES = 10;

function TranscribeDoc(data, fileName, folderId) {
    return new Promise(async (resolve, reject) => {
        const sdk = BoxSDK.getPreconfiguredInstance(config);
        const appUserClient = sdk.getAppAuthClient('enterprise');
        
        // filename without extension
        let filename = path.parse(fileName).name; 
        console.log("filename without extension: " + filename);

        // Grab folderID from function parameter

        const folderID = folderId;
        console.log("Inside TranscribeDoc - folderID: " + folderID);

        let textDoc = "";
        data.videos[0].insights.transcript.forEach(tr => {
            if (tr.text.trim()) {
                textDoc += `Speaker ${tr.speakerId} : \xa0\xa0 ${tr.text} \n`
            }
        })
        textDoc += 'END OF RECORDING';

        console.log(textDoc);
        let textSize = 0;
        const textRuns = textDoc.split('\n').map((line, index) => {
            let lineSize = line.length;
            while(lineSize > 96) {
                textSize++;
                lineSize -= 95;
            }

            return new docx.TextRun({ break: index > 0 ? 1: undefined, text: line, size: 24 })
        });
        textSize += textRuns.length;
        while(textSize%28 !== 0) {
            textRuns.push(new docx.TextRun({ break: 1 }));
            textSize++;
        };

        const paragraph = new docx.Paragraph({
            children: textRuns,
            spacing: {
                line: 460,
                lineRule: "exact"
            }
        });

        const doc = new docx.Document({
            sections: [{
                properties: {
                    page: {
                        size: {
                            width: docx.convertInchesToTwip(8.5),
                            height: docx.convertInchesToTwip(11)
                        },
                        pageNumbers: {
                            start: 1,
                            formatType: docx.NumberFormat.DECIMAL
                        },
                        borders: {
                            pageBorderLeft: {
                                style: docx.BorderStyle.DOUBLE,
                                size: 1 * 8,
                                space: 4,
                                color: "000000"
                            },
                            pageBorderRight: {
                                style: docx.BorderStyle.SINGLE,
                                size: 1 * 8,
                                space: 4,
                                color: "000000"
                            }
                        }
                    },
                    lineNumbers: {
                        countBy: 1,
                        restart: docx.LineNumberRestartFormat.NEW_PAGE
                    }
                },
                headers: {
                    default: new docx.Header({
                        children: [
                            new docx.Paragraph({
                                children:
                                [
                                    new docx.TextRun(`${filename}.docx`)
                                ]
                            })
                        ]
                    })
                },
                footers: {
                    default: new docx.Footer({
                        children: [
                            new docx.Paragraph({
                                alignment: docx.AlignmentType.CENTER,
                                children: [
                                    new docx.TextRun({
                                        children: [docx.PageNumber.CURRENT], size: 24
                                    })
                                ]
                            })
                        ]
                    })
                },
                children: [paragraph],
            }
            ]
        });

        const vidID = data.videosRanges.videoId;


        const string = await docx.Packer.toBase64String(doc);
        let base64Content = string; // your base64 content
        let base64Buffer = Buffer.from(base64Content, 'base64');
        // we are using just Readable to create a stream, but you can use any library you want
        let stream = new Readable()
        stream._read = () => {
            stream.push(base64Buffer);
            stream.push(null);
        };
        
        let content_size = Buffer.byteLength(base64Content, 'base64');

        // you have to pass options and define content length
        let options = {
            content_length: content_size
        };

        //checklist of name and size for preflight check
        let checklist = {
            name: null,
            size: content_size
        };

        let tempFileName = filename;
        let tries = 0;
        while(tries <= MAX_TRIES) {
            try {
                checklist.name = `${tempFileName}.docx`;
                const file = await appUserClient.files.preflightUploadFile(folderID, checklist, null);
                const upload = await appUserClient.files.uploadFile(folderID, `${tempFileName}.docx`, stream, options);
                tries = MAX_TRIES + 1;
                console.log("Finished - tries: ", tries, "\nFilename: ", tempFileName);
                resolve();
            } catch (error) {
                // if correct error otherwise rethrow 
                let body = error.response.body;
                if(body.code === 'item_name_in_use') {
                    if(tries > 0 && tempFileName.slice(-4) === ` (${tries})`) {
                        tempFileName = tempFileName.slice(0, -4);
                    } 
                    tempFileName = tempFileName.concat( ` (${tries+1})`);
                    console.log(`${tries+1}: ${tempFileName}`);
                }
                else throw(error);
            }

            tries++;
        }
    });  
}

module.exports.TranscribeDoc = TranscribeDoc;
