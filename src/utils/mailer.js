import nodemailer from 'nodemailer';

export function createTransportFromEnv() {
  const secure = String(process.env.SMTP_SECURE || 'false') === 'true';
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: Number(process.env.SMTP_PORT || 1025),
    secure,
    auth: (process.env.SMTP_USER && process.env.SMTP_PASS) ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    } : undefined,
  });
  return transporter;
}

export async function sendMail({ to, subject, html }) {
  const transporter = createTransportFromEnv();
  const from = process.env.SMTP_FROM || 'no-reply@example.com';
  return transporter.sendMail({ from, to, subject, html });
}
