// Подиум из трёх человек — общий для «топ‑3 должника» и «кто принёс больше».
//
// В макете первый стоит в центре и крупнее (80 px, чернильная обводка),
// соседи — по бокам (64 px, лаймовая). Порядок отрисовки 2‑1‑3, поэтому
// список переставляем здесь, а не на каждом экране.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { PressableScale } from '@/components/PressableScale';
import { money } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

export interface PodiumItem {
  key: string;
  contactId: string;
  name: string;
  color?: string;
  initials?: string;
  amount: number;
  sub: string;
  onPress?: () => void;
  /** кнопка «пингануть» в углу аватара — только у должников */
  onPing?: () => void;
  pingDisabled?: boolean;
}

interface Props {
  items: PodiumItem[];
  /** цвет фона экрана — им обводятся бейджи, чтобы не сливались */
  frame: string;
  showPlace?: boolean;
}

export function Podium({ items, frame, showPlace }: Props) {
  const { colors, fixed } = useTheme();
  const withPlace = items.slice(0, 3).map((it, i) => ({ it, place: i + 1 }));
  const order = [withPlace[1], withPlace[0], withPlace[2]].filter(
    (x): x is { it: PodiumItem; place: number } => !!x,
  );

  return (
    <View style={styles.row}>
      {order.map(({ it, place }) => {
        const first = place === 1;
        return (
          <PressableScale key={it.key} haptic={false} disabled={!it.onPress} onPress={it.onPress} style={styles.col}>
            <View>
              <Avatar
                name={it.name}
                letter={it.initials}
                contactId={it.contactId}
                color={it.color ?? '#8A887E'}
                size={first ? 80 : 64}
                ring={first ? colors.ink : fixed.lime}
                ringWidth={3}
              />
              {showPlace ? (
                <View style={[styles.place, { backgroundColor: colors.ink, borderColor: frame }]}>
                  <Text style={[styles.placeText, { color: fixed.lime }]}>{place}</Text>
                </View>
              ) : null}
              {it.onPing ? (
                <PressableScale
                  disabled={it.pingDisabled}
                  style={[
                    styles.ping,
                    { backgroundColor: colors.ink, borderColor: frame, opacity: it.pingDisabled ? 0.45 : 1 },
                  ]}
                  onPress={it.onPing}
                >
                  <Text style={[styles.pingText, { color: fixed.lime }]}>⚡</Text>
                </PressableScale>
              ) : null}
            </View>
            <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>{it.name}</Text>
            <Text style={[styles.amount, { color: colors.ink }]} numberOfLines={1} adjustsFontSizeToFit>
              {money(it.amount)}
            </Text>
            <Text style={[styles.sub, { color: colors.faint }]} numberOfLines={1}>{it.sub}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 10, marginTop: 12 },
  col: { width: 104, alignItems: 'center' },
  name: { fontFamily: font.bold, fontSize: 12, marginTop: 8 },
  amount: { fontFamily: font.extrabold, fontSize: 15, marginTop: 2 },
  sub: { fontFamily: font.semibold, fontSize: 9.5, marginTop: 2 },
  place: {
    position: 'absolute',
    left: -4,
    top: -4,
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeText: { fontFamily: font.monoBold, fontSize: 11 },
  ping: {
    position: 'absolute',
    right: -4,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pingText: { fontSize: 11 },
});
