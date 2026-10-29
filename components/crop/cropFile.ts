/**
 * Crop a photo file to a shape without showing the crop screen (photo ratios step 2b).
 * Used for the other photos of a multi-photo post: they start centered in photo 1's shape, or
 * where the person moved them. Same decode size, output sizes and JPEG quality as ImageCropper.
 */
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import {
  centerRectFraction,
  outputSizeFor,
  rectFractionOf,
  rectFromFraction,
  type FracRect,
} from "@/utils/crop/cropMath";
import type { CropResult } from "./ImageCropper";

const DECODE_MAX = 2400;

export async function cropPhotoToFile(
  uri: string,
  aspect: number,
  fraction?: FracRect | null,
): Promise<CropResult> {
  const upright = await ImageManipulator.manipulate(uri, {
    maxWidth: DECODE_MAX,
    maxHeight: DECODE_MAX,
  }).renderAsync();
  const size = { width: upright.width, height: upright.height };
  const rect = rectFromFraction(
    fraction ?? centerRectFraction(size, aspect),
    size,
  );
  const out = outputSizeFor({ width: rect.width, height: rect.height }, aspect);
  const ref = await ImageManipulator.manipulate(upright)
    .crop(rect)
    .resize(out)
    .renderAsync();
  const saved = await ref.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.85,
  });
  return {
    uri: saved.uri,
    width: Math.round(saved.width),
    height: Math.round(saved.height),
    aspect,
    fraction: rectFractionOf(rect, size),
  };
}
