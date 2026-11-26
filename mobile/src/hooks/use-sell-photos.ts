// The Sell form's photos: pick from the camera or the library, upload each one straight away, keep
// only the addresses. Up to 6 (the API's MAX_PHOTOS); the first one is the cover.
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";

import { errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { uploadPhoto } from "@/lib/upload-photo";

export const MAX_PHOTOS = 6;

// JPEG at quality 0.6 keeps most phone photos under the API's 5 MB limit (upload-photo.ts refuses bigger ones).
const OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.6, base64: true };

export function useSellPhotos() {
  const { token } = useAuth();
  const [urls, setUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(source: "camera" | "library") {
    if (!token || urls.length >= MAX_PHOTOS) return;
    setError(null);
    try {
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new Error("Allow the camera in Settings to take a photo.");
      }
      const result = source === "camera"
        ? await ImagePicker.launchCameraAsync(OPTIONS)
        : await ImagePicker.launchImageLibraryAsync(OPTIONS);
      const base64 = result.canceled ? null : result.assets[0]?.base64;
      if (!base64) return; // the student closed the picker
      setUploading(true);
      const url = await uploadPhoto(base64, token);
      setUrls((current) => [...current, url].slice(0, MAX_PHOTOS));
    } catch (err) {
      setError(errorMessage(err)); // e.g. no camera in the simulator, or the photo is too big
    } finally {
      setUploading(false);
    }
  }

  function remove(url: string) {
    setUrls((current) => current.filter((item) => item !== url));
  }

  function clear() {
    setUrls([]);
    setError(null);
  }

  return { urls, uploading, error, add, remove, clear };
}
