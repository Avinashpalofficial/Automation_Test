import nodemailer from "nodemailer";

interface SendEmailOptions {
  email: string;
  subject: string;
  message: string;
  text: string;
}

export const sendEmail = async (options: SendEmailOptions) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST!,
      port: Number(process.env.MAIL_PORT!),
      auth: {
        user: process.env.MAIL_USER!,
        pass: process.env.MAIL_PASS!,
      },
    });

    const mailOptions = {
      from: process.env.MAIL_USER!,
      to: options.email,
      subject: options.subject,
      html: options.message,
      text: options.text,
    };

    const information = await transporter.sendMail(mailOptions);

    console.log("Email sent:", information.messageId);
  } catch (error) {
    console.error("Error sending email:", error);
  }
};
