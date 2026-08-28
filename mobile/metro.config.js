const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// Локали — общие с веб-приложением: mobile/ читает src/locales/*.json из корня
// репозитория, поэтому корень добавлен в watchFolders, а его node_modules —
// в резолвер (иначе Metro не найдёт пакеты для файлов вне projectRoot).
const repoRoot = path.resolve(__dirname, '..');

/** @type {import('@react-native/metro-config').MetroConfig} */
const config = {
  watchFolders: [path.resolve(repoRoot, 'src', 'locales')],
  resolver: {
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
