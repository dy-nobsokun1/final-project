// Input validation. Pure functions with no database access, so they are easy to unit test.
// The allowed values mirror frontend/src/types/index.ts and the CHECK constraints in schema.sql.

export const CATEGORIES = ["textbooks", "electronics", "furniture", "clothing", "bikes", "other"];
export const CONDITIONS = ["new", "like_new", "good", "fair"];
export const LISTING_TYPES = ["sale", "buy_request", "trade", "giveaway", "auction"];

/** Longest an auction may run. */
export const MAX_AUCTION_DAYS = 30;
export const STATUSES = ["active", "reserved", "sold", "traded"];

const CAMPUS_EMAIL = /^[^\s@]+@([a-z0-9-]+\.)+edu\.kh$/i;

/** Only campus addresses ending in .edu.kh may register (proposal, Functional Requirements). */
export function isCampusEmail(email) {
  return typeof email === "string" && CAMPUS_EMAIL.test(email.trim());
}

/** One password rule for sign-up, reset and change, so all three say the same thing. Null when it is fine. */
export function passwordError(password) {
  if (typeof password !== "string" || password.length < 8) return "Password must be at least 8 characters.";
  return null;
}

export function validateRegistration({ name, email, password, major, graduationYear }) {
  const errors = {};
  if (typeof name !== "string" || !name.trim()) errors.name = "Name is required.";
  if (!isCampusEmail(email)) errors.email = "Use your campus email (ending in .edu.kh).";
  const problem = passwordError(password);
  if (problem) errors.password = problem;
  // Optional profile fields.
  if (major !== undefined && typeof major !== "string") errors.major = "Major must be text.";
  if (graduationYear !== undefined && graduationYear !== null && !Number.isInteger(graduationYear)) {
    errors.graduationYear = "Graduation year must be a whole number.";
  }
  return errors;
}

