// Every image format starts with fixed bytes (its "magic bytes"). Checking them stops a file that only
// claims to be an image in its Content-Type header, such as a renamed PDF or script.

/** The first bytes of each image type the upload route accepts. `null` = any byte at that place. */
const SIGNATURES = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  // "RIFF", 4 bytes of file size, then "WEBP".
  "image/webp": [[0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50]],
  // "GIF87a" or "GIF89a".
  "image/gif": [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
  ],
};

/** True when `bytes` (a Buffer) really starts like an image of `mimeType`. Unknown types are false. */
export function hasImageSignature(bytes, mimeType) {
  const signatures = SIGNATURES[mimeType];
  if (!signatures || !Buffer.isBuffer(bytes)) return false;
  return signatures.some((signature) =>
    bytes.length >= signature.length && signature.every((byte, i) => byte === null || bytes[i] === byte));
}
