// «Стекло» из веба (backdrop-filter) средствами платформы.
//
// iOS: настоящий UIVisualEffectView с vibrancy — таб-пилл и шиты выглядят
// как системные материалы, а не как плашка.
// Android: RenderScript-блюра в RN 0.87 больше нет, поэтому оставляем
// работающий плотный фон — ровно тот, что сейчас в проде.
import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
// require под условием: на Android модуль не залинкован (react-native.config.js)
const BlurView: React.ComponentType<Record<string, unknown>> | null =
  Platform.OS === 'ios'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('@react-native-community/blur') as { BlurView: React.ComponentType<Record<string, unknown>> }).BlurView
    : null;

interface Props {
  /** тёмная поверхность (пилл на тёмной теме, подложка шита) */
  dark?: boolean;
  /**
   * Классический blur для таб-бара вместо системных материалов.
   *
   * Диагностика на устройстве (три плитки рядом) показала: материалы
   * (ultraThin/thin/chrome) на светлом контенте визуально не отличаются от
   * плоской заливки — у них сильный собственный тинт и слабое размытие.
   * Классический UIBlurEffectStyleLight даёт честное «морозное стекло»,
   * которое видно. Он же ближе всего к backdrop-filter веба.
   */
  thin?: boolean;
  /** цвет-заглушка для Android и как подложка под стекло на iOS */
  fallback: string;
  /**
   * Оттенок ПОВЕРХ размытия.
   *
   * Класть тон фоном контейнера нельзя: UIVisualEffectView размывает то, что
   * находится ЗА ним, то есть размывал бы этот самый фон — и стекло всегда
   * выходило плоской заливкой, каким бы материал ни был. Тон должен лежать
   * НАД блюром.
   */
  tint?: string;
  /** сила размытия iOS */
  amount?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function Glass({ dark, thin, fallback, tint, amount = 25, style, children }: Props) {
  /*
    «Уменьшение прозрачности» в настройках iOS полностью отключает
    UIVisualEffectView: система подставляет вместо блюра сплошной
    reducedTransparencyFallbackColor, и никакой материал этого не меняет.
    Раньше это выглядело как «блюр не работает». Узнаём об этом явно, чтобы
    в таком режиме дать осознанную плотную подложку, а не выцветшую белую.
  */
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let alive = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then((v) => alive && setReduced(v));
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  if (Platform.OS !== 'ios' || !BlurView || reduced) {
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
        blurType={thin ? (dark ? 'dark' : 'light') : dark ? 'thickMaterialDark' : 'chromeMaterial'}
        blurAmount={amount}
        reducedTransparencyFallbackColor={fallback}
      />
      {tint ? <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} pointerEvents="none" /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ clip: { overflow: 'hidden' } });
