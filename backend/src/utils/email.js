import nodemailer from "nodemailer";
import { config } from "../config.js";

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

export function sendVerificationEmail({ to, name, link }) {
  return sendEmail({
    to,
    subject: "Verify your UniSwap account",
    // Plain-text version for mail apps that do not show HTML.
    text: `Hi ${name},\n\nConfirm your campus email to get the verified student badge on UniSwap:\n${link}\n\n`
      + "If you did not create this account, you can ignore this email.",
    html: `<p>Hi ${escapeHtml(name)},</p>
<p>Confirm your campus email to get the verified student badge on UniSwap:</p>
<p><a href="${link}">Verify my email</a></p>
<p>If you did not create this account, you can ignore this email.</p>`,
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
