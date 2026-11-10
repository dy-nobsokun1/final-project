import jwt from "jsonwebtoken";
import { config } from "../config.js";

// Login sessions are stateless JWTs sent as "Authorization: Bearer <token>".

const EXPIRES_IN = "7d";

export function signToken(userId) {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: EXPIRES_IN });
}

/** Who the token belongs to and when it was issued (iat, in whole seconds). Throws if it is invalid or expired. */
export function verifyToken(token) {
  // Only the algorithm signToken uses (jsonwebtoken's default), so no token signed another way is accepted.
  const payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] });
  return { userId: payload.sub, issuedAt: payload.iat };
}
