// «Стекло» из веба (backdrop-filter) средствами платформы.
//
// iOS: настоящий UIVisualEffectView с vibrancy — таб-пилл и шиты выглядят
// как системные материалы, а не как плашка.
// Android: RenderScript-блюра в RN 0.87 больше нет, поэтому оставляем
// работающий плотный фон — ровно тот, что сейчас в проде.
import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
// require под условием: на Android модуль не залинкован (react-native.config.js)
const BlurView: React.ComponentType<Record<string, unknown>> | null =
  Platform.OS === 'ios'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('@react-native-community/blur') as { BlurView: React.ComponentType<Record<string, unknown>> }).BlurView
    : null;

interface Props {
  /** тёмная поверхность (пилл на тёмной теме, подложка шита) */
  dark?: boolean;
  /** цвет-заглушка для Android и как подложка под стекло на iOS */
  fallback: string;
  /** сила размытия iOS */
  amount?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function Glass({ dark, fallback, amount = 18, style, children }: Props) {
  if (Platform.OS !== 'ios' || !BlurView) {
    return <View style={[style, { backgroundColor: fallback }]}>{children}</View>;
  }
  // ВАЖНО: у контейнера не должно быть своего фона. UIVisualEffectView
  // размывает то, что находится ЗА ним в иерархии, и непрозрачная подложка
  // родителя превращает стекло в плоскую заливку. Запасной цвет отдаём
  // только самому эффекту — он применит его при «Уменьшении прозрачности».
  return (
    <View style={[style, styles.clip]}>
      <BlurView
        style={StyleSheet.absoluteFill as object}
        blurType={dark ? 'thickMaterialDark' : 'chromeMaterial'}
        blurAmount={amount}
        reducedTransparencyFallbackColor={fallback}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ clip: { overflow: 'hidden' } });
