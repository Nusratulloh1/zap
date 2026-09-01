module.exports = {
  project: { ios: {}, android: {} },
  // шрифты и звуки линкуются в нативные проекты командой `npx react-native-asset`.
  // Звуки обязаны попасть в бандл: react-native-sound ищет их в MAIN_BUNDLE на
  // iOS и в res/raw на Android, а не в JS-ассетах.
  assets: ['./assets/fonts', './assets/sounds'],
  dependencies: {
    // «Стекло» нужно только на iOS (UIVisualEffectView). На Android
    // RenderScript-блюра в RN 0.87 нет, а лишний нативный модуль удлиняет
    // сборку и ломает её на машинах с малым объёмом памяти — поэтому
    // отключаем автолинковку для Android, там работает плотный фон.
    '@react-native-community/blur': {
      platforms: { android: null },
    },
  },
};
