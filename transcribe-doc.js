'use strict';
const { writeFileSync } = require("fs");
const { Document, Packer, Paragraph, AlignmentType, TextRun } = require("docx");


function TranscribeDoc(data) {
    const BoxSDK = require("box-node-sdk");

    const sdkConfig = {
        boxAppSettings: {
            clientID: process.env.BOX_CLIENT_ID,
            clientSecret: process.env.BOX_CLIENT_SECRET
        }
    }
    const sdk = BoxSDK.getPreconfiguredInstance(sdkConfig);
    const client = sdk.getAnonymousClient();
    let textDoc = "";
    let fileName = 'test';
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
    Packer.toBuffer(doc).then((buffer) => {
        writeFileSync(`${fileName}.docx`, buffer);
    })
    //can change the filename from vidID.docx to filename.docx
    //will need to pass folderID for each folder that implements this function 
    client.files.uploadFile(194050929935, `${fileName}.docx`, fs.readFileSync(`${fileName}.docx`));

    fs.unlink('./' + `${vidID}.docx`, (err) => {
        if (err) {
            throw err;
        }
        console.log("Deleted file successfully");
    })
    // Need to use box sdk to write file to the folder

}

module.exports.TranscribeDoc = TranscribeDoc; 