function isMoney(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** Most photos one listing can have. The first one is the cover. Also a CHECK in schema.sql. */
export const MAX_PHOTOS = 6;

// A generated file name: letters, digits, _, - and / (Cloudinary adds a version and a folder), then one
// of the extensions routes/uploads.js gives files. No ".", "?" or "#" before the extension, so the URL
// cannot climb folders or carry extra parts.
const UPLOADED_FILE = /^[\w/-]+\.(jpg|png|webp|gif)$/;

/** True for a photo URL that this API's upload route could have returned: `prefix` then a generated file name. */
export function isUploadedPhotoUrl(url, prefix) {
  return typeof url === "string" && typeof prefix === "string" && url.length <= 300
    && url.startsWith(prefix) && UPLOADED_FILE.test(url.slice(prefix.length));
}

/**
 * Checks a listing body. With `partial: true` (PATCH) only the fields present are checked.
 * Returns an object of field -> message; empty means valid.
 * - `photoPrefix`: where our uploads live right now (uploadedPhotoPrefix in routes/uploads.js). A new
 *   photo URL must start with it. Without it no new photo URL is accepted, so a forgotten option fails closed.
 * - `currentPhotos`: the photos the listing already has, which an edit may keep even if they are not
 *   uploads (e.g. the demo pictures in db-seed.js).
 */
export function validateListing(body, { partial = false, photoPrefix, currentPhotos = [] } = {}) {
  const errors = {};
  const has = (field) => body[field] !== undefined;
  const check = (field, ok, message) => {
    if ((has(field) || !partial) && !ok) errors[field] = message;
  };

  check("title", typeof body.title === "string" && body.title.trim().length > 0
    && body.title.length <= 120, "Title is required (max 120 characters).");
  check("category", CATEGORIES.includes(body.category), `Category must be one of: ${CATEGORIES.join(", ")}.`);
  check("condition", CONDITIONS.includes(body.condition), `Condition must be one of: ${CONDITIONS.join(", ")}.`);

  if (has("description") && typeof body.description !== "string") {
    errors.description = "Description must be text.";
  }
  if (has("listingType") && !LISTING_TYPES.includes(body.listingType)) {
    errors.listingType = `Listing type must be one of: ${LISTING_TYPES.join(", ")}.`;
  }
  if (has("price") && !isMoney(body.price)) errors.price = "Price must be a number >= 0.";
  if (has("cashTopup") && body.cashTopup !== null && !isMoney(body.cashTopup)) {
    errors.cashTopup = "Cash top-up must be a number >= 0.";
  }
  if (has("imageUrls")) {
    const urls = body.imageUrls;
    if (!Array.isArray(urls) || !urls.every((url) => typeof url === "string")) {
      errors.imageUrls = "Image URLs must be a list of strings.";
    } else if (urls.length > MAX_PHOTOS) {
      errors.imageUrls = `A listing can have at most ${MAX_PHOTOS} photos.`;
    } else if (new Set(urls).size < urls.length) {
      errors.imageUrls = "Each photo can only be added once.";
    } else if (urls.some((url) => !currentPhotos.includes(url) && !isUploadedPhotoUrl(url, photoPrefix))) {
      // A new photo must be one of our own uploads: an image on another site could track who views the listing.
      errors.imageUrls = "Photos must be uploaded through UniSwap.";
    }
  }
  if (has("status") && !STATUSES.includes(body.status)) {
    errors.status = `Status must be one of: ${STATUSES.join(", ")}.`;
  }

  // Auctions: an end time in the future (at most MAX_AUCTION_DAYS away) and a positive minimum raise.
  if (has("auctionEndsAt") && !isValidAuctionEnd(body.auctionEndsAt)) {
    errors.auctionEndsAt = `Auction end must be a future date within ${MAX_AUCTION_DAYS} days.`;
  }
  if (!partial && body.listingType === "auction" && !has("auctionEndsAt")) {
    errors.auctionEndsAt = "An auction needs an end date and time.";
  }
  if (has("minIncrement") && !(isMoney(body.minIncrement) && body.minIncrement > 0)) {
    errors.minIncrement = "Minimum raise must be a number above 0.";
  }
  return errors;
}

function isValidAuctionEnd(value, now = Date.now()) {
  const time = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(time) && time > now && time <= now + MAX_AUCTION_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * The smallest bid the API will accept: the starting price for the first bid,
 * then the current highest bid plus the minimum raise.
 */
export function minimumNextBid({ startingPrice, highestBid, minIncrement }) {
  return highestBid === null ? startingPrice : highestBid + minIncrement;
}

// A Bakong account ID is "name@bank", e.g. sokunth@aclb or 012345678@wing. KHQR allows 32 characters.
const BAKONG_ACCOUNT_ID = /^[a-z0-9._-]+@[a-z0-9]+$/i;

/** True for something shaped like a Bakong account ID. Only Bakong knows whether it really exists. */
export function isBakongAccountId(value) {
  return typeof value === "string" && value.length <= 32 && BAKONG_ACCOUNT_ID.test(value);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a UUID, the form of every id in the database. Lets a route refuse a bad id early. */
export function isUuid(value) {
  return typeof value === "string" && UUID.test(value);
}

/** Longest review comment, in characters. */
export const MAX_REVIEW_LENGTH = 1000;

/** A review says who it is about, gives 1 to 5 whole stars, and may add a short comment. */
export function validateReview({ revieweeId, rating, comment }) {
  const errors = {};
  if (typeof revieweeId !== "string" || !revieweeId) errors.revieweeId = "Say who you are reviewing.";
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    errors.rating = "Rating must be a whole number from 1 to 5.";
  }
  if (comment !== undefined && (typeof comment !== "string" || comment.length > MAX_REVIEW_LENGTH)) {
    errors.comment = `Comment must be text of at most ${MAX_REVIEW_LENGTH} characters.`;
  }
  return errors;
}

function toNumber(value) {
  if (value === undefined || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

/** Turns browse query-string params into a clean filter object. Unknown values are ignored. */
export function parseListingFilters(query) {
  const pick = (value, allowed) => (allowed.includes(value) ? value : undefined);
  return {
    query: typeof query.query === "string" && query.query.trim() ? query.query.trim() : undefined,
    category: pick(query.category, CATEGORIES),
    condition: pick(query.condition, CONDITIONS),
    listingType: pick(query.type, LISTING_TYPES),
    status: pick(query.status, STATUSES) ?? "active",
    minPrice: toNumber(query.minPrice),
    maxPrice: toNumber(query.maxPrice),
  };
}
