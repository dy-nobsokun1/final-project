import { KHQR_MESSAGES, readKhqrId, type KhqrIdResult } from "@/lib/khqr/parse";

export const MAX_KHQR_IMAGE_MB = 10;

const MESSAGES = {
  notImage: "Choose an image file, such as a PNG or JPG screenshot of your KHQR.",
  tooBig: `That image is over ${MAX_KHQR_IMAGE_MB} MB. Choose a smaller one.`,
  noQr: "No QR code found in this image. Try a sharper picture or a screenshot with only the QR in it.",
} as const;

// The longest side of each try. A phone screenshot can be thousands of pixels wide, which makes the
// QR's squares too fine for jsQR to follow, so a smaller copy often reads when the full size does not.
const TRY_SIZES = [1600, 1000, 600];

/** The text of the QR in the image, or null. Draws the image on a white canvas, which gives a QR cropped tight to its edge the blank border a reader needs. */
async function decodeAtSize(bitmap: ImageBitmap, longestSide: number): Promise<string | null> {
  const { default: jsQR } = await import("jsqr");
  const scale = Math.min(1, longestSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const margin = Math.max(24, Math.round(Math.min(width, height) * 0.1));

  const canvas = document.createElement("canvas");
  canvas.width = width + 2 * margin;
  canvas.height = height + 2 * margin;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, margin, margin, width, height);

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(pixels.data, pixels.width, pixels.height)?.data ?? null;
}

/**
 * Reads the Bakong account ID from a picture of the seller's KHQR, entirely in the browser: the image
 * is drawn on a canvas and never sent anywhere or stored. The QR's text is never logged.
 */
export async function readKhqrImage(file: File): Promise<KhqrIdResult> {
  if (!file.type.startsWith("image/")) return { error: MESSAGES.notImage };
  if (file.size > MAX_KHQR_IMAGE_MB * 1024 * 1024) return { error: MESSAGES.tooBig };

  // A file the browser cannot draw (a HEIC photo in Chrome, a damaged file) is treated as holding no QR.
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return { error: MESSAGES.noQr };
  try {
    for (const size of TRY_SIZES) {
      const text = await decodeAtSize(bitmap, size);
      if (text !== null) return text ? readKhqrId(text) : { error: KHQR_MESSAGES.notKhqr };
    }
    return { error: MESSAGES.noQr };
  } finally {
    bitmap.close();
  }
}
