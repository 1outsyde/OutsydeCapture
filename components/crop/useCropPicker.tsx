/**
 * Pick (library or camera) then crop, Instagram style (photo ratios build, step 2a).
 *
 *   const crop = useCropPicker();
 *   const result = await crop.pick("library", CROP_PRESETS.product);
 *   if (result) upload(result.uri)
 *   ...
 *   return <>{...}{crop.cropper}</>;
 *
 * The caller renders `crop.cropper` inside its own tree, so the cropper also opens correctly from
 * inside another Modal (iOS will not show a second, sibling Modal).
 *
 * The system picker is opened WITHOUT allowsEditing: its own crop is always square on iOS and can't
 * be resized, so our cropper replaces it.
 */
import React, { useCallback, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import ImageCropper, { type CropResult, type CropShape } from "./ImageCropper";

export type CropPreset = { aspect: number; shape: CropShape; title: string };

/** The shapes decided for Outsyde uploads. */
export const CROP_PRESETS = {
  product: { aspect: 4 / 5, shape: "rect", title: "Product photo" },
  service: { aspect: 1, shape: "rect", title: "Service photo" },
  cover: { aspect: 16 / 9, shape: "rect", title: "Cover photo" },
  logo: { aspect: 1, shape: "circle", title: "Logo" },
  profile: { aspect: 1, shape: "circle", title: "Profile photo" },
  square: { aspect: 1, shape: "rect", title: "Crop photo" },
} as const satisfies Record<string, CropPreset>;

export type CropSource = "library" | "camera";

const PICKER_CLOSE_DELAY_MS = 350;

export function useCropPicker() {
  const [state, setState] = useState<{
    uri: string;
    preset: CropPreset;
  } | null>(null);
  const resolver = useRef<((r: CropResult | null) => void) | null>(null);

  const finish = useCallback((r: CropResult | null) => {
    const resolve = resolver.current;
    resolver.current = null;
    setState(null);
    resolve?.(r);
  }, []);

  /** Crops a photo the caller already has (for example from its own camera screen). */
  const cropUri = useCallback(
    (uri: string, preset: CropPreset): Promise<CropResult | null> => {
      resolver.current?.(null);
      return new Promise((resolve) => {
        resolver.current = resolve;
        setState({ uri, preset });
      });
    },
    [],
  );

  const pick = useCallback(
    async (
      source: CropSource,
      preset: CropPreset,
    ): Promise<CropResult | null> => {
      const perm =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert(
          "Permission Required",
          source === "camera"
            ? "Please allow camera access to take a photo."
            : "Please allow access to your photo library to upload images.",
        );
        return null;
      }
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ["images"],
              quality: 1,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              quality: 1,
            });
      if (result.canceled || !result.assets?.[0]?.uri) return null;
      // iOS: let the system picker finish closing before our Modal opens, or the Modal can
      // fail to present.
      if (Platform.OS === "ios")
        await new Promise((r) => setTimeout(r, PICKER_CLOSE_DELAY_MS));
      return cropUri(result.assets[0].uri, preset);
    },
    [cropUri],
  );

  const cropper = (
    <ImageCropper
      visible={!!state}
      sourceUri={state?.uri ?? null}
      aspect={state?.preset.aspect ?? 1}
      shape={state?.preset.shape ?? "rect"}
      title={state?.preset.title}
      onCancel={() => finish(null)}
      onDone={(r) => finish(r)}
    />
  );

  return { pick, cropUri, cropper, isCropping: !!state };
}
