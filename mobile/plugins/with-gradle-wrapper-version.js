const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const GRADLE_VERSION = '8.13';

module.exports = function withGradleWrapperVersion(config) {
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const propertiesPath = path.join(
        modConfig.modRequest.platformProjectRoot,
        'gradle',
        'wrapper',
        'gradle-wrapper.properties',
      );
      const source = await fs.promises.readFile(propertiesPath, 'utf8');
      const updated = source.replace(
        /distributionUrl=https\\:\/\/services\.gradle\.org\/distributions\/gradle-[^\r\n]+-bin\.zip/,
        `distributionUrl=https\\://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip`,
      );

      if (updated === source && !source.includes(`gradle-${GRADLE_VERSION}-bin.zip`)) {
        throw new Error('Unable to pin the Android Gradle wrapper version');
      }

      await fs.promises.writeFile(propertiesPath, updated, 'utf8');
      return modConfig;
    },
  ]);
};
