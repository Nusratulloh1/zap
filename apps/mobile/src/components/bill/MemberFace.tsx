// Участник сплита в колонке (spec/11, spec/12): аватар 64 с цветным кольцом,
// бейдж статуса справа-снизу, кружок реакции слева и две подписи.
//
// Раньше участники были строками-карточками; в макете это ряд лиц шириной 90 —
// компания читается одним взглядом, а деньги уходят в подпись.
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Avatar } from '@/components/Avatar';
import { PressableScale } from '@/components/PressableScale';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

interface Props {
  contactId: string;
  name: string;
  color?: string;
  initials?: string;
  /** подпись под именем: «Вы оплатили ⚡», «в долг, вы покрыли», «👀» */
  sub: string;
  paid: boolean;
  /** доля закрыта другим человеком */
  covered?: boolean;
  /** моя реакция на этого участника (или undefined) */
  reaction?: string;
  /** в этот аватар только что прилетела молния — он вздрагивает (zapShake) */
  shake?: boolean;
  onPress?: () => void;
  onReact?: () => void;
}

export function MemberFace({
  contactId, name, color, initials, sub, paid, covered, reaction, shake, onPress, onReact,
}: Props) {
  const { colors, fixed } = useTheme();
  const ring = paid ? fixed.lime : colors.sand2;

  // zapShake из макета: аватар качается, когда до него долетел пинг
  const tilt = useSharedValue(0);
  useEffect(() => {
    if (!shake) return;
    tilt.value = withSequence(
      withTiming(-1, { duration: 90 }),
      withTiming(1, { duration: 110 }),
      withTiming(-0.7, { duration: 100 }),
      withTiming(0.5, { duration: 90 }),
      withTiming(0, { duration: 90 }),
    );
  }, [shake, tilt]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${tilt.value * 8}deg` }, { scale: 1 + Math.abs(tilt.value) * 0.06 }],
  }));

  return (
    <PressableScale haptic={false} style={styles.col} onPress={onPress}>
      <Animated.View style={[styles.ring, { borderColor: ring }, shakeStyle]}>
        <Avatar contactId={contactId} name={name} letter={initials} color={color ?? '#8A887E'} size={58} />

        {/* статус: ✓ у оплативших, «+» у покрытых, «👀» у ожидающих */}
        <View
          style={[
            styles.badge,
            { backgroundColor: paid && !covered ? fixed.lime : colors.sand, borderColor: colors.dune2 },
          ]}
        >
          <Text style={[styles.badgeText, { color: paid && !covered ? fixed.ink : colors.muted }]}>
            {paid ? (covered ? '+' : '✓') : '👀'}
          </Text>
        </View>

        <PressableScale
          style={[
            styles.react,
            { backgroundColor: reaction ? colors.paper : colors.sand, borderColor: colors.dune2 },
          ]}
          onPress={onReact}
        >
          <Text style={[styles.reactText, { color: colors.muted }]}>{reaction ?? '+'}</Text>
        </PressableScale>
      </Animated.View>

      <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>{name}</Text>
      <Text style={[styles.sub, { color: colors.muted }]} numberOfLines={1}>{sub}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  col: { width: 90, alignItems: 'center' },
  ring: { padding: 3, borderRadius: 999, borderWidth: 3 },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10 },
  react: {
    position: 'absolute',
    left: -8,
    top: 18,
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactText: { fontSize: 12 },
  name: { fontFamily: font.bold, fontSize: 12, marginTop: 8 },
  sub: { fontFamily: font.semibold, fontSize: 9.5, marginTop: 2 },
});
