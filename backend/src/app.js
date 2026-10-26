import express from "express";
import { query } from "./db/pool.js";
import { cors } from "./middleware/cors.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { assistantRouter } from "./routes/assistant.js";
import { authRouter } from "./routes/auth.js";
import { bidsRouter } from "./routes/bids.js";
import { khqrRouter } from "./routes/khqr.js";
import { listingsRouter } from "./routes/listings.js";
import { messagesRouter } from "./routes/messages.js";
import { listingOffersRouter, offersRouter } from "./routes/offers.js";
import { paymentsRouter, stripeWebhook } from "./routes/payments.js";
import { listingReviewsRouter, userReviewsRouter } from "./routes/reviews.js";
import { listingSaveRouter, mySavedRouter } from "./routes/saved.js";
import { telegramRouter } from "./routes/telegram.js";
import { UPLOAD_DIR, uploadsRouter } from "./routes/uploads.js";
import { usersRouter } from "./routes/users.js";

// Builds the Express app. Kept separate from server.js so tests can import it without listening.
export const app = express();

app.use(cors);
// Stripe signs the exact bytes it sends, so its webhook gets the raw body, before JSON parsing.
app.post("/api/payments/webhook", express.raw({ type: "application/json", limit: "1mb" }), stripeWebhook);
app.use(express.json({ limit: "1mb" }));

// GET /api/health  -> quick check that the API and the database are both up
app.get("/api/health", async (req, res) => {
  await query("SELECT 1");
  res.json({ status: "ok" });
});

app.use("/api/assistant", assistantRouter);
app.use("/api/auth", authRouter);
app.use("/api/listings/:id/bids", bidsRouter);
app.use("/api/listings/:id/reviews", listingReviewsRouter);
app.use("/api/listings/:id/save", listingSaveRouter);
app.use("/api/listings/:id/offers", listingOffersRouter);
app.use("/api/listings", listingsRouter);
app.use("/api/users/me/telegram", telegramRouter);
app.use("/api/users/me/saved", mySavedRouter);
app.use("/api/users/:id/reviews", userReviewsRouter);
app.use("/api/users", usersRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/offers", offersRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/payments/khqr", khqrRouter);
app.use("/api/payments", paymentsRouter);

// Uploaded listing photos. "nosniff" stops browsers from treating a disguised file as HTML or script.
app.use("/uploads", express.static(UPLOAD_DIR, {
  setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
}));

app.use(notFound);
app.use(errorHandler);
