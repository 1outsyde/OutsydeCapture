import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Linking,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library/legacy";
import * as Haptics from "expo-haptics";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import apiClient from "@/services/api";
import { uploadImage, uploadVideo } from "@/services/mediaUpload";
import { feedEvents } from "@/services/feedEvents";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import { useCropPicker, type CropPreset } from "@/components/crop/useCropPicker";
import { POST_ASPECT_OPTIONS, type CropResult } from "@/components/crop/ImageCropper";
import { cropPhotoToFile } from "@/components/crop/cropFile";
import { useStoryEditor } from "@/components/crop/StoryEditor";
import { cameraFrameFraction, openAreaFrame, type FracRect } from "@/utils/crop/cropMath";
import { VideoFitPicker } from "@/components/video/VideoFitPicker";
import { defaultVideoFit, type VideoFit } from "@/utils/videoFit";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Most recent library photo as a renderable URI, or null if unavailable. Never throws.
const fetchLatestPhotoUri = async (): Promise<string | null> => {
  try {
    const perm = await MediaLibrary.getPermissionsAsync();
    if (!perm.granted && perm.accessPrivileges !== "limited") return null;
    const { assets } = await MediaLibrary.getAssetsAsync({
      first: 1,
      mediaType: ["photo"],
      sortBy: [MediaLibrary.SortBy.creationTime],
    });
    if (!assets[0]) return null;
    const info = await MediaLibrary.getAssetInfoAsync(assets[0]);
    return info.localUri ?? info.uri ?? null;
  } catch {
    return null;
  }
};

const MAX_POST_PHOTOS = 10;
/**
 * A post photo (photo ratios 2b). `uri` is what's shown: the cropped file once cropped, else the
 * original (shown centered in the post shape, which is exactly what it will be cut to).
 */
type PickedImage = {
  uri: string;
  sourceUri: string;
  cropped: boolean;
  width?: number;
  height?: number;
  fraction?: FracRect;
};
/** The post's shape: picked on photo 1 (or the only photo), shared by every photo. */
type PostShape = { aspect: number; key?: string };
const DEFAULT_POST_SHAPE: PostShape = { aspect: 4 / 5, key: "4:5" };
const CAMERA_FRAME_ASPECT = 4 / 5;
const CAMERA_FRAME_GUTTER = 16;
// Full screen camera layout (points). Top: gap under the status bar, then the 40 pt round buttons.
const CAMERA_TOP_GAP = 8;
const CAMERA_ICON_SIZE = 40;
// Bottom block above the home bar: 12 top + 72 shutter row + 14 gap + 20 mode words.
const CAMERA_BOTTOM_BLOCK = 118;
const CAMERA_CORNER = 18;
// Length chips row on the Post camera (Pulse): 28 pt chips + 10 pt gap above the shutter row.
const CAMERA_CHIPS_BLOCK = 38;
// Story camera recordings and PHOTO hold-to-record: 15 seconds.
const QUICK_RECORD_SECONDS = 15;
// Pulse lengths, TikTok style. PHOTO = tap for a photo, hold for a quick video.
type CaptureChip = "10m" | "60s" | "15s" | "photo";
const CAPTURE_CHIPS: { key: CaptureChip; label: string; seconds: number | null }[] = [
  { key: "10m", label: "10m", seconds: 600 },
  { key: "60s", label: "60s", seconds: 60 },
  { key: "15s", label: "15s", seconds: 15 },
  { key: "photo", label: "PHOTO", seconds: null },
];
// Pulse videos from the library: up to 10 minutes (60 after chunked uploads). The picker reports
// milliseconds; half a second of slack keeps a 10:00.0 clip that reports 10:00.03 from being refused.
const PULSE_MAX_VIDEO_MS = 10 * 60 * 1000 + 500;
const THUMB_HEIGHT = 120;
const POST_CROP_PRESET: CropPreset = { aspect: 4 / 5, shape: "rect", title: "Crop post" };

// iOS: let the system picker finish closing before the crop screen (a Modal) opens.
const waitForPickerToClose = () =>
  Platform.OS === "ios" ? new Promise((r) => setTimeout(r, 350)) : Promise.resolve();

const pickedFromCrop = (sourceUri: string, r: CropResult): PickedImage => ({
  uri: r.uri,
  sourceUri,
  cropped: true,
  width: r.width,
  height: r.height,
  fraction: r.fraction,
});

const shapeFromCrop = (r: CropResult): PostShape => ({ aspect: r.aspect, key: r.aspectKey });

// The final file for a photo: the crop already made, or one made now (centered, or where moved).
const finalizePhoto = async (photo: PickedImage, aspect: number) =>
  photo.cropped && photo.width && photo.height
    ? { uri: photo.uri, width: photo.width, height: photo.height }
    : cropPhotoToFile(photo.sourceUri, aspect, photo.fraction);

const isVideoAsset = (asset: ImagePicker.ImagePickerAsset) =>
  asset.type === "video" || (asset.mimeType?.includes("video") ?? false);

// Story videos are up to 15 seconds (photo ratios 2e). The picker reports milliseconds; the half
// second of slack keeps a 15.0 s clip that reports 15.03 s from being turned away.
const STORY_MAX_VIDEO_MS = 15_500;

