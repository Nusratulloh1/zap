// Стопка логотипов РЕАЛЬНЫХ мерчантов (не статичная тройка из дизайна).
//
// Для известных партнёров — фирменный знак из ассетов, для остальных —
// кружок с буквой в цвете мерчанта. Показываем не больше трёх, как в макете.
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { Merchant } from '@zap/shared/types';
import { font } from '@/theme/tokens';

const LOGO_BY_NAME: Record<string, number> = {
  EVOS: require('../../assets/brand/partners/evos-logo.png'),
  'Feed Up': require('../../assets/brand/partners/feedup-logo.png'),
  'Bellissimo Pizza': require('../../assets/brand/partners/bellissimo-logo.png'),
  'Safia café': require('../../assets/brand/partners/safia-sq.png'),
};

interface Props {
  merchants: Merchant[];
  size?: number;
}

export function MerchantLogos({ merchants, size = 36 }: Props) {
  const shown = merchants.slice(0, 3);
  return (
    <View style={styles.row}>
      {shown.map((m, i) => {
        const logo = LOGO_BY_NAME[m.name];
        const frame = [
          styles.item,
          { width: size, height: size, borderRadius: size * 0.32 },
          i > 0 && { marginLeft: -size * 0.28 },
        ];
        return logo ? (
          <Image key={m.id} source={logo} style={frame} />
        ) : (
          <View key={m.id} style={[frame, { backgroundColor: m.color ?? '#111110' }]}>
            <Text style={[styles.letter, { fontSize: size * 0.42 }]}>{m.letter}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  letter: { fontFamily: font.extrabold, color: '#FFFFFF' },
});
