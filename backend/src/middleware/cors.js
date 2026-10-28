import { config } from "../config.js";

// Lets the Next.js frontend (a different origin/port) call this API from the browser.
// Written by hand instead of adding the `cors` package, since we only need one origin.
export function cors(req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", config.frontendOrigin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
}
