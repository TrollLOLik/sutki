// app.config.js — dynamic Expo config, replaces app.json.
// Yandex MapKit API key is read from the environment so it is never committed.
// Set YANDEX_MAPKIT_API_KEY in your shell or CI secrets before running
// `npx expo prebuild` / `eas build`.

module.exports = {
  expo: {
    name: "Дом рядом",
    slug: "sutki",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "sutki",
    userInterfaceStyle: "automatic",
    ios: {
      supportsTablet: true,
      infoPlist: {
        // Required for the "ко мне" FAB location button.
        NSLocationWhenInUseUsageDescription:
          "Приложению требуется доступ к геолокации, чтобы показать ваше положение на карте.",
        // Needed so Linking.canOpenURL('yandexmaps://') returns a real answer
        // instead of always false on iOS 9+.
        LSApplicationQueriesSchemes: ["yandexmaps"],
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#FF5A1F",
        foregroundImage: "./assets/images/android-icon-foreground.png",
      },
      predictiveBackGestureEnabled: false,
      package: "com.anonymous.sutki",
      permissions: [
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
      ],
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          backgroundColor: "#FF5A1F",
          image: "./assets/images/splash-icon.png",
          imageWidth: 160,
        },
      ],
      "expo-secure-store",
      [
        "expo-build-properties",
        {
          "android": {
            "minSdkVersion": 26
          }
        }
      ],
      [
        "react-native-yamap-plus",
        {
          // Lite SDK is enough for MVP (no pedestrian/bicycle routing).
          // Switch to false when you need full routing features.
          android_useYandexMapKitLite: false,
          ios_useYandexMapKitLite: false,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: false,
    },
  },
};
