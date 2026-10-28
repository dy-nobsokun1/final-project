import { HttpError } from "../utils/httpError.js";

// PostgreSQL error codes we translate into friendly HTTP errors.
const PG_UNIQUE_VIOLATION = "23505";
const PG_INVALID_TEXT = "22P02"; // e.g. "abc" passed where a UUID is expected

export function notFound(req, res) {
  res.status(404).json({ error: "Route not found." });
}

// Express recognises an error handler by its four arguments, so `next` must stay.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err.code === PG_UNIQUE_VIOLATION) {
    return res.status(409).json({ error: "That already exists." });
  }
  if (err.code === PG_INVALID_TEXT) {
    return res.status(404).json({ error: "Not found." });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body is not valid JSON." });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "That upload is too large." });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
}
