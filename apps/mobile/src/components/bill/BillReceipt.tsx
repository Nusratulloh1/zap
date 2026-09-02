// Центральный чек живого счёта — «Receipt: центральный объект всего UX»
// (vision, часть B §2).
//
// Это ОДИН адресуемый узел, а не контейнер списка: следующая анимация
// Split the Bill сожмёт его (scale 1 → 0.96), прогонит сверху вниз лаймовую
// молнию и разорвёт на 3–4 куска, которые улетят к аватарам. Поэтому:
//   • корень — Animated.View с animatedRef, зарегистрированным в BillStage;
//   • «линия отрыва» вынесена отдельным слоем (по ней пойдёт разрыв);
//   • содержимое не завязано на layout соседей — куски можно вырезать.
import React, { useEffect } from 'react';
import { Image, type ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { CountUp } from '@/components/CountUp';
import { useBillStage } from '@/lib/billStage';
import { money } from '@/lib/format';
import { merchantGlyph } from '@/lib/merchantLogo';
import { useTheme } from '@/theme/ThemeProvider';
import { receiptTitle } from '@/lib/merchant';
import { font, radius } from '@/theme/tokens';

/** Сколько зубцов по низу чека и какой они высоты. */
const NOTCH_N = 22;
const NOTCH_H = 9;

/** Пила: вниз-вверх по всей ширине, координаты в единицах viewBox. */
function notchPath(): string {
  const d: string[] = ['M0 0'];
  for (let i = 0; i < NOTCH_N; i += 1) d.push(`L${i * 2 + 1} 1`, `L${i * 2 + 2} 0`);
  d.push('Z');
  return d.join(' ');
}

interface Props {
  title: string;
  merchantName?: string;
  merchantLogo?: ImageSourcePropType;
  orderLine?: string;
  total: number;
  paidAmount: number;
  onPressTitle?: () => void;
}

export function BillReceipt({ title, merchantName, merchantLogo, orderLine, total, paidAmount, onPressTitle }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const stage = useBillStage();
  const ref = useAnimatedRef<View>();

  useEffect(() => {
    stage?.setReceipt(ref);
    return () => stage?.setReceipt(null);
  }, [stage, ref]);

  // «ООО "ALIMBAYEV TRADE"» -> «Alimbayev Trade»; своё имя вечера не трогаем
  const shown = receiptTitle(title);

  return (
    <Animated.View ref={ref} style={[styles.root, { backgroundColor: colors.paper }]}>
      {/* шапка чека: логотип мерчанта и название вечера */}
      <View style={styles.head}>
        {merchantLogo ? (
          <Image source={merchantLogo} style={styles.logo} />
        ) : (
          <View style={[styles.logo, styles.logoFallback, { backgroundColor: colors.ink }]}>
            <Text style={styles.logoLetter}>
              {merchantGlyph(merchantName ?? shown)}
            </Text>
          </View>
        )}
        <View style={styles.headBody}>
          <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1} onPress={onPressTitle}>
            {shown}
          </Text>
          {orderLine ? (
            <Text style={[styles.order, { color: colors.faint2 }]} numberOfLines={1}>
              {orderLine}
            </Text>
          ) : null}
        </View>
      </View>

      {/* линия отрыва: по ней Split the Bill порвёт чек */}
      <View style={[styles.tear, { borderColor: colors.hairline }]} />

      <View style={styles.amountRow}>
        <CountUp value={paidAmount} duration={600} style={[styles.amount, { color: colors.ink }]} />
        <Text style={[styles.of, { color: colors.faint }]}>
          {t('live.paidOfTotal', { total: money(total) })}
        </Text>
      </View>

      {/* оторванный низ: тот же цвет бумаги, зубцами вниз */}
      <View style={styles.notchWrap} pointerEvents="none">
        <Svg width="100%" height={NOTCH_H} viewBox={`0 0 ${NOTCH_N * 2} 1`} preserveAspectRatio="none">
          <Path d={notchPath()} fill={colors.paper} />
        </Svg>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    // низ плоский: под ним живут зубцы, скругление там всё испортило бы
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: 18,
    paddingBottom: 20,
    // тень плотнее прежней: бумага должна лежать НАД экраном
    shadowColor: '#1E1C10',
    shadowOpacity: 0.1,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  notchWrap: { position: 'absolute', left: 0, right: 0, bottom: -NOTCH_H, height: NOTCH_H },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 56, height: 56, borderRadius: 17 },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  logoLetter: { fontFamily: font.extrabold, fontSize: 21 },
  headBody: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: font.extrabold, fontSize: 20, letterSpacing: -0.3 },
  order: { fontFamily: font.monoBold, fontSize: 10, letterSpacing: 1.2 },
  tear: { borderTopWidth: 2, borderStyle: 'dashed', marginVertical: 14 },
  amountRow: { gap: 2 },
  amount: { fontFamily: font.monoBold, fontSize: 34, letterSpacing: -1 },
  of: { fontFamily: font.semibold, fontSize: 13 },
});
