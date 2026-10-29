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
import { boxSizeFor, cameraFrameFraction, type FracRect } from "@/utils/crop/cropMath";
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

  // The 4:5 frame drawn on the camera in Post mode, in camera area points.
  const cameraFrame = (() => {
    if (!cameraAreaSize) return null;
    const box = boxSizeFor(
      CAMERA_FRAME_ASPECT,
      cameraAreaSize.width - CAMERA_FRAME_GUTTER * 2,
      cameraAreaSize.height - CAMERA_FRAME_GUTTER * 2,
    );
    return {
      left: (cameraAreaSize.width - box.width) / 2,
      top: (cameraAreaSize.height - box.height) / 2,
      width: box.width,
      height: box.height,
    };
  })();

  const startRecording = async () => {
    setIsRecording(true);
    recordingTimerRef.current = setTimeout(async () => {
      await cameraRef.current?.stopRecording();
      setIsRecording(false);
    }, 15000);
    const result = await cameraRef.current?.recordAsync({ maxDuration: 15 });
    if (!result?.uri) {
      setIsRecording(false);
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
      return;
    }
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
        setIsRecording(false); // released before the camera was ready: no video
      }
    } finally {
      androidHoldingRef.current = false;
      setAndroidCameraMode("picture");
    }
  };

  const handleShutterPressIn = async () => {
    if (!cameraPermission?.granted) {
      await requestCameraPermission();
      return;
    }
    if (!micPermission?.granted) {
      await requestMicPermission();
      return;
    }
    if (Platform.OS === "android") {
      await startAndroidRecording();
      return;
    }
    await startRecording();
  };

  const handleShutterPressOut = async () => {
    if (Platform.OS === "android") androidHoldingRef.current = false;
    if (!isRecording) return;
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    await cameraRef.current?.stopRecording();
    setIsRecording(false);
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
        const uploadResult = await uploadVideo(postImage, "video/mp4", authToken);
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
  );

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        {step === 1 ? (
          <Pressable onPress={handleClose} hitSlop={16}>
            <Feather name="x" size={24} color={theme.brandCream} />
          </Pressable>
        ) : (
          <Pressable onPress={() => setStep(step === 3 ? 2 : 1)} hitSlop={16}>
            <Feather name="chevron-left" size={24} color={theme.brandCream} />
          </Pressable>
        )}
        <ThemedText type="h4" style={{ flex: 1, textAlign: "center", color: theme.brandCream }}>
          {mode === "story" ? "Create Story" : "Create Post"}
        </ThemedText>
        <View style={{ width: 24 }} />
      </View>

      {step === 1 && (
        <GestureDetector gesture={modeSwipeGesture}>
          <View style={{ flex: 1 }}>
            {/* ── Camera area: fills middle ── */}
            <View
              style={styles.cameraArea}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                setCameraAreaSize((prev) =>
                  prev && prev.width === width && prev.height === height ? prev : { width, height },
                );
              }}
            >
              {postImage ? (
                <>
                  {postLayout === "pulse" ? (
                    <View style={[StyleSheet.absoluteFill, styles.videoPlaceholder]}>
                      <Feather name="video" size={48} color="#fff" />
                      <ThemedText type="body" style={{ color: "#fff", marginTop: 12 }}>
                        Video selected
                      </ThemedText>
                    </View>
                  ) : (
                    <Image
                      source={{ uri: postImage }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                  )}
                  <Pressable
                    onPress={() => { setPostImage(""); clearPostPhotos(); setPostLayout(null); }}
                    style={styles.retakeButton}
                    hitSlop={12}
                  >
                    <Feather name="x" size={20} color="#fff" />
                  </Pressable>
                </>
              ) : (
                <>
                  {cameraPermission?.granted ? (
                    <CameraView
                      ref={cameraRef}
                      style={StyleSheet.absoluteFill}
                      facing={facing}
                      mode={Platform.OS === "android" ? androidCameraMode : undefined}
                      onCameraReady={Platform.OS === "android" ? handleCameraReady : undefined}
                    />
                  ) : null}
                  {cameraPermission?.granted && mode === "post" && !isRecording && cameraFrame ? (
                    // The 4:5 post frame: what a photo keeps (it can be changed on the crop screen).
                    <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="camera-post-frame">
                      <View style={[styles.frameDim, { left: 0, right: 0, top: 0, height: cameraFrame.top }]} />
                      <View
                        style={[
                          styles.frameDim,
                          { left: 0, right: 0, top: cameraFrame.top + cameraFrame.height, bottom: 0 },
                        ]}
                      />
                      <View
                        style={[
                          styles.frameDim,
                          { left: 0, width: cameraFrame.left, top: cameraFrame.top, height: cameraFrame.height },
                        ]}
                      />
                      <View
                        style={[
                          styles.frameDim,
                          { right: 0, width: cameraFrame.left, top: cameraFrame.top, height: cameraFrame.height },
                        ]}
                      />
                      <View
                        style={[
                          styles.frameEdge,
                          {
                            left: cameraFrame.left,
                            top: cameraFrame.top,
                            width: cameraFrame.width,
                            height: cameraFrame.height,
                          },
                        ]}
                      />
                    </View>
                  ) : null}
                  {cameraPermission?.granted ? null : (
                    <View style={styles.cameraPlaceholder}>
                      <Feather name="camera" size={40} color="rgba(255,255,255,0.3)" />
                      {cameraPermission?.granted === false && (
                        <Pressable onPress={() => Linking.openSettings()} style={{ marginTop: 16 }}>
                          <ThemedText
                            type="body"
                            style={{ color: "#D4A94A", textDecorationLine: "underline" }}
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

            {/* ── Bottom bar ── */}
            <View style={[styles.step1BottomBar, { paddingBottom: insets.bottom || 16 }]}>
              {/* POST | STORY tab row */}
              <View style={[styles.tabRow, { borderBottomColor: theme.brandSurfaceBorder }]}>
                <Pressable
                  style={[styles.tab, mode === "post" && { borderBottomWidth: 2, borderBottomColor: "#D4A94A" }]}
                  onPress={() => switchMode("post")}
                  disabled={isRecording}
                >
                  <ThemedText type="button" style={{ color: mode === "post" ? "#D4A94A" : theme.brandTextDim }}>
                    Post
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.tab, mode === "story" && { borderBottomWidth: 2, borderBottomColor: "#D4A94A" }]}
                  onPress={() => switchMode("story")}
                  disabled={isRecording}
                >
                  <ThemedText type="button" style={{ color: mode === "story" ? "#D4A94A" : theme.brandTextDim }}>
                    Story
                  </ThemedText>
                </Pressable>
                {/* Event: host an event (p4-host). Opens the event editor in place of this screen. */}
                <Pressable
                  style={styles.tab}
                  onPress={() => navigation.replace("EventEditor", undefined)}
                  disabled={isRecording}
                  accessibilityRole="button"
                  accessibilityLabel="Event, host an event"
                >
                  <ThemedText type="button" style={{ color: theme.brandTextDim }}>
                    Event
                  </ThemedText>
                </Pressable>
              </View>

              {/* Recording indicator */}
              {isRecording && (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "red", marginRight: 6 }} />
                  <ThemedText style={{ color: "red", fontSize: 13 }}>Recording</ThemedText>
                </View>
              )}

              {/* Gallery | Shutter | Flip row */}
              <View style={styles.controlsRow}>
                <Pressable
                  onPress={mode === "story" ? handlePickStoryMedia : handlePickPostImage}
                  onPressIn={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  }}
                  disabled={isRecording}
                  accessibilityRole="button"
                  accessibilityLabel="Open photo library"
                  style={({ pressed }) => [
                    styles.galleryButton,
                    thumbUri ? styles.galleryButtonThumb : null,
                    isRecording && { opacity: 0.4 },
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
                    <Feather name="image" size={24} color="#fff" />
                  )}
                </Pressable>

                <GestureDetector gesture={shutterGesture}>
                  <View
                    style={[
                      styles.shutterButton,
                      isRecording && { borderColor: "red", borderWidth: 3 },
                    ]}
                  >
                    <View style={[
                      styles.shutterInner,
                      isRecording && { backgroundColor: "red" },
                    ]} />
                  </View>
                </GestureDetector>

                <Pressable
                  style={styles.flipButton}
                  onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))}
                >
                  <Feather name="refresh-cw" size={24} color="#fff" />
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
  tabRow: {
    flexDirection: "row",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
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
  cameraArea: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  videoFitBlock: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  frameDim: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  frameEdge: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
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
  retakeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  step1BottomBar: {
    backgroundColor: "#000",
    paddingTop: 8,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 40,
    paddingTop: 16,
    paddingBottom: 8,
  },
  galleryButton: {
    width: 56,
    height: 56,
    borderRadius: 12,
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
  flipButton: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
});
