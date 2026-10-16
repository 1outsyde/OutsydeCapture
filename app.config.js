// Wraps app.json (all settings still live there). Only adds Android push config at build time.
//
// GOOGLE_SERVICES_JSON is an EAS "file" environment variable holding google-services.json
// from the Firebase project (Android app com.outsyde.app). EAS sets it to the file's path
// during the build. The file is not committed because this repo is public.
// When the variable is not set (local dev, iOS builds), the config is exactly app.json.
module.exports = ({ config }) => {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  if (!googleServicesFile) return config;
  return {
    ...config,
    android: { ...config.android, googleServicesFile },
  };
};
