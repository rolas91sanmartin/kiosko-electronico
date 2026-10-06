const { withAppBuildGradle, withMainApplication, withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

module.exports = function withPlayUpdate(config) {
  config = withAppBuildGradle(config, config => {
    if (!config.modResults.contents.includes('com.google.android.play:app-update:')) {
      config.modResults.contents = config.modResults.contents.replace(/dependencies\s*\{/, 'dependencies {\n    implementation("com.google.android.play:app-update:2.1.0")');
    }
    return config;
  });
  config = withMainApplication(config, config => {
    if (!config.modResults.contents.includes('add(com.sanmartin.kiosko.update.PlayUpdatePackage())')) {
      config.modResults.contents = config.modResults.contents.replace('PackageList(this).packages.apply {', 'PackageList(this).packages.apply {\n          add(com.sanmartin.kiosko.update.PlayUpdatePackage())');
    }
    return config;
  });
  return withDangerousMod(config, ['android', async config => {
    const target = path.join(config.modRequest.platformProjectRoot, 'app/src/main/java/com/sanmartin/kiosko/update');
    fs.mkdirSync(target, { recursive: true });
    fs.copyFileSync(path.join(__dirname, 'play-update/PlayUpdatePackage.kt'), path.join(target, 'PlayUpdatePackage.kt'));
    return config;
  }]);
};
