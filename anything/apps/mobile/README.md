## Android EAS build

This app is already linked to EAS and uses [`eas.json`](/Users/junes/Desktop/parkmate/parkmate/anything/apps/mobile/eas.json:1) for Android build profiles.

### Profiles

- `development`: internal Android development client build as an `apk`
- `preview`: internal Android preview build as an `apk`
- `production`: store-ready Android build as an `aab`

### Required environment

Android native builds in this repo require:

- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`

The build will fail on EAS if that variable is missing. This is enforced by [`app.config.js`](/Users/junes/Desktop/parkmate/parkmate/anything/apps/mobile/app.config.js:1) and [`android/app/build.gradle`](/Users/junes/Desktop/parkmate/parkmate/anything/apps/mobile/android/app/build.gradle:83).

Optional for Android push notifications:

- `google-services.json` in `anything/apps/mobile/`
- or `EXPO_PUBLIC_ANDROID_FCM_CONFIGURED=true` if you want the app to treat FCM as configured without shipping the file yet

### Commands

Run from `anything/apps/mobile`:

```sh
npm run eas:build:android:development
npm run eas:build:android:preview
npm run eas:build:android:production
npm run eas:submit:android:production
```

### First-time CLI steps

```sh
npx eas login
npx eas build:configure
```

If credentials are not already set up on EAS, the first Android build will prompt to create or reuse the keystore.
