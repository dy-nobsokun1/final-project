/** The long side of the photo sent to "Fill in from photo": enough to recognise an item, and small to send. */
const LONG_SIDE = 1024;
const JPEG_QUALITY = 0.85;

/**
 * Draws a picked photo on a canvas at most LONG_SIDE pixels on its long side and returns it as a JPEG
 * (usually 100 to 250 KB). No package: the browser decodes and encodes it. A white background first,
 * so a see-through PNG does not turn black. Throws if the browser cannot read the file (e.g. HEIC in Chrome).
 */
export async function shrinkPhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, LONG_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot shrink photos.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The photo could not be shrunk."))), "image/jpeg", JPEG_QUALITY);
  });
}
