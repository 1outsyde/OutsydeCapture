import { API_BASE_URL } from "./api";

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export interface ImageUploadResult {
  url: string;
  width: number;
  height: number;
  type: "image";
}

export interface VideoUploadResult {
  url: string;
  uploadId: string;
  type: "video";
  thumbnailUrl?: string;
}

export type MediaUploadResult = ImageUploadResult | VideoUploadResult;

/**
 * File uploads go through React Native's XMLHttpRequest, not fetch.
 *
 * Expo SDK 57 replaces the global fetch with expo/fetch, whose FormData converter rejects
 * React Native file parts ({ uri, name, type }) and throws "Unsupported FormDataPart
 * implementation". SDK 57 keeps React Native's FormData and XMLHttpRequest, so XHR uploads
 * work on SDK 54 (the store app today) and SDK 57 (Expo Go, and the app after the upgrade).
 */
type XhrResult = { ok: boolean; status: number; json: any };

function xhrUpload(
  method: "POST" | "PUT",
  url: string,
  body: any,
  headers: Record<string, string>,
  onProgress?: (progress: UploadProgress) => void
): Promise<XhrResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }
    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          onProgress({
            loaded: event.loaded,
            total: event.total,
            percent: Math.round((event.loaded / event.total) * 100),
          });
        }
      };
    }
    xhr.onload = () => {
      let json: any = null;
      try {
        json = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        json = null;
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, json });
    };
    xhr.onerror = () => reject(new Error("Network request failed"));
    xhr.ontimeout = () => reject(new Error("Network request timed out"));
    xhr.send(body);
  });
}

export async function uploadImage(
  uri: string,
  mimeType: string = "image/jpeg",
  folder: string = "posts",
  authToken: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<ImageUploadResult> {
  const filename = uri.split("/").pop() || "upload.jpg";

  const formData = new FormData();
  formData.append("file", {
    uri,
    name: filename,
    type: mimeType,
  } as any);
  formData.append("folder", folder);

  const response = await xhrUpload(
    "POST",
    `${API_BASE_URL}/api/media/upload-image`,
    formData,
    { Authorization: `Bearer ${authToken}` },
    onProgress
  );

  if (!response.ok) {
    throw new Error(response.json?.error || "Image upload failed");
  }

  const result = response.json || {};
  return {
    url: result.url,
    width: result.width || 0,
    height: result.height || 0,
    type: "image",
  };
}

export async function uploadVideo(
  uri: string,
  mimeType: string = "video/mp4",
  authToken: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<VideoUploadResult> {
  // Step 1: Get Mux upload URL from backend
  const urlResponse = await fetch(
    `${API_BASE_URL}/api/media/video-upload-url`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!urlResponse.ok) {
    const error = await urlResponse.json().catch(() => ({}));
    throw new Error(error.error || "Failed to get video upload URL");
  }

  const { uploadUrl, uploadId } = await urlResponse.json();

  // Step 2: Upload directly to Mux
  // React Native XHR accepts a { uri } body and streams the local file (see xhrUpload).
  const uploadResponse = await xhrUpload(
    "PUT",
    uploadUrl,
    { uri },
    { "Content-Type": mimeType },
    onProgress
  );

  if (!uploadResponse.ok) {
    throw new Error("Video upload to Mux failed");
  }

  return {
    url: uploadId,
    uploadId,
    type: "video",
    thumbnailUrl: undefined,
  };
}
