const CLOUDINARY_CLOUD_NAME = "doraffjvp";
const CLOUDINARY_UPLOAD_PRESET = "outsyde_unsigned";

interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
  format: string;
  width: number;
  height: number;
  resource_type?: string;
  duration?: number;
}

export interface VideoUploadResult {
  url: string;
  thumbnailUrl: string;
  duration?: number;
  width?: number;
  height?: number;
}

// Generate Cloudinary thumbnail URL from video URL
export function getVideoThumbnailUrl(videoUrl: string, width: number = 400): string {
  if (!videoUrl.includes("/video/upload/")) {
    return videoUrl;
  }
  // Insert transformation: get first frame as JPG
  const thumbnailUrl = videoUrl.replace("/video/upload/", `/video/upload/so_0,f_jpg,w_${width}/`);
  return thumbnailUrl.replace(/\.(mp4|mov|webm|avi|mkv|m4v|3gp)$/i, ".jpg");
}

export async function uploadImageToCloudinary(
  imageUri: string,
  folder: string = "profiles"
): Promise<string> {
  const formData = new FormData();

  const uriParts = imageUri.split(".");
  const fileType = uriParts[uriParts.length - 1];

  formData.append("file", {
    uri: imageUri,
    type: `image/${fileType === "jpg" ? "jpeg" : fileType}`,
    name: `upload.${fileType}`,
  } as any);

  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Cloudinary] Upload failed:", errorText);
    throw new Error(`Image upload failed: ${response.status}`);
  }

  const data: CloudinaryUploadResponse = await response.json();
  console.log("[Cloudinary] Upload successful:", data.secure_url);
  return data.secure_url;
}

export async function uploadVideoToCloudinary(
  videoUri: string,
  folder: string = "videos",
  providedMimeType?: string | null
): Promise<string> {
  const formData = new FormData();

  // Try to get file extension from URI, but iOS often uses cache URIs without extensions
  const uriParts = videoUri.split(".");
  let fileType = uriParts.length > 1 ? uriParts[uriParts.length - 1].toLowerCase() : "";
  
  // Clean up file type (remove query params if any)
  if (fileType.includes("?")) {
    fileType = fileType.split("?")[0];
  }

  const mimeTypes: Record<string, string> = {
    mp4: "video/mp4",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    mkv: "video/x-matroska",
    webm: "video/webm",
    m4v: "video/x-m4v",
    "3gp": "video/3gpp",
  };

  // Determine MIME type: prefer provided mimeType, then lookup by extension, then default to mp4
  let mimeType = providedMimeType || mimeTypes[fileType] || "video/mp4";
  
  // Determine file extension from MIME type if we don't have one
  if (!fileType || !mimeTypes[fileType]) {
    if (mimeType === "video/quicktime" || mimeType === "video/mov") {
      fileType = "mov";
    } else if (mimeType === "video/mp4") {
      fileType = "mp4";
    } else {
      fileType = "mp4"; // Default extension
    }
  }

  console.log("[Cloudinary] Video upload - URI:", videoUri.substring(0, 80) + "...");
  console.log("[Cloudinary] Video upload - Detected/provided mimeType:", mimeType, "extension:", fileType);

  formData.append("file", {
    uri: videoUri,
    type: mimeType,
    name: `upload.${fileType}`,
  } as any);

  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", folder);

  // Use auto resource type endpoint to let Cloudinary detect the file type
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
    {
      method: "POST",
      body: formData,
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Cloudinary] Video upload failed:", errorText);
    
    // Check if preset doesn't support videos
    if (errorText.includes("not allowed") || errorText.includes("resource_type")) {
      throw new Error(
        "Video uploads are not enabled. Please update your Cloudinary upload preset to allow videos, or contact support."
      );
    }
    throw new Error(`Video upload failed: ${response.status}`);
  }

  const data: CloudinaryUploadResponse = await response.json();
  console.log("[Cloudinary] Video upload successful:", data.secure_url);
  return data.secure_url;
}

// Upload video and return full metadata including thumbnail URL
export async function uploadVideoWithMetadata(
  videoUri: string,
  folder: string = "videos",
  providedMimeType?: string | null
): Promise<VideoUploadResult> {
  const formData = new FormData();

  const uriParts = videoUri.split(".");
  let fileType = uriParts.length > 1 ? uriParts[uriParts.length - 1].toLowerCase() : "";
  
  if (fileType.includes("?")) {
    fileType = fileType.split("?")[0];
  }

  const mimeTypes: Record<string, string> = {
    mp4: "video/mp4",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    mkv: "video/x-matroska",
    webm: "video/webm",
    m4v: "video/x-m4v",
    "3gp": "video/3gpp",
  };

  let mimeType = providedMimeType || mimeTypes[fileType] || "video/mp4";
  
  if (!fileType || !mimeTypes[fileType]) {
    if (mimeType === "video/quicktime" || mimeType === "video/mov") {
      fileType = "mov";
    } else if (mimeType === "video/mp4") {
      fileType = "mp4";
    } else {
      fileType = "mp4";
    }
  }

  console.log("[Cloudinary] Video upload with metadata - URI:", videoUri.substring(0, 80) + "...");
  console.log("[Cloudinary] Video upload - mimeType:", mimeType, "extension:", fileType);

  formData.append("file", {
    uri: videoUri,
    type: mimeType,
    name: `upload.${fileType}`,
  } as any);

  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
    {
      method: "POST",
      body: formData,
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Cloudinary] Video upload failed:", errorText);
    
    if (errorText.includes("not allowed") || errorText.includes("resource_type")) {
      throw new Error(
        "Video uploads are not enabled. Please update your Cloudinary upload preset to allow videos."
      );
    }
    throw new Error(`Video upload failed: ${response.status}`);
  }

  const data: CloudinaryUploadResponse = await response.json();
  const thumbnailUrl = getVideoThumbnailUrl(data.secure_url);
  
  console.log("[Cloudinary] Video upload with metadata successful:", {
    url: data.secure_url,
    thumbnailUrl,
    duration: data.duration,
  });
  
  return {
    url: data.secure_url,
    thumbnailUrl,
    duration: data.duration,
    width: data.width,
    height: data.height,
  };
}
