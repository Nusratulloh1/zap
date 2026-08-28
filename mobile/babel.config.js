module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@': './src',
          // локали — общий пакет монорепо, один источник на веб и мобильный
          '@locales': '../packages/locales',
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      },
    ],
    // reanimated обязан идти последним
    'react-native-worklets/plugin',
  ],
};
