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

  const response = await fetch(
    `${API_BASE_URL}/api/media/upload-image`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Image upload failed");
  }

  const result = await response.json();
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
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
    },
    body: { uri } as any,
  });

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
