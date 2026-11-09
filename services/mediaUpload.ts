import { AppState } from "react-native";
import { File } from "expo-file-system";
import { API_BASE_URL } from "./api";
import { runResumableUpload, type ChunkResponse } from "@/utils/resumableUpload";

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

/** A piece that hasn't finished in this long is treated as lost and sent again. */
const PIECE_TIMEOUT_MS = 180_000;

/** Sends one piece of a resumable upload. Network trouble resolves { status: null }, never throws. */
function sendPiece(
  url: string,
  bytes: Uint8Array,
  headers: Record<string, string>,
  onPieceProgress: (sent: number) => void,
): Promise<ChunkResponse> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.timeout = PIECE_TIMEOUT_MS;
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }
    if (xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onPieceProgress(event.loaded);
      };
    }
    xhr.onload = () =>
      resolve({ status: xhr.status || null, range: xhr.getResponseHeader("Range") });
    xhr.onerror = () => resolve({ status: null });
    xhr.ontimeout = () => resolve({ status: null });
    // React Native sends a Uint8Array as its raw bytes (convertRequestBody: ArrayBufferView).
    xhr.send(bytes);
  });
}

/** Resolves once the app is in the foreground (iOS pauses the app, and the upload, in the background). */
function waitUntilActive(): Promise<void> {
  if (AppState.currentState === "active") return Promise.resolve();
  return new Promise((resolve) => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        sub.remove();
        resolve();
      }
    });
  });
}

/**
 * Pulse videos (up to 60 minutes): the same Mux direct upload as uploadVideo, but sent in 8 MB
 * pieces so a dropped connection only resends the piece in flight, and an upload paused in the
 * background carries on when the app comes back (Pulse length step B). Fully closing the app
 * still loses it. Same result shape as uploadVideo.
 */
export async function uploadVideoResumable(
  uri: string,
  mimeType: string = "video/mp4",
  authToken: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<VideoUploadResult> {
  const urlResponse = await fetch(`${API_BASE_URL}/api/media/video-upload-url`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!urlResponse.ok) {
    const error = await urlResponse.json().catch(() => ({}));
    throw new Error(error.error || "Failed to get video upload URL");
  }
  const { uploadUrl, uploadId } = await urlResponse.json();

  const handle = new File(uri).open();
  try {
    const total = handle.size ?? 0;
    await runResumableUpload({
      total,
      readChunk: async (start, length) => {
        handle.offset = start;
        return handle.readBytes(length);
      },
      sendChunk: (bytes, headers, onPieceProgress) =>
        sendPiece(uploadUrl, bytes, headers, onPieceProgress),
      contentType: mimeType,
      onProgress,
      waitUntilActive,
    });
  } finally {
    handle.close();
  }

  return {
    url: uploadId,
    uploadId,
    type: "video",
    thumbnailUrl: undefined,
  };
}
