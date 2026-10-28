// Throw one of these from a route to send a clean JSON error with the right status code.
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
