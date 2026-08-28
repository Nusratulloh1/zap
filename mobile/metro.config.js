const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// Общие пакеты монорепо (packages/locales, packages/shared) лежат вне
// projectRoot, поэтому добавлены в watchFolders. Резолвер при этом намеренно
// смотрит только в mobile/node_modules: RN ломается на чужих деревьях.
const repoRoot = path.resolve(__dirname, '..');

/** @type {import('@react-native/metro-config').MetroConfig} */
const config = {
  watchFolders: [
    path.resolve(repoRoot, 'packages', 'locales'),
    path.resolve(repoRoot, 'packages', 'shared'),
  ],
  resolver: {
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
