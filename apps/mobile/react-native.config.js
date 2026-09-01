module.exports = {
  project: { ios: {}, android: {} },
  // шрифты линкуются в нативные проекты командой `npx react-native-asset`
  assets: ['./assets/fonts'],
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
