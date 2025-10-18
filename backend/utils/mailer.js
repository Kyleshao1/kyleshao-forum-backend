import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 465,
  secure: true,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

export default async function sendMail(to, subject, text){
  await transporter.sendMail({
    from: `"Discussion Forum" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text
  });
}
