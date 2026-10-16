// Android only. Lets the photo picker and camera work on Android 12 and older.
//
// expo-image-picker asks for READ/WRITE_EXTERNAL_STORAGE on Android 12 (API 32) and older,
// and for WRITE_EXTERNAL_STORAGE when using the camera on Android 9 and older. Blocking those
// permissions made every photo upload fail with "Permission Required" on those phones.
// Android 13+ ignores them and uses the system photo picker, so they are capped at API 32
// (no effect on newer phones and no Google Play photo/video permission declaration).
// tools:node="replace" overrides the uncapped copies that libraries declare.
const { withAndroidManifest } = require("expo/config-plugins");

const LEGACY = [
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
];

module.exports = function withLegacyStoragePermissions(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$ = manifest.$ || {};
    manifest.$["xmlns:tools"] = manifest.$["xmlns:tools"] || "http://schemas.android.com/tools";
    const others = (manifest["uses-permission"] || []).filter(
      (p) => !LEGACY.includes(p.$["android:name"]),
    );
    manifest["uses-permission"] = [
      ...others,
      ...LEGACY.map((name) => ({
        $: { "android:name": name, "android:maxSdkVersion": "32", "tools:node": "replace" },
      })),
    ];
    return cfg;
  });
};
