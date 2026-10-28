import nodemailer from "nodemailer";
import { config } from "../config.js";
import { CODE_MINUTES } from "./verificationCode.js";

// Sends email through the SMTP account set in .env: school Outlook (Microsoft 365) or Gmail.
const { host, port, user, pass, from } = config.smtp;

export const isEmailConfigured = Boolean(host && user && pass);

// Port 465 uses TLS from the first byte. Other ports (587) start plain and upgrade with STARTTLS;
// requireTLS refuses to send the password at all if that upgrade fails.
export const transporter = isEmailConfigured
  ? nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user, pass },
  })
  : null;

export async function sendEmail({ to, subject, text, html }) {
  if (!transporter) {
    throw new Error("Email is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS in .env.");
  }
  return transporter.sendMail({ from, to, subject, text, html });
}

// Names are typed by users, so they are escaped before going into HTML.
export function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

// The sign-up email has no link and no web address anywhere, not even as plain text: a link to a
// free tunnel domain sent it to school Outlook's Junk folder, and Outlook turns plain-text addresses
// into links too. The code is typed on the page that asked for it.
export function sendVerificationEmail({ to, name, code }) {
  const intro = "Your UniSwap verification code is:";
  const outro = `Type it on the UniSwap page that asked for it. It works for ${CODE_MINUTES} minutes.`;
  const ignore = "If you did not sign up for UniSwap, you can ignore this email.";
  return sendEmail({
    to,
    subject: `${code} is your UniSwap code`,
    // Plain-text version for mail apps that do not show HTML.
    text: `Hi ${name},\n\n${intro} ${code}\n\n${outro}\n\n${ignore}`,
    html: `<p>Hi ${escapeHtml(name)},</p>
<p>${intro}</p>
<p style="font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; margin: 16px 0;">${code}</p>
<p>${outro}</p>
<p>${ignore}</p>`,
  });
}

export function sendPasswordResetEmail({ to, name, link }) {
  return sendEmail({
    to,
    subject: "Reset your UniSwap password",
    text: `Hi ${name},\n\nSomeone asked to reset the password of your UniSwap account. `
      + `Choose a new one (the link works for 1 hour):\n${link}\n\n`
      + "If you did not ask for this, ignore this email: your password stays the same.",
    html: `<p>Hi ${escapeHtml(name)},</p>
<p>Someone asked to reset the password of your UniSwap account. Choose a new one (the link works for 1 hour):</p>
<p><a href="${link}">Choose a new password</a></p>
<p>If you did not ask for this, ignore this email: your password stays the same.</p>`,
  });
}
