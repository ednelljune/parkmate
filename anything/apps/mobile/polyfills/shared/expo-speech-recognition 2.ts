const deniedPermissions = {
  canAskAgain: false,
  expires: "never",
  granted: false,
  status: "denied",
};

export const ExpoSpeechRecognitionModule = {
  abort() {},
  getPermissionsAsync: async () => deniedPermissions,
  requestPermissionsAsync: async () => deniedPermissions,
  start() {
    throw new Error("Speech recognition is not available in this build.");
  },
  stop() {},
};

export default {
  ExpoSpeechRecognitionModule,
};
