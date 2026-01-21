const CLOUDINARY_CLOUD_NAME = "doraffjvp";
const CLOUDINARY_UPLOAD_PRESET = "outsyde_unsigned";

interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
  format: string;
  width: number;
  height: number;
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
