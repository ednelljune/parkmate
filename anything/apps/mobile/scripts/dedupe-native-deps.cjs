const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const duplicatePaths = [
  'node_modules/expo-notifications/node_modules/expo-constants',
  'node_modules/@anythingai/app/node_modules/@sentry',
  'node_modules/@anythingai/app/node_modules/@sentry-internal',
  'node_modules/@anythingai/app/node_modules/@expo/fingerprint',
  'node_modules/@anythingai/app/node_modules/@expo/vector-icons',
  'node_modules/@anythingai/app/node_modules/expo',
  'node_modules/@anythingai/app/node_modules/expo-blur',
  'node_modules/@anythingai/app/node_modules/expo-clipboard',
  'node_modules/@anythingai/app/node_modules/expo-file-system',
  'node_modules/@anythingai/app/node_modules/expo-font',
  'node_modules/@anythingai/app/node_modules/expo-glass-effect',
  'node_modules/@anythingai/app/node_modules/expo-haptics',
  'node_modules/@anythingai/app/node_modules/expo-image',
  'node_modules/@anythingai/app/node_modules/expo-image-picker',
  'node_modules/@anythingai/app/node_modules/expo-linear-gradient',
  'node_modules/@anythingai/app/node_modules/expo-router',
  'node_modules/@anythingai/app/node_modules/expo-secure-store',
  'node_modules/@anythingai/app/node_modules/expo-status-bar',
  'node_modules/@anythingai/app/node_modules/expo-video',
  'node_modules/@anythingai/app/node_modules/expo-web-browser',
  'node_modules/@anythingai/app/node_modules/react-native',
  'node_modules/@teovilla/react-native-web-maps/node_modules/expo-location',
  'node_modules/react-native-calendars/node_modules/react-native-safe-area-context',
];

for (const relativePath of duplicatePaths) {
  const absolutePath = path.join(root, relativePath);
  if (fs.existsSync(absolutePath)) {
    fs.rmSync(absolutePath, { recursive: true, force: true });
    console.log(`Removed duplicate native module: ${relativePath}`);
  }
}
