const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const exclusionList = require('metro-config/private/defaults/exclusionList').default;

const config = process.env.SENTRY_DISABLE_METRO === 'true'
  ? getDefaultConfig(__dirname)
  : getSentryExpoConfig(__dirname, {
      includeWebReplay: false,
    });
config.resolver.blockList = exclusionList([
  // Gradle creates and removes these ABI-specific native build folders while
  // Metro is running. Watching them on Windows races with the cleanup and can
  // terminate Metro with ENOENT (for example, reanimated's android.x86 dir).
  /[/\\]node_modules[/\\].*[/\\]android[/\\]build[/\\].*/,
]);

module.exports = withNativeWind(config, { input: './src/global.css' });
