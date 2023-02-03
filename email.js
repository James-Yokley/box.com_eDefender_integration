const nodemailer = require("nodemailer");

function sendErrorEmail(e) {
    let transporter = nodemailer.createTransport({
        service: 'outlook',
        auth: {
            user: process.env.FROM_EMAIL,
            pass: process.env.FROM_EMAIL_PASS
        }
    });
    
    let mailOptions = {
        from: process.env.FROM_EMAIL,
        to: process.env.TO_EMAIL,
        subject: `${e}`,
        text: `An error occurred during the transcription attempt.\n\nStack trace:\n${e.stack}\n\n${JSON.stringify(e)}`
    };
    
    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
}

module.exports.sendErrorEmail = sendErrorEmail;