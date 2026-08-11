// app.config.js — dynamic Expo config, replaces app.json.
// Yandex MapKit API key is read from the environment so it is never committed.
// Set EXPO_PUBLIC_YANDEX_MAPKIT_API_KEY in your local or EAS environment before running
// `npx expo prebuild` / `eas build`.

module.exports = {
  expo: {
    name: "ВИГАЖ",
    slug: "wigaj-arenda",
    version: "1.2.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "wigaj-arenda",
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
      versionCode: 2,
      // Keep the chat composer above keyboards of different heights,
      // including Gboard's emoji panel.
      softwareKeyboardLayoutMode: "resize",
      adaptiveIcon: {
        backgroundColor: "#FF5A1F",
        foregroundImage: "./assets/images/android-icon-foreground.png",
      },
      predictiveBackGestureEnabled: false,
      package: "ru.wigaj.arenda",
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "https",
              host: "arenda.wigaj.ru",
              pathPrefix: "/listing/",
            },
            {
              scheme: "https",
              host: "arenda.wigaj.ru",
              pathPrefix: "/profile/",
            },
          ],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
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
      "./plugins/with-rich-content-text-input",
      "./plugins/with-yandex-mapkit-init",
      [
        "expo-splash-screen",
        {
          backgroundColor: "#FF5A1F",
          image: "./assets/images/splash-icon.png",
          imageWidth: 160,
        },
      ],
      "expo-secure-store",
      // Сжатие видео на устройстве перед отправкой в чат. Плагин нужен, чтобы
      // нативная часть попала в сборку: без него compress падает в рантайме.
      "react-native-compressor",
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
      [
        "@sentry/react-native/expo",
        {
          url: process.env.SENTRY_URL || "https://errors.wigaj.ru",
          organization: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          disableAutoUpload: !process.env.SENTRY_AUTH_TOKEN,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: false,
    },
  },
};
