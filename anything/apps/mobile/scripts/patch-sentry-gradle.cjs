const fs = require("node:fs");
const path = require("node:path");

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN?.trim();
const buildGradlePath = path.join(__dirname, "..", "android", "app", "build.gradle");

if (sentryAuthToken) {
  console.log("[patch-sentry-gradle] SENTRY_AUTH_TOKEN is set; leaving Sentry Gradle integration enabled.");
  process.exit(0);
}

if (!fs.existsSync(buildGradlePath)) {
  console.log("[patch-sentry-gradle] android/app/build.gradle not found; nothing to patch.");
  process.exit(0);
}

const source = fs.readFileSync(buildGradlePath, "utf8");
const patchedMarker = "SENTRY_AUTH_TOKEN is not set; skipping Sentry Gradle source map upload.";

if (source.includes(patchedMarker)) {
  console.log("[patch-sentry-gradle] Sentry Gradle guard already present.");
  process.exit(0);
}

const sentryApplyPattern =
  /apply from: new File\(\["node", "--print", "require\('path'\)\.dirname\(require\.resolve\('@sentry\/react-native\/package\.json'\)\)"\]\.execute\(\)\.text\.trim\(\), "sentry\.gradle"\)/;

const replacement = `def sentryAuthToken = System.getenv("SENTRY_AUTH_TOKEN")?.trim()
def sentryGradleFile = new File(
    ["node", "--print", "require('path').dirname(require.resolve('@sentry/react-native/package.json'))"].execute().text.trim(),
    "sentry.gradle"
)

if (sentryAuthToken) {
    apply from: sentryGradleFile
} else {
    logger.lifecycle("SENTRY_AUTH_TOKEN is not set; skipping Sentry Gradle source map upload.")
}`;

if (!sentryApplyPattern.test(source)) {
  console.warn("[patch-sentry-gradle] Expected Sentry Gradle apply line was not found; no changes made.");
  process.exit(0);
}

fs.writeFileSync(buildGradlePath, source.replace(sentryApplyPattern, replacement));
console.log("[patch-sentry-gradle] Patched android/app/build.gradle to skip Sentry upload without SENTRY_AUTH_TOKEN.");
