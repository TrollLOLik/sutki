const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const { withSentryConfig } = require('@sentry/react-native/metro');

const config = getDefaultConfig(__dirname);
const nativeWindConfig = withNativeWind(config, { input: './src/global.css' });

module.exports = withSentryConfig(nativeWindConfig, {
  includeWebReplay: false,
  includeWebFeedback: false,
});
