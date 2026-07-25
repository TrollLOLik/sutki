const fs = require('fs');
const path = require('path');
const {
	withDangerousMod,
	withMainApplication,
} = require('@expo/config-plugins');

const PACKAGE_PATH = path.join('ru', 'titop', 'arenda', 'chat');
const IMPORT_LINE = 'import ru.titop.arenda.chat.RichContentPackage';
const ADD_LINE = '          add(RichContentPackage())';

function withRichContentSources(config) {
	return withDangerousMod(config, [
		'android',
		async (modConfig) => {
			const sourceDir = path.join(__dirname, 'rich-content-text-input', 'android');
			const destinationDir = path.join(
				modConfig.modRequest.platformProjectRoot,
				'app',
				'src',
				'main',
				'java',
				PACKAGE_PATH,
			);

			fs.mkdirSync(destinationDir, { recursive: true });
			for (const name of fs.readdirSync(sourceDir)) {
				fs.copyFileSync(
					path.join(sourceDir, name),
					path.join(destinationDir, name),
				);
			}
			return modConfig;
		},
	]);
}

function withRichContentRegistration(config) {
	return withMainApplication(config, (modConfig) => {
		let source = modConfig.modResults.contents;

		if (!source.includes(IMPORT_LINE)) {
			source = source.replace(
				'import expo.modules.ExpoReactHostFactory',
				`import expo.modules.ExpoReactHostFactory\n${IMPORT_LINE}`,
			);
		}

		if (!source.includes('add(RichContentPackage())')) {
			source = source.replace(
				'          // add(MyReactNativePackage())',
				`${ADD_LINE}`,
			);
		}

		modConfig.modResults.contents = source;
		return modConfig;
	});
}

module.exports = function withRichContentTextInput(config) {
	config = withRichContentSources(config);
	return withRichContentRegistration(config);
};
