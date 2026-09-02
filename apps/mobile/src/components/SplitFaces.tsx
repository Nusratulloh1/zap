// Лица участников сплита стопкой — вместо буквы мерчанта в списках.
//
// Требование руководства: в сплитах должны быть люди, а не инициалы. Первым
// идёт «я», дальше остальные; если не влезли — счётчик «+N» кружком.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import type { Split } from '@zap/shared/types';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

interface Props {
  split: Split;
  /** размер лица; стопка сжимается пропорционально */
  size?: number;
  max?: number;
  /** цвет обводки — под фон карточки */
  ring?: string;
}

export function SplitFaces({ split, size = 40, max = 3, ring }: Props) {
  const { colors } = useTheme();
  const ids = [...split.members]
    .sort((a, b) => Number(b.isYou) - Number(a.isYou))
    .map((m) => (m.isYou ? 'me' : m.contactId));
  const shown = ids.slice(0, max);
  const rest = ids.length - shown.length;

  return (
    <View style={styles.row}>
      {shown.map((cid, i) => (
        <Avatar
          key={cid + i}
          contactId={cid}
          size={size}
          ring={ring ?? colors.paper}
          ringWidth={2}
          style={i > 0 ? { marginLeft: -size * 0.42 } : undefined}
        />
      ))}
      {rest > 0 ? (
        <View
          style={[
            styles.more,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: -size * 0.42,
              backgroundColor: colors.sand,
              borderColor: ring ?? colors.paper,
            },
          ]}
        >
          <Text style={[styles.moreText, { color: colors.muted, fontSize: size * 0.32 }]}>+{rest}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  more: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  moreText: { fontFamily: font.extrabold },
});
