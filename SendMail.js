import nodemailer from 'nodemailer'

async function SendMail(OTP, email){

const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: "smtp.gmail.com",
  port: 465,
  auth: {
    // TODO: replace `user` and `pass` values from <https://forwardemail.net>
    user: "techgrowerchannel",
    pass: "jtdx rkxz qolz ndzb",
  },
});

const info = await transporter.sendMail({
    from: '"Tushar" <techgrower.com>', // sender address
    to: email, // list of receivers
    subject: "Account Verify", // Subject line
    text: "Hello world?", // plain text body
    html: `<b>Your Verification Code for IG Clone is ${OTP}</b>`, // html body
  });

  console.log("Message sent: %s", info.messageId);

}

export { SendMail }