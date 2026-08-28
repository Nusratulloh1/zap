const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// Локали — общий пакет монорепо (packages/locales). Папка добавлена в
// watchFolders, иначе Metro не видит файлы вне projectRoot; резолвер при этом
// продолжает брать зависимости только из mobile/node_modules.
const repoRoot = path.resolve(__dirname, '..');

/** @type {import('@react-native/metro-config').MetroConfig} */
const config = {
  watchFolders: [path.resolve(repoRoot, 'packages', 'locales')],
  resolver: {
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
