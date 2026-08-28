module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@': './src',
          // локали лежат в веб-приложении — переводим один раз на два клиента
          '@locales': '../src/locales',
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      },
    ],
    // reanimated обязан идти последним
    'react-native-worklets/plugin',
  ],
};
