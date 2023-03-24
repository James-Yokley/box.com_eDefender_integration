'use strict';
const fs = require("fs");
const { Document, Packer, Paragraph, AlignmentType, TextRun } = require("docx");
const { Readable } = require('stream');
const { Buffer } = require("buffer");
const BoxSDK = require("box-node-sdk");
const path = require('path');
const config = require('./config.json');

function TranscribeDoc(data, fileName, folderId) {
    
    // const sdk = new BoxSDK({
    //     clientID: process.env.BOX_CLIENT_ID,
    //     clientSecret: process.env.BOX_CLIENT_SECRET,
    //     appAuth: {
    //         // keyID: process.env.BOX_CLIENT_KEY_ID,
    //         // privateKey: process.env.BOX_CLIENT_PRIVATE_KEY,
    //         // passphrase: process.env.BOX_CLIENT_PASSPHRASE
    //     }
    // });
    // const appUserClient = sdk.getAppAuthClient('enterprise', process.env.BOX_ENTERPRISE_ID);

    const sdk = BoxSDK.getPreconfiguredInstance(config);
    const appUserClient = sdk.getAppAuthClient('enterprise');
    
    // filename without extension
    let filename = path.parse(fileName).name; 
    console.log("filename without extension: " + filename);

    // current folder to upload Transcription document
    // let folderID = process.env.BOX_FOLDER_ID; 

    // Grab folderID from function parameter

    const folderID = folderId;
    console.log("Inside TranscribeDoc - folderID: " + folderID);

    let textDoc = "";
    data.videos[0].insights.transcript.forEach(tr => {
        if (tr.text.trim()) {
            textDoc += `Speaker ${tr.speakerId} : \xa0\xa0\xa0\xa0\xa0\xa0\xa0\xa0 ${tr.text} \n`
        }
    })
    textDoc += 'END OF RECORDING';

    console.log(textDoc);
    const textRuns = textDoc.split("\n").map(line => new TextRun({ break: 1, text: line }));
    const paragraph = new Paragraph({
        children: textRuns, border: {
            left: {
                color: "auto",
                space: 1,
                style: "double",
                size: 8
            },
            right: {
                color: "auto",
                space: 1,
                style: "single",
                size: 8
            }
        }
    });


    const doc = new Document({
        sections: [{
            children: [paragraph],
        }
        ]
    });
    const vidID = data.videosRanges.videoId;

    Packer.toBase64String(doc).then((string) => {
        let base64Content = string; // your base64 content
        let base64Buffer = Buffer.from(base64Content, 'base64');
        // we are using just Readable to create a stream, but you can use any library you want
        let stream = new Readable()
        stream._read = () => {
            stream.push(base64Buffer);
            stream.push(null);
        };
        // you have to pass options and define content length
        let options = {
            content_length: Buffer.byteLength(base64Content, 'base64')
        };

        // `${tempFileName}.docx`
        
        appUserClient.files.uploadFile(folderID, `${filename}.docx`, stream, options).then(file => {
        });
    });

}

module.exports.TranscribeDoc = TranscribeDoc; 