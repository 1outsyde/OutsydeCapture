// Android only. Lets release builds (EAS preview/production) finish with @stripe/stripe-react-native 0.81.0.
//
// 0.81.0 declares compileOnly "com.stripe:stripe-android-issuing-push-provisioning:1.3.0", whose POM pulls in
// com.google.android.gms:play-services-tapandpay:18.8.0. Google does not publish that SDK publicly, and the Android
// Gradle Plugin 9 used by Expo SDK 58 resolves it for the Stripe module's release lint, so the build stops with
// "Could not find com.google.android.gms:play-services-tapandpay:18.8.0" (stripe/stripe-react-native #2728,
// expo/expo #52642). The app never uses Stripe Issuing push provisioning, so the dependency is dropped from that
// module's metadata. Stripe's own fix (0.82.0, PR #2704) excludes the same module.
// Remove this plugin when the app moves to @stripe/stripe-react-native 0.82.0 or later.
const { withProjectBuildGradle } = require("expo/config-plugins");

const MARKER = "// outsyde: stripe tapandpay exclude";

const BLOCK = `
${MARKER}
subprojects { sub ->
  sub.dependencies.components.withModule("com.stripe:stripe-android-issuing-push-provisioning") {
    allVariants {
      withDependencies { deps ->
        deps.removeAll { it.group == "com.google.android.gms" && it.name == "play-services-tapandpay" }
      }
    }
  }
}
`;

module.exports = function withStripeTapAndPayExclude(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") {
      throw new Error("withStripeTapAndPayExclude: expected a Groovy android/build.gradle");
    }
    if (!cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents = `${cfg.modResults.contents.trimEnd()}\n${BLOCK}`;
    }
    return cfg;
  });
};