export default function CreatePostScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user, getToken } = useAuth();

  const [postImage, setPostImage] = useState<string>("");
  // Multi-photo posts: 2-10 photos picked from the library (photos only). Empty = single media (postImage).
  const [pickedImages, setPickedImages] = useState<PickedImage[]>([]);
  // One-photo post (library or camera): the cropped photo; postImage shows it.
  const [singlePhoto, setSinglePhoto] = useState<PickedImage | null>(null);
  const [postShape, setPostShape] = useState<PostShape>(DEFAULT_POST_SHAPE);
  // Pulse video or video story: Fill or Fit (photo ratios 2d). Set when a video is picked.
  const [videoFit, setVideoFit] = useState<VideoFit>("fill");
  const postCrop = useCropPicker();
  // Photo stories (photo ratios 2e): 9:16 editor, zoom out over a blurred copy, saved 1080 x 1920.
  const storyEditor = useStoryEditor();
  // Camera preview size, to draw the post frame and map it onto the photo.
  const [cameraAreaSize, setCameraAreaSize] = useState<{ width: number; height: number } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [postCaption, setPostCaption] = useState("");
  const [postLayout, setPostLayout] = useState<"pro" | "pulse" | null>(null);
  const [postSaving, setPostSaving] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mode, setMode] = useState<"post" | "story">("post");
  const [storySaving, setStorySaving] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<"front" | "back">("back");
  const cameraRef = useRef<CameraView>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Android only: expo-camera binds the video pipeline only in mode="video" (and the photo
  // pipeline only in "picture"), so a hold switches to video, waits for the camera to
  // re-open, then records. iOS records in the default mode and never uses these.
  const [androidCameraMode, setAndroidCameraMode] = useState<"picture" | "video">("picture");
  const androidCameraReadyRef = useRef<(() => void) | null>(null);
  const androidHoldingRef = useRef(false);
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [thumbUri, setThumbUri] = useState<string | null>(null);
  const [libraryChecked, setLibraryChecked] = useState(false);

  type AttachType = "product" | "service" | "photographerService";
  type AttachItem = { type: AttachType; id: string; name: string; priceCents: number | null };

  const [attachItems, setAttachItems] = useState<AttachItem[]>([]);
  const [attachLoading, setAttachLoading] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [selectedAttach, setSelectedAttach] = useState<{ type: AttachType; id: string } | null>(null);

  const canAttach = user?.role === "business" || user?.role === "photographer";

  const clearPostPhotos = () => {
    setPickedImages([]);
    setSinglePhoto(null);
    setPostShape(DEFAULT_POST_SHAPE);
    setVideoFit("fill");
  };

  const switchMode = (newMode: "post" | "story") => {
    // A tap-started recording leaves the finger free to swipe: keep the mode until it stops.
    if (recordingRef.current) return;
    setMode(newMode);
    setStep(1);
    setPostImage("");
    clearPostPhotos();
    setPostCaption("");
    setSelectedAttach(null);
  };

  // Horizontal swipe on Step 1 only — left = story, right = post
  const modeSwipeGesture = Gesture.Pan()
    .activeOffsetX([-50, 50])
    .onEnd((e) => {
      if (e.translationX < -50) runOnJS(switchMode)("story");
      else if (e.translationX > 50) runOnJS(switchMode)("post");
    });

  // Camera prompt first; the library prompt (iOS, only if undetermined) runs after it resolves.
  useEffect(() => {
    let cancelled = false;
    const requestPermissions = async () => {
      try {
        await requestCameraPermission();
      } catch {}
      if (Platform.OS !== "ios") return;
      try {
        const perm = await MediaLibrary.getPermissionsAsync();
        if (!cancelled && perm.status === MediaLibrary.PermissionStatus.UNDETERMINED) {
          await MediaLibrary.requestPermissionsAsync();
        }
      } catch {}
      if (!cancelled) setLibraryChecked(true);
    };
    requestPermissions();
    return () => {
      cancelled = true;
    };
  }, []);

  // Refresh the gallery thumbnail whenever the user is on step 1.
  useEffect(() => {
    if (step !== 1 || !libraryChecked) return;
    let cancelled = false;
    fetchLatestPhotoUri().then((uri) => {
      if (!cancelled) setThumbUri(uri);
    });
    return () => {
      cancelled = true;
    };
  }, [step, libraryChecked]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    };
  }, []);

  // Post camera length chip (Pulse). Kept while the screen is open.
  const [captureChip, setCaptureChip] = useState<CaptureChip>("photo");
  const chipSeconds = CAPTURE_CHIPS.find((c) => c.key === captureChip)?.seconds ?? null;
  // A length chip in Post mode: tap starts and tap stops recording.
  const tapToRecord = mode === "post" && chipSeconds !== null;
  // The limit of the recording in progress (set when it starts), for the stop and the timer.
  const [recordLimit, setRecordLimit] = useState(QUICK_RECORD_SECONDS);
  const recordLimitRef = useRef(QUICK_RECORD_SECONDS);
  // True while a recording started by a tap is running (a tap stops it; releasing does not).
  const tapRecordingRef = useRef(false);
  // Mirrors isRecording for gesture callbacks, which can hold an older render's value.
  const recordingRef = useRef(false);

  // Recording timer pill. Display only: the stop is recordingTimerRef / maxDuration.
  // Counts only once startRecording runs (on Android, after the switch to video mode).
  const recordLiveRef = useRef(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => {
      if (recordLiveRef.current) {
        setRecordSeconds((n) => Math.min(recordLimitRef.current, n + 1));
      }
    }, 1000);
    return () => {
      clearInterval(id);
      recordLiveRef.current = false;
    };
  }, [isRecording]);

  useEffect(() => {
    if (step !== 3 || attachItems.length > 0 || attachLoading) return;

    const fetchAttachItems = async () => {
      setAttachLoading(true);
      setAttachError(null);
      try {
        const authToken = await getToken();
        if (!authToken) {
          setAttachError("You must be logged in to load your products and services.");
          return;
        }
        if (user?.role === "business") {
          const [productsRes, servicesRes] = await Promise.all([
            apiClient.getVendorProducts(authToken),
            apiClient.getVendorServices(authToken),
          ]);
          const liveProducts: AttachItem[] = productsRes.products
            .filter((product) => product.status === "live")
            .map((product) => ({ type: "product", id: product.id, name: product.name, priceCents: product.priceCents }));
          const liveServices: AttachItem[] = servicesRes.services
            .filter((service) => service.status === "live")
            .map((service) => ({ type: "service", id: service.id, name: service.name, priceCents: service.priceCents }));
          setAttachItems([...liveProducts, ...liveServices]);
        } else if (user?.role === "photographer") {
          const servicesRes = await apiClient.getPhotographerMeServices(authToken);
          const liveServices: AttachItem[] = servicesRes.services
            .filter((service) => service.status === "live")
            .map((service) => ({ type: "photographerService", id: service.id, name: service.name, priceCents: service.priceCents ?? null }));
          setAttachItems(liveServices);
        }
      } catch (error: any) {
        console.error("[CreatePostScreen] Failed to load attach items:", error);
        setAttachError("Couldn't load your products and services. You can still share your post.");
      } finally {
        setAttachLoading(false);
      }
    };

    fetchAttachItems();
  }, [step]);

  const handlePickPostImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to your photo library.");
      return;
    }
    // Multi-select can't crop in the system picker, so our crop screen runs after the pick
    // (photo ratios 2b): photo 1 picks the post's shape, the others follow it.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_POST_PHOTOS,
      orderedSelection: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets || result.assets.length === 0) return;

    const assets = result.assets;
    if (assets.length === 1 && isVideoAsset(assets[0])) {
      if ((assets[0].duration ?? 0) > PULSE_MAX_VIDEO_MS) {
        Alert.alert("Video too long", "Pulse videos can be up to 10 minutes. Pick a shorter one.");
        return;
      }
      // Single video: a Pulse post. Fill for tall videos, Fit for wide ones; changeable on step 2.
      clearPostPhotos();
      setVideoFit(defaultVideoFit(assets[0].width, assets[0].height));
      setPostImage(assets[0].uri);
      setPostLayout("pulse");
      setStep(2);
      return;
    }

    // Several items: photos only for now.
    const photos = assets.filter((a) => !isVideoAsset(a)).slice(0, MAX_POST_PHOTOS);
    if (photos.length < assets.length) {
      Alert.alert(
        "Photos only",
        "Posts with several items can only contain photos for now, so the videos were left out.",
      );
    }
    if (photos.length === 0) return;

    // Photo 1 (or the only photo) picks the post's shape on the crop screen.
    await waitForPickerToClose();
    const first = await postCrop.cropUri(photos[0].uri, POST_CROP_PRESET, {
      aspectOptions: POST_ASPECT_OPTIONS,
      initialAspectKey: DEFAULT_POST_SHAPE.key,
    });
    if (!first) return; // cancelled: nothing picked
    const firstPhoto = pickedFromCrop(photos[0].uri, first);
    setPostShape(shapeFromCrop(first));
    if (photos.length > 1) {
      setSinglePhoto(null);
      setPickedImages([
        firstPhoto,
        // The others start centered in that shape; tap one to move it.
        ...photos.slice(1).map((a) => ({ uri: a.uri, sourceUri: a.uri, cropped: false })),
      ]);
    } else {
      setPickedImages([]);
      setSinglePhoto(firstPhoto);
    }
    setPostImage(firstPhoto.uri);
    setPostLayout("pro");
    setStep(2);
  };

  // Reposition a photo. The only photo and photo 1 can also change the shape; the rest keep it.
  const handleRecropPhoto = async (index: number | "single") => {
    const photo = index === "single" ? singlePhoto : pickedImages[index];
    if (!photo || postSaving) return;
    const setsShape = index === "single" || index === 0;
    const r = await postCrop.cropUri(
      photo.sourceUri,
      setsShape ? POST_CROP_PRESET : { ...POST_CROP_PRESET, aspect: postShape.aspect },
      setsShape
        ? {
            aspectOptions: POST_ASPECT_OPTIONS,
            initialAspectKey: postShape.key,
            // A Free photo reopens at its own shape.
            initialAspect: postShape.aspect,
            initialFraction: photo.fraction,
          }
        : { initialFraction: photo.fraction },
    );
    if (!r) return;
    const next = pickedFromCrop(photo.sourceUri, r);
    if (index === "single") {
      setSinglePhoto(next);
      setPostShape(shapeFromCrop(r));
      setPostImage(next.uri);
      return;
    }
    const shapeChanged = index === 0 && Math.abs(r.aspect - postShape.aspect) > 1e-6;
    if (index === 0) setPostShape(shapeFromCrop(r));
    setPickedImages((prev) =>
      prev.map((p, i) => {
        if (i === index) return next;
        // New shape on photo 1: the others start centered again in it.
        if (shapeChanged) return { uri: p.sourceUri, sourceUri: p.sourceUri, cropped: false };
        return p;
      }),
    );
    if (index === 0) setPostImage(next.uri);
  };

  const handleRemovePickedImage = (index: number) => {
    const remaining = pickedImages.filter((_, i) => i !== index);
    if (remaining.length <= 1) {
      setPickedImages([]);
      setSinglePhoto(remaining[0] ?? null);
      setPostImage(remaining[0]?.uri ?? "");
      if (remaining.length === 0) {
        setPostLayout(null);
        setPostShape(DEFAULT_POST_SHAPE);
        setStep(1);
      }
      return;
    }
    setPickedImages(remaining);
    setPostImage(remaining[0].uri);
  };

  const handlePickStoryMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to your photo library.");
      return;
    }
    // No system crop (it was square, with a trim screen for iPhone videos): photos go to the 9:16
    // story editor, videos to the Fill / Fit step (2d).
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
      videoMaxDuration: 15,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (isVideoAsset(asset)) {
      if ((asset.duration ?? 0) > STORY_MAX_VIDEO_MS) {
        Alert.alert(
          "Video too long",
          "Story videos can be up to 15 seconds. Pick a shorter one.",
        );
        return;
      }
      setPostImage(asset.uri);
      setVideoFit(defaultVideoFit(asset.width, asset.height));
      setPostLayout("pulse");
      setStep(2);
      return;
    }
    await waitForPickerToClose();
    const edited = await storyEditor.edit(asset.uri);
    if (!edited) return; // cancelled: back to step 1
    setPostImage(edited.uri);
    setVideoFit("fill");
    setPostLayout("pro");
    setStep(2);
  };

  const handleShutterTap = async () => {
    // A length chip (Pulse): tap starts a recording, the next tap stops it.
    if (tapRecordingRef.current) {
      await stopRecordingNow();
      return;
    }
    if (tapToRecord && chipSeconds !== null) {
      if (recordingRef.current) return; // a held recording is running
      await beginRecording(chipSeconds, true);
      return;
    }
    if (!cameraPermission?.granted) {
      await requestCameraPermission();
      return;
    }
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
    if (!photo?.uri) return;
    if (mode === "story") {
      // Photo story: the 9:16 story editor (2e). Cancel goes back to the camera.
      const edited = await storyEditor.edit(photo.uri);
      if (!edited) return;
      clearPostPhotos();
      setPostImage(edited.uri);
      setPostLayout("pro");
      setStep(2);
      return;
    }
    // Post: open the crop screen lined up with the frame that was on screen.
    const frame = cameraFrame;
    const initialFraction =
      frame && cameraAreaSize && photo.width && photo.height
        ? cameraFrameFraction({ width: photo.width, height: photo.height }, cameraAreaSize, frame)
        : null;
    const r = await postCrop.cropUri(photo.uri, POST_CROP_PRESET, {
      aspectOptions: POST_ASPECT_OPTIONS,
      initialAspectKey: DEFAULT_POST_SHAPE.key,
      initialFraction,
    });
    if (!r) return; // cancelled: back to the camera
    const single = pickedFromCrop(photo.uri, r);
    setPickedImages([]);
    setSinglePhoto(single);
    setPostShape(shapeFromCrop(r));
    setPostImage(single.uri);
    setPostLayout("pro");
    setStep(2);
  };

  // Full screen camera: the floating X / flip row at the top and the shutter block at the bottom.
  const cameraTopInset = insets.top + CAMERA_TOP_GAP + CAMERA_ICON_SIZE;
  const cameraBottomPad = insets.bottom || 16;
  const showChips = mode === "post";
  const cameraBottomInset =
    CAMERA_BOTTOM_BLOCK + (showChips ? CAMERA_CHIPS_BLOCK : 0) + cameraBottomPad;

  // The 4:5 frame shown as corner marks in Post mode, in camera area points. It sits in the open
  // space between the top buttons and the shutter block, so it never lands under the controls.
  const cameraFrame = cameraAreaSize
    ? openAreaFrame(
        CAMERA_FRAME_ASPECT,
        cameraAreaSize,
        cameraTopInset,
        cameraBottomInset,
        CAMERA_FRAME_GUTTER,
      )
    : null;

  const startRecording = async () => {
    const limit = recordLimitRef.current;
    setRecordSeconds(0);
    recordLiveRef.current = true;
    recordingRef.current = true;
    setIsRecording(true);
    recordingTimerRef.current = setTimeout(async () => {
      await cameraRef.current?.stopRecording();
      recordingRef.current = false;
      setIsRecording(false);
    }, limit * 1000);
    const result = await cameraRef.current?.recordAsync({ maxDuration: limit });
    recordingRef.current = false;
    tapRecordingRef.current = false;
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (!result?.uri) {
      setIsRecording(false);
      return;
    }
    setIsRecording(false);
    // Camera recordings are full screen and tall: start on Fill.
    if (mode === "post") {
      clearPostPhotos();
      setPostImage(result.uri);
      setPostLayout("pulse");
      setStep(2);
    } else {
      setVideoFit("fill");
      setPostImage(result.uri);
      setPostLayout("pulse");
      setStep(2);
    }
  };

  const handleCameraReady = () => {
    const resolve = androidCameraReadyRef.current;
    androidCameraReadyRef.current = null;
    resolve?.();
  };

  const startAndroidRecording = async () => {
    androidHoldingRef.current = true;
    recordingRef.current = true;
    setIsRecording(true);
    // Switch to video and wait for the camera to re-open (or 3s, whichever first).
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        androidCameraReadyRef.current = null;
        resolve();
      }, 3000);
      androidCameraReadyRef.current = () => {
        clearTimeout(timer);
        resolve();
      };
      setAndroidCameraMode("video");
    });
    try {
      if (androidHoldingRef.current) {
        await startRecording();
      } else {
        // Released (or tapped to stop) before the camera was ready: no video.
        recordingRef.current = false;
        tapRecordingRef.current = false;
        setIsRecording(false);
      }
    } finally {
      androidHoldingRef.current = false;
      setAndroidCameraMode("picture");
    }
  };

  // Starts a recording of up to `seconds`. `byTap`: a tap stops it, releasing the shutter does not.
  const beginRecording = async (seconds: number, byTap: boolean) => {
    if (!cameraPermission?.granted) {
      await requestCameraPermission();
      return;
    }
    if (!micPermission?.granted) {
      await requestMicPermission();
      return;
    }
    if (recordingRef.current) return;
    recordLimitRef.current = seconds;
    setRecordLimit(seconds);
    tapRecordingRef.current = byTap;
    if (Platform.OS === "android") {
      await startAndroidRecording();
      return;
    }
    await startRecording();
  };

  // Stops the recording in progress (or, on Android, one still waiting for video mode).
  const stopRecordingNow = async () => {
    if (Platform.OS === "android") androidHoldingRef.current = false;
    tapRecordingRef.current = false;
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (!recordingRef.current) return;
    await cameraRef.current?.stopRecording();
    recordingRef.current = false;
    setIsRecording(false);
  };

  const handleShutterPressIn = async () => {
    // Hold: on a length chip, up to that length; on PHOTO and in Story, a quick video.
    if (tapRecordingRef.current || recordingRef.current) return;
    await beginRecording(tapToRecord && chipSeconds !== null ? chipSeconds : QUICK_RECORD_SECONDS, false);
  };

  const handleShutterPressOut = async () => {
    // A recording started by a tap keeps going until the next tap.
    if (tapRecordingRef.current) return;
    await stopRecordingNow();
  };

  const handleCreatePost = async () => {
    if (!postImage) {
      Alert.alert("No Media", "Please select a photo or video for your post.");
      return;
    }
    if (!postLayout) {
      Alert.alert("Layout Required", "Please select a photo or video first.");
      return;
    }
    const authToken = await getToken();
    if (!authToken) {
      Alert.alert("Error", "You must be logged in to create a post.");
      return;
    }
    setPostSaving(true);
    try {
      const isVideo = postLayout === "pulse";
      const postData: {
        imageUrl?: string;
        videoUrl?: string;
        mediaType?: "image" | "video";
        content?: string;
        displayLayout?: "pro" | "pulse";
        feedSurface?: "pro" | "pulse";
        productId?: string;
        serviceId?: string;
        photographerServiceId?: string;
        mediaItems?: { url: string; type: "image"; width?: number; height?: number; aspectRatio?: number }[];
        media?: { url: string; type: "image"; width: number; height: number; aspectRatio: number };
        videoFit?: VideoFit;
      } = {
        content: postCaption.trim() || " ",
        displayLayout: postLayout,
        feedSurface: postLayout,
      };
      if (isVideo) {
        setUploadProgress("Uploading 0%");
        const uploadResult = await uploadVideo(postImage, "video/mp4", authToken, (p) =>
          setUploadProgress(`Uploading ${p.percent}%`),
        );
        if (!uploadResult.uploadId) throw new Error("Failed to upload video. Please try again.");
        postData.videoUrl = uploadResult.uploadId;
        postData.mediaType = "video";
        postData.videoFit = videoFit;
      } else if (pickedImages.length > 1 && pickedImages[0].uri === postImage) {
        // Multi-photo post: upload every photo (3 at a time), then create the post once.
        // Nothing is created unless every upload succeeds.
        const total = pickedImages.length;
        const urls: string[] = new Array(total);
        const queue = pickedImages.map((photo, index) => ({ photo, index }));
        let done = 0;
        setUploadProgress(`Uploading 0 of ${total}`);
        const finals: { width: number; height: number }[] = new Array(total);
        const worker = async () => {
          while (queue.length > 0) {
            const next = queue.shift()!;
            // Every photo is cut to the post's shape before upload (centered unless moved).
            const file = await finalizePhoto(next.photo, postShape.aspect);
            const result = await uploadImage(file.uri, "image/jpeg", "posts", authToken);
            if (!result.url) throw new Error("Failed to upload a photo. Please try again.");
            urls[next.index] = result.url;
            finals[next.index] = { width: file.width, height: file.height };
            done += 1;
            setUploadProgress(`Uploading ${done} of ${total}`);
          }
        };
        await Promise.all([worker(), worker(), worker()]);
        postData.imageUrl = urls[0]; // older backends still create a valid one-photo post
        postData.mediaItems = pickedImages.map((_, i) => ({
          url: urls[i],
          type: "image" as const,
          width: Math.round(finals[i].width),
          height: Math.round(finals[i].height),
          aspectRatio: finals[i].width / finals[i].height,
        }));
      } else {
        // One photo: the cropped file, with its real size so the feed can show its shape (2c).
        const file = singlePhoto ? await finalizePhoto(singlePhoto, postShape.aspect) : null;
        const uploadResult = await uploadImage(file?.uri ?? postImage, "image/jpeg", "posts", authToken);
        if (!uploadResult.url) throw new Error("Failed to upload image. Please try again.");
        postData.imageUrl = uploadResult.url; // older backends read this
        if (file) {
          postData.media = {
            url: uploadResult.url,
            type: "image",
            width: Math.round(file.width),
            height: Math.round(file.height),
            aspectRatio: file.width / file.height,
          };
        }
      }
      if (selectedAttach) {
        if (selectedAttach.type === "product") postData.productId = selectedAttach.id;
        else if (selectedAttach.type === "service") postData.serviceId = selectedAttach.id;
        else if (selectedAttach.type === "photographerService") postData.photographerServiceId = selectedAttach.id;
      }
      await apiClient.createPost(authToken, postData);
      setPostImage("");
      clearPostPhotos();
      setPostCaption("");
      setPostLayout(null);
      feedEvents.emitRefresh(isVideo ? "pulse" : "pro");
      Alert.alert(
        "Post Shared!",
        isVideo ? "Your video is now live on the Pulse feed!" : "Your post is now live on the Pro feed!",
        [{ text: "OK", onPress: () => navigation.goBack() }],
      );
    } catch (error: any) {
      console.error("[CreatePostScreen] Failed to create post:", error);
      Alert.alert("Error", error.message || "Failed to create post. Please try again.");
    } finally {
      setPostSaving(false);
      setUploadProgress(null);
    }
  };

  const handleCreateStory = async () => {
    if (!postImage) {
      Alert.alert("No Media", "Please select a photo or video for your story.");
      return;
    }
    const authToken = await getToken();
    if (!authToken) {
      Alert.alert("Error", "You must be logged in to post a story.");
      return;
    }
    setStorySaving(true);
    try {
      const isVideo = postLayout === "pulse";
      const caption = postCaption.trim() || undefined;
      if (isVideo) {
        const uploadResult = await uploadVideo(postImage, "video/mp4", authToken);
        if (!uploadResult.uploadId) throw new Error("Failed to upload video. Please try again.");
        await apiClient.createStory(authToken, {
          mediaUrl: uploadResult.uploadId,
          mediaType: "video",
          muxAssetId: uploadResult.uploadId,
          caption,
          videoFit,
        });
      } else {
        const uploadResult = await uploadImage(postImage, "image/jpeg", "stories", authToken);
        if (!uploadResult.url) throw new Error("Failed to upload image. Please try again.");
        await apiClient.createStory(authToken, {
          mediaUrl: uploadResult.url,
          mediaType: "image",
          caption,
        });
      }
      setPostImage("");
      setPostCaption("");
      setPostLayout(null);
      setStep(1);
      navigation.goBack();
    } catch (error: any) {
      console.error("[CreatePostScreen] Failed to create story:", error);
      Alert.alert("Error", error.message || "Failed to post story. Please try again.");
    } finally {
      setStorySaving(false);
    }
  };

  const handleClose = () => {
    setPostImage("");
    clearPostPhotos();
    setPostCaption("");
    setPostLayout(null);
    setStep(1);
    setSelectedAttach(null);
    setAttachItems([]);
    setAttachError(null);
    navigation.goBack();
  };

  // ── Shutter gestures (RNGH) ───────────────────────────────────────────────
  const shutterTapGesture = Gesture.Tap()
    .simultaneousWithExternalGesture(modeSwipeGesture)
    .onEnd(() => {
      runOnJS(handleShutterTap)();
    });

  const shutterLongPressGesture = Gesture.LongPress()
    .minDuration(300)
    .simultaneousWithExternalGesture(modeSwipeGesture)
    .onStart(() => {
      runOnJS(handleShutterPressIn)();
    })
    .onEnd(() => {
      runOnJS(handleShutterPressOut)();
    })
    .onFinalize(() => {
      runOnJS(handleShutterPressOut)();
    });

  const shutterGesture = Gesture.Race(
    shutterLongPressGesture,
    shutterTapGesture
  );

  const renderShareButton = () => (
    <>
    <Pressable
      onPress={handleCreatePost}
      disabled={postSaving || !postImage}
      style={[
        styles.footerButton,
        {
          backgroundColor: theme.brandPrimary,
          opacity: postSaving || !postImage ? 0.5 : 1,
        },
      ]}
    >
      {postSaving ? (
        uploadProgress ? (
          <ThemedText type="button" style={{ color: theme.brandPrimaryText }}>
            {uploadProgress}
          </ThemedText>
        ) : (
          <ActivityIndicator size="small" color={theme.brandPrimaryText} />
        )
      ) : (
        <ThemedText type="button" style={{ color: theme.brandPrimaryText }}>
          Share Post
        </ThemedText>
      )}
    </Pressable>
    {postSaving && postLayout === "pulse" ? (
      <ThemedText
        type="caption"
        style={{ color: theme.brandTextDim, textAlign: "center", marginTop: Spacing.xs }}
      >
        Keep Outsyde open while your video uploads.
      </ThemedText>
    ) : null}
    </>
  );

  const recordClock = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
  const showingPick = !!postImage;

  return (
    <ThemedView
      style={[
        styles.container,
        // Step 1 is the full screen camera: it runs under the status bar and paints its own black.
        step === 1 ? styles.cameraScreen : { paddingTop: insets.top },
      ]}
    >
      {/* Light status bar text over the camera, in light and dark mode. Reverts when steps 2 and 3 show. */}
      {step === 1 ? <StatusBar style="light" /> : null}

      {step !== 1 && (
        <View style={styles.header}>
          <Pressable onPress={() => setStep(step === 3 ? 2 : 1)} hitSlop={16}>
            <Feather name="chevron-left" size={24} color={theme.brandCream} />
          </Pressable>
          <ThemedText
            type="h4"
            style={{ flex: 1, textAlign: "center", color: theme.brandCream }}
          >
            {mode === "story" ? "Create Story" : "Create Post"}
          </ThemedText>
          <View style={{ width: 24 }} />
        </View>
      )}

      {step === 1 && (
        <GestureDetector gesture={modeSwipeGesture}>
          <View style={{ flex: 1 }}>
            {/* ── Camera: the whole screen. Everything else floats over it. ── */}
            <View
              style={StyleSheet.absoluteFill}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                setCameraAreaSize((prev) =>
                  prev && prev.width === width && prev.height === height
                    ? prev
                    : { width, height },
                );
              }}
            >
              {showingPick ? (
                postLayout === "pulse" ? (
                  <View
                    style={[StyleSheet.absoluteFill, styles.videoPlaceholder]}
                  >
                    <Feather name="video" size={48} color="#fff" />
                    <ThemedText
                      type="body"
                      style={{ color: "#fff", marginTop: 12 }}
                    >
                      Video selected
                    </ThemedText>
                  </View>
                ) : (
                  <Image
                    source={{ uri: postImage }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
                )
              ) : (
                <>
                  {cameraPermission?.granted ? (
                    <CameraView
                      ref={cameraRef}
                      style={StyleSheet.absoluteFill}
                      facing={facing}
                      mode={
                        Platform.OS === "android"
                          ? androidCameraMode
                          : undefined
                      }
                      // TikTok posts at 1080p; without this iPhones record at their highest (often 4K).
                      videoQuality="1080p"
                      onCameraReady={
                        Platform.OS === "android"
                          ? handleCameraReady
                          : undefined
                      }
                    />
                  ) : null}
                  {cameraPermission?.granted &&
                  mode === "post" &&
                  captureChip === "photo" &&
                  !isRecording &&
                  cameraFrame ? (
                    // The 4:5 post frame as corner marks: what a photo keeps (changeable on the crop screen).
                    <View
                      pointerEvents="none"
                      style={StyleSheet.absoluteFill}
                      testID="camera-post-frame"
                    >
                      <View
                        style={[
                          styles.frameCorner,
                          {
                            left: cameraFrame.left,
                            top: cameraFrame.top,
                            borderLeftWidth: 2,
                            borderTopWidth: 2,
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.frameCorner,
                          {
                            left:
                              cameraFrame.left +
                              cameraFrame.width -
                              CAMERA_CORNER,
                            top: cameraFrame.top,
                            borderRightWidth: 2,
                            borderTopWidth: 2,
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.frameCorner,
                          {
                            left: cameraFrame.left,
                            top:
                              cameraFrame.top +
                              cameraFrame.height -
                              CAMERA_CORNER,
                            borderLeftWidth: 2,
                            borderBottomWidth: 2,
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.frameCorner,
                          {
                            left:
                              cameraFrame.left +
                              cameraFrame.width -
                              CAMERA_CORNER,
                            top:
                              cameraFrame.top +
                              cameraFrame.height -
                              CAMERA_CORNER,
                            borderRightWidth: 2,
                            borderBottomWidth: 2,
                          },
                        ]}
                      />
                    </View>
                  ) : null}
                  {cameraPermission?.granted ? null : (
                    <View style={styles.cameraPlaceholder}>
                      <Feather
                        name="camera"
                        size={40}
                        color="rgba(255,255,255,0.3)"
                      />
                      {cameraPermission?.granted === false && (
                        <Pressable
                          onPress={() => Linking.openSettings()}
                          style={{ marginTop: 16 }}
                        >
                          <ThemedText
                            type="body"
                            style={{
                              color: "#D4A94A",
                              textDecorationLine: "underline",
                            }}
                          >
                            Enable camera access
                          </ThemedText>
                        </Pressable>
                      )}
                    </View>
                  )}
                </>
              )}
            </View>

            {/* Soft fades so the white controls read over a bright camera. */}
            {!isRecording && (
              <LinearGradient
                pointerEvents="none"
                colors={["rgba(0,0,0,0.55)", "rgba(0,0,0,0)"]}
                style={[styles.cameraFadeTop, { height: cameraTopInset + 40 }]}
              />
            )}
            <LinearGradient
              pointerEvents="none"
              colors={[
                "rgba(0,0,0,0)",
                isRecording ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.7)",
              ]}
              style={[
                styles.cameraFadeBottom,
                { height: cameraBottomInset + 90 },
              ]}
            />

            {/* ── Top: X at top left, flip at top right (hidden while recording) ── */}
            {!isRecording && (
              <View
                style={[
                  styles.cameraTopRow,
                  { top: insets.top + CAMERA_TOP_GAP },
                ]}
              >
                <Pressable
                  onPress={handleClose}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  style={styles.cameraIconButton}
                >
                  <Feather name="x" size={22} color="#fff" />
                </Pressable>
                {showingPick ? (
                  // A photo or video picked earlier is showing: X clears it, back to the camera.
                  <Pressable
                    onPress={() => {
                      setPostImage("");
                      clearPostPhotos();
                      setPostLayout(null);
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Remove this and go back to the camera"
                    style={styles.cameraIconButton}
                    testID="camera-retake"
                  >
                    <Feather name="rotate-ccw" size={20} color="#fff" />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() =>
                      setFacing((f) => (f === "back" ? "front" : "back"))
                    }
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Flip camera"
                    style={styles.cameraIconButton}
                  >
                    <Feather name="refresh-cw" size={20} color="#fff" />
                  </Pressable>
                )}
              </View>
            )}

            {/* Recording timer pill */}
            {isRecording && (
              <View
                style={[
                  styles.recordPill,
                  { top: insets.top + CAMERA_TOP_GAP + 6 },
                ]}
                accessibilityLiveRegion="polite"
                accessibilityLabel={`Recording, ${recordClock(recordSeconds)} of ${recordClock(recordLimit)}`}
              >
                <View style={styles.recordDot} />
                <ThemedText style={styles.recordPillText}>
                  {recordClock(recordSeconds)} /{" "}
                  {recordClock(recordLimit)}
                </ThemedText>
              </View>
            )}

            {/* ── Bottom: gallery | shutter | (space), then POST · STORY · EVENT ── */}
            <View
              style={[styles.cameraBottom, { paddingBottom: cameraBottomPad }]}
            >
              {/* Pulse lengths (Post mode): a length records video by tap, PHOTO takes photos. */}
              {showChips ? (
                <View
                  style={[
                    styles.chipsRow,
                    (isRecording || showingPick) && { opacity: 0 },
                  ]}
                  pointerEvents={isRecording || showingPick ? "none" : "auto"}
                  accessibilityRole="radiogroup"
                >
                  {CAPTURE_CHIPS.map((c) => {
                    const on = c.key === captureChip;
                    return (
                      <Pressable
                        key={c.key}
                        onPress={() => setCaptureChip(c.key)}
                        disabled={isRecording}
                        hitSlop={6}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={
                          c.seconds === null
                            ? "Photo"
                            : `Video up to ${c.seconds >= 60 ? `${c.seconds / 60} minute${c.seconds > 60 ? "s" : ""}` : `${c.seconds} seconds`}`
                        }
                        testID={`capture-chip-${c.key}`}
                        style={[styles.captureChip, on && styles.captureChipOn]}
                      >
                        <ThemedText style={[styles.captureChipText, on && styles.captureChipTextOn]}>
                          {c.label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              <View style={styles.controlsRow}>
                <View style={styles.controlsSide}>
                  {!isRecording && (
                    <Pressable
                      onPress={
                        mode === "story"
                          ? handlePickStoryMedia
                          : handlePickPostImage
                      }
                      onPressIn={() => {
                        Haptics.impactAsync(
                          Haptics.ImpactFeedbackStyle.Light,
                        ).catch(() => {});
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Open photo library"
                      style={({ pressed }) => [
                        styles.galleryButton,
                        thumbUri ? styles.galleryButtonThumb : null,
                        pressed && styles.galleryButtonPressed,
                      ]}
                    >
                      {thumbUri ? (
                        <Image
                          source={{ uri: thumbUri }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                          transition={200}
                          onError={() => setThumbUri(null)}
                        />
                      ) : (
                        <Feather name="image" size={22} color="#fff" />
                      )}
                    </Pressable>
                  )}
                </View>

                <GestureDetector gesture={shutterGesture}>
                  <View
                    style={[
                      styles.shutterButton,
                      isRecording && styles.shutterButtonRecording,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isRecording
                        ? "Stop recording"
                        : tapToRecord
                          ? "Start recording"
                          : "Take a photo, hold to record a video"
                    }
                  >
                    <View
                      style={[
                        styles.shutterInner,
                        tapToRecord && styles.shutterInnerVideo,
                        isRecording && styles.shutterInnerRecording,
                      ]}
                    />
                  </View>
                </GestureDetector>

                <View style={styles.controlsSide} />
              </View>

              {/* Mode words. Swiping left or right on the camera still switches Post and Story. */}
              <View
                style={[styles.modeRow, isRecording && { opacity: 0 }]}
                pointerEvents={isRecording ? "none" : "auto"}
              >
                <Pressable
                  onPress={() => switchMode("post")}
                  disabled={isRecording}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityState={{ selected: mode === "post" }}
                  accessibilityLabel="Post"
                  style={styles.modeItem}
                >
                  <ThemedText
                    style={[
                      styles.modeText,
                      mode === "post" && styles.modeTextOn,
                    ]}
                  >
                    POST
                  </ThemedText>
                  <View
                    style={[styles.modeDot, mode !== "post" && { opacity: 0 }]}
                  />
                </Pressable>
                <Pressable
                  onPress={() => switchMode("story")}
                  disabled={isRecording}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityState={{ selected: mode === "story" }}
                  accessibilityLabel="Story"
                  style={styles.modeItem}
                >
                  <ThemedText
                    style={[
                      styles.modeText,
                      mode === "story" && styles.modeTextOn,
                    ]}
                  >
                    STORY
                  </ThemedText>
                  <View
                    style={[styles.modeDot, mode !== "story" && { opacity: 0 }]}
                  />
                </Pressable>
                {/* Event: host an event (p4-host). Opens the event editor in place of this screen. */}
                <Pressable
                  onPress={() => navigation.replace("EventEditor", undefined)}
                  disabled={isRecording}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Event, host an event"
                  style={styles.modeItem}
                >
                  <ThemedText style={styles.modeText}>EVENT</ThemedText>
                  <View style={[styles.modeDot, { opacity: 0 }]} />
                </Pressable>
              </View>
            </View>
          </View>
        </GestureDetector>
      )}

      {step === 2 && mode === "post" && (
        <>
          {pickedImages.length > 1 ? (
            <View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pickedStrip}
              >
                {pickedImages.map((photo, index) => (
                  <Pressable
                    key={`${photo.sourceUri}-${index}`}
                    onPress={() => handleRecropPhoto(index)}
                    disabled={postSaving}
                    accessibilityRole="button"
                    accessibilityLabel={`Photo ${index + 1}, tap to move it`}
                    style={[
                      styles.pickedThumb,
                      // Shown in the post's shape: uncropped photos are centered, as they'll be cut.
                      { width: Math.round(THUMB_HEIGHT * postShape.aspect) },
                      { backgroundColor: theme.brandSurface, borderColor: theme.brandSurfaceBorder },
                    ]}
                  >
                    <Image source={{ uri: photo.uri }} style={styles.mediaPreview} contentFit="cover" />
                    <View style={styles.pickedIndex}>
                      <ThemedText type="caption" style={{ color: "#fff" }}>{index + 1}</ThemedText>
                    </View>
                    <Pressable
                      onPress={() => handleRemovePickedImage(index)}
                      style={styles.pickedRemove}
                      hitSlop={10}
                      disabled={postSaving}
                    >
                      <Feather name="x" size={14} color="#fff" />
                    </Pressable>
                  </Pressable>
                ))}
              </ScrollView>
              <ThemedText type="caption" style={[styles.pickedCount, { color: theme.brandTextDim }]}>
                {pickedImages.length} photos · tap a photo to move it
              </ThemedText>
            </View>
          ) : postLayout === "pulse" ? (
          <View style={styles.videoFitBlock}>
            <VideoFitPicker uri={postImage} fit={videoFit} onChange={setVideoFit} disabled={postSaving} />
          </View>
          ) : (
          <Pressable
            onPress={() => handleRecropPhoto("single")}
            disabled={postSaving || !singlePhoto}
            accessibilityRole="button"
            accessibilityLabel="Photo, tap to crop again"
            style={[
              styles.detailsThumbnail,
              singlePhoto ? { width: Math.round(THUMB_HEIGHT * postShape.aspect) } : null,
              { backgroundColor: theme.brandSurface, borderColor: theme.brandSurfaceBorder },
            ]}
          >
            <Image source={{ uri: postImage }} style={styles.mediaPreview} contentFit="cover" />
          </Pressable>
          )}

          <ScreenKeyboardAwareScrollView contentContainerStyle={{ paddingTop: 0, paddingHorizontal: 0 }}>
            <TextInput
              style={[styles.captionInput, { color: theme.brandCream, borderColor: theme.brandSurfaceBorder }]}
              placeholder="Write a caption..."
              placeholderTextColor={theme.brandTextDim}
              value={postCaption}
              onChangeText={setPostCaption}
              multiline
            />

            {canAttach ? (
              <Pressable
                onPress={() => setStep(3)}
                style={[styles.footerButton, { backgroundColor: theme.brandPrimary }]}
              >
                <ThemedText type="button" style={{ color: theme.brandPrimaryText }}>
                  Next
                </ThemedText>
              </Pressable>
            ) : (
              renderShareButton()
            )}
          </ScreenKeyboardAwareScrollView>
        </>
      )}

      {step === 2 && mode === "story" && (
        <>
          {postLayout === "pulse" ? (
            <View style={styles.videoFitBlock}>
              <VideoFitPicker uri={postImage} fit={videoFit} onChange={setVideoFit} disabled={storySaving} />
            </View>
          ) : (
            // The saved 9:16 story photo, shown whole.
            <View
              style={[
                styles.storyPhotoPreview,
                { backgroundColor: theme.brandSurface, borderColor: theme.brandSurfaceBorder },
              ]}
              testID="story-photo-preview"
            >
              <Image source={{ uri: postImage }} style={styles.mediaPreview} contentFit="cover" />
            </View>
          )}

          <ScreenKeyboardAwareScrollView contentContainerStyle={{ paddingTop: 0, paddingHorizontal: 0 }}>
            <TextInput
              style={[styles.captionInput, { color: theme.brandCream, borderColor: theme.brandSurfaceBorder }]}
              placeholder="Write a caption... (optional)"
              placeholderTextColor={theme.brandTextDim}
              value={postCaption}
              onChangeText={setPostCaption}
              multiline
            />

            <Pressable
              onPress={handleCreateStory}
              disabled={storySaving}
              style={[
                styles.footerButton,
                { backgroundColor: "#D4A94A", opacity: storySaving ? 0.6 : 1 },
              ]}
            >
              {storySaving ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <ThemedText type="button" style={{ color: "#000" }}>
                  Post Story
                </ThemedText>
              )}
            </Pressable>

            <Pressable
              onPress={() => { setStep(1); setPostImage(""); setPostCaption(""); setPostLayout(null); }}
              style={styles.discardButton}
            >
              <ThemedText type="body" style={{ color: theme.brandTextDim }}>
                Discard
              </ThemedText>
            </Pressable>
          </ScreenKeyboardAwareScrollView>
        </>
      )}

      {step === 3 && canAttach && mode === "post" && (
        <View style={{ flex: 1, paddingBottom: insets.bottom || 16 }}>
          <View style={styles.attachContent}>
            <ThemedText type="h4" style={{ color: theme.brandCream, textAlign: "center" }}>
              {user?.role === "photographer" ? "Attach a service?" : "Attach a product or service?"}
            </ThemedText>

            {attachLoading ? (
              <View style={styles.attachStatusBox}>
                <ActivityIndicator size="small" color={theme.brandPrimary} />
              </View>
            ) : attachError ? (
              <View
                style={[
                  styles.attachPlaceholder,
                  { backgroundColor: theme.brandSurface, borderColor: theme.brandSurfaceBorder },
                ]}
              >
                <Feather name="alert-circle" size={28} color={theme.brandTextDim} />
                <ThemedText
                  type="body"
                  style={{ color: theme.brandTextDim, textAlign: "center", marginTop: Spacing.md }}
                >
                  {attachError}
                </ThemedText>
              </View>
            ) : attachItems.length === 0 ? (
              <View
                style={[
                  styles.attachPlaceholder,
                  { backgroundColor: theme.brandSurface, borderColor: theme.brandSurfaceBorder },
                ]}
              >
                <Feather name="tag" size={28} color={theme.brandTextDim} />
                <ThemedText
                  type="body"
                  style={{ color: theme.brandTextDim, textAlign: "center", marginTop: Spacing.md }}
                >
                  No live items to attach — you can still share your post.
                </ThemedText>
              </View>
            ) : (
              <ScrollView style={styles.attachList} showsVerticalScrollIndicator={false}>
                {attachItems.map((item) => {
                  const isSelected = selectedAttach?.type === item.type && selectedAttach?.id === item.id;
                  const priceLabel = item.priceCents != null ? `$${(item.priceCents / 100).toFixed(2)}` : "—";
                  return (
                    <Pressable
                      key={`${item.type}-${item.id}`}
                      onPress={() => setSelectedAttach(isSelected ? null : { type: item.type, id: item.id })}
                      style={[
                        styles.attachRow,
                        {
                          backgroundColor: isSelected ? theme.brandPrimary : theme.brandSurface,
                          borderColor: isSelected ? theme.brandPrimary : theme.brandSurfaceBorder,
                        },
                      ]}
                    >
                      <ThemedText
                        type="body"
                        style={{ color: isSelected ? theme.brandPrimaryText : theme.brandCream, flex: 1 }}
                      >
                        {item.name}
                      </ThemedText>
                      <ThemedText
                        type="body"
                        style={{ color: isSelected ? theme.brandPrimaryText : theme.brandTextDim }}
                      >
                        {priceLabel}
                      </ThemedText>
                      {isSelected && (
                        <Feather
                          name="check-circle"
                          size={18}
                          color={theme.brandPrimaryText}
                          style={{ marginLeft: Spacing.sm }}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {renderShareButton()}
        </View>
      )}
      {postCrop.cropper}
      {storyEditor.editor}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  notAvailable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  mediaPicker: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    height: 280,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  mediaPreview: {
    width: "100%",
    height: "100%",
  },
  mediaEmpty: {
    alignItems: "center",
    justifyContent: "center",
  },
  videoSelected: {
    alignItems: "center",
    justifyContent: "center",
  },
  captionInput: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    minHeight: 80,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 15,
    textAlignVertical: "top",
  },
  footerButton: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  pickedStrip: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  pickedThumb: {
    height: 120,
    width: 120,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  pickedIndex: {
    position: "absolute",
    left: 6,
    top: 6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  pickedRemove: {
    position: "absolute",
    right: 6,
    top: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  pickedCount: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
  },
  storyPhotoPreview: {
    alignSelf: "center",
    marginTop: Spacing.md,
    height: 300,
    aspectRatio: 9 / 16,
    maxWidth: "100%",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  detailsThumbnail: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    height: 120,
    width: 120,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  attachContent: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    flex: 1,
  },
  attachPlaceholder: {
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingVertical: Spacing["2xl"],
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  attachStatusBox: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing["2xl"],
    alignItems: "center",
    justifyContent: "center",
  },
  attachList: {
    marginTop: Spacing.lg,
    flex: 1,
  },
  attachRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  cameraButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  discardButton: {
    alignItems: "center",
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  videoFitBlock: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  cameraPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  videoPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0a0a0a",
  },
  cameraScreen: {
    backgroundColor: "#000",
  },
  cameraFadeTop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
  },
  cameraFadeBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  cameraTopRow: {
    position: "absolute",
    left: 14,
    right: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cameraIconButton: {
    width: CAMERA_ICON_SIZE,
    height: CAMERA_ICON_SIZE,
    borderRadius: CAMERA_ICON_SIZE / 2,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  frameCorner: {
    position: "absolute",
    width: CAMERA_CORNER,
    height: CAMERA_CORNER,
    borderColor: "rgba(255,255,255,0.9)",
  },
  recordPill: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#C62828",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  recordDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  recordPillText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  cameraBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
  },
  controlsRow: {
    height: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 32,
  },
  controlsSide: {
    width: 48,
    alignItems: "center",
  },
  chipsRow: {
    height: 28,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  captureChip: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  captureChipOn: {
    backgroundColor: "#FFFFFF",
  },
  captureChipText: {
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  captureChipTextOn: {
    color: "#171717",
  },
  modeRow: {
    height: 20,
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "center",
    gap: 26,
  },
  modeItem: {
    alignItems: "center",
  },
  modeText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "700",
    letterSpacing: 1,
  },
  modeTextOn: {
    color: "#fff",
  },
  modeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
    backgroundColor: "#E8B930",
  },
  galleryButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  galleryButtonThumb: {
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.85)",
  },
  galleryButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  shutterButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: "#fff",
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#fff",
  },
  shutterInnerVideo: {
    backgroundColor: "#C62828",
  },
  shutterButtonRecording: {
    borderColor: "#C62828",
    borderWidth: 4,
  },
  shutterInnerRecording: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#C62828",
  },
});
