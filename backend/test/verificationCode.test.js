import assert from "node:assert/strict";
import { test } from "node:test";

// These modules load config.js, which requires these. Email gets fake SMTP settings, so a
// transporter exists, but its sendMail is replaced below: nothing is ever sent.
process.env.DATABASE_URL ??= "postgres://unused";
process.env.JWT_SECRET = "unit-test-secret";
process.env.SMTP_HOST = "smtp.invalid";
process.env.SMTP_USER = "sender@example.invalid";
process.env.SMTP_PASS = "unused";
const { hashVerificationCode, isCodeFormat, newVerificationCode } = await import("../src/utils/verificationCode.js");
const { sendVerificationEmail, transporter } = await import("../src/utils/email.js");

test("a verification code is six digits, leading zeros kept", () => {
  for (let i = 0; i < 2000; i += 1) assert.match(newVerificationCode(), /^\d{6}$/);
  assert.equal(isCodeFormat("042917"), true);
  for (const bad of ["12345", "1234567", "12345a", " 12345", "", undefined, null, 123456]) {
    assert.equal(isCodeFormat(bad), false);
  }
});

test("the stored hash is keyed with the server's secret, so six digits cannot simply be looked up", () => {
  const hash = hashVerificationCode("123456");
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hash, hashVerificationCode("123456"));
  assert.notEqual(hash, hashVerificationCode("123457"));
  // Plain SHA-256 of "123456" is the same for every site, and so is in every table of common hashes.
  assert.notEqual(hash, "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92");
});

test("the sign-up email carries the code and no link or web address anywhere", async () => {
  let sent;
  transporter.sendMail = async (message) => { sent = message; };
  await sendVerificationEmail({ to: "dara@aupp.edu.kh", name: "Dara", code: "042917" });

  assert.equal(sent.subject, "042917 is your UniSwap code");
  assert.match(sent.text, /Your UniSwap verification code is: 042917/);
  assert.match(sent.text, /30 minutes/);
  assert.match(sent.html, />042917</);
  // Outlook turns plain-text addresses into links too, so none may appear in any part.
  for (const part of [sent.subject, sent.text, sent.html]) {
    assert.doesNotMatch(part, /https?:|:\/\/|www\.|\w\.\w{2,}|<a[\s>]|href|<img/i);
  }
});
