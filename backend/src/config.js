// All settings come from environment variables (see .env.example).
// Failing fast here beats a confusing error on the first request.

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}. Copy .env.example to .env.`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
  // Optional: the email account that sends verification links (see .env.example).
  // Without it, the links are printed to the server log instead.
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM ?? `UniSwap <${process.env.SMTP_USER}>`,
  },
  // Optional services. Each one stays switched off until its keys are set (see .env.example).
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    botUsername: process.env.TELEGRAM_BOT_USERNAME,
  },
  bakong: {
    token: process.env.BAKONG_TOKEN,
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    // Free tier, checked 26 Oct 2026: 15 requests a minute. gemini-3.6-flash allows only 20 a day,
    // and gemini-3.8-flash did not answer at all.
    model: process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite",
  },
};
