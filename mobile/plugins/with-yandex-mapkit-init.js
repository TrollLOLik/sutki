const {
  withAppBuildGradle,
  withMainApplication,
} = require('@expo/config-plugins');

const GRADLE_KEY_BLOCK = `def yandexMapKitApiKey = (
    System.getenv("EXPO_PUBLIC_YANDEX_MAPKIT_API_KEY")
        ?: findProperty("YANDEX_MAPKIT_API_KEY")
        ?: ""
).replace("\\\\", "\\\\\\\\").replace('"', '\\\\"')
`;

const BUILD_CONFIG_LINE =
  '        buildConfigField "String", "YANDEX_MAPKIT_API_KEY", "\\"${yandexMapKitApiKey}\\""';
const MAPKIT_DEPENDENCY =
  '    implementation("com.yandex.android:maps.mobile:4.33.1-full")';

const MAPKIT_IMPORT = 'import com.yandex.mapkit.MapKitFactory';
const MAPKIT_INIT_BLOCK = `    if (BuildConfig.YANDEX_MAPKIT_API_KEY.isNotBlank()) {
      MapKitFactory.setLocale("ru_RU")
      MapKitFactory.setApiKey(BuildConfig.YANDEX_MAPKIT_API_KEY)
      MapKitFactory.initialize(this)
    }`;

function withMapKitBuildConfig(config) {
  return withAppBuildGradle(config, (modConfig) => {
    let source = modConfig.modResults.contents;

    if (!source.includes('def yandexMapKitApiKey =')) {
      source = source.replace(
        'def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()\n',
        `def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()\n\n${GRADLE_KEY_BLOCK}`,
      );
    }

    if (!source.includes('buildConfigField "String", "YANDEX_MAPKIT_API_KEY"')) {
      source = source.replace(
        /(\s+buildConfigField "String", "REACT_NATIVE_RELEASE_LEVEL"[^\n]*\n)/,
        `$1${BUILD_CONFIG_LINE}\n`,
      );
    }

    if (!source.includes('implementation("com.yandex.android:maps.mobile:4.33.1-full")')) {
      source = source.replace(
        '    implementation("com.facebook.react:react-android")',
        `    implementation("com.facebook.react:react-android")\n${MAPKIT_DEPENDENCY}`,
      );
    }

    modConfig.modResults.contents = source;
    return modConfig;
  });
}

function withMapKitApplicationInit(config) {
  return withMainApplication(config, (modConfig) => {
    let source = modConfig.modResults.contents;

    if (!source.includes(MAPKIT_IMPORT)) {
      source = source.replace(
        'import android.content.res.Configuration',
        `import android.content.res.Configuration\n\n${MAPKIT_IMPORT}`,
      );
    }

    if (!source.includes('MapKitFactory.setApiKey')) {
      source = source.replace(
        '  override fun onCreate() {\n    super.onCreate()',
        `  override fun onCreate() {\n    super.onCreate()\n${MAPKIT_INIT_BLOCK}`,
      );
    }

    modConfig.modResults.contents = source;
    return modConfig;
  });
}

module.exports = function withYandexMapKitInit(config) {
  config = withMapKitBuildConfig(config);
  return withMapKitApplicationInit(config);
};
