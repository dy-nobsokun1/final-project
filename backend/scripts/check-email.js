// Checks the email settings in .env by logging in to the mail server and sending one test email.
// Run: npm run email:test -- someone@aupp.edu.kh   (without an address it sends to SMTP_USER)
import { config } from "../src/config.js";
import { isEmailConfigured, sendEmail, transporter } from "../src/utils/email.js";

if (!isEmailConfigured) {
  console.error("Email is not configured: set SMTP_HOST, SMTP_USER and SMTP_PASS in backend/.env.");
  process.exit(1);
}

const to = process.argv[2] ?? config.smtp.user;
try {
  await transporter.verify(); // connects and logs in, without sending anything
  console.log(`Logged in to ${config.smtp.host}:${config.smtp.port} as ${config.smtp.user}.`);
  const info = await sendEmail({
    to,
    subject: "UniSwap test email",
    text: "If you can read this, the UniSwap API can send email.",
  });
  console.log(`Sent to ${to} (message id ${info.messageId}). Check the inbox and the Junk folder.`);
} catch (error) {
  // `response` is the mail server's own explanation, e.g. why a login was refused.
  console.error(`Failed: ${error.response ?? error.message}`);
  process.exitCode = 1;
}
