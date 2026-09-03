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
  /** моя реакция на этого участника (или undefined) */
  reaction?: string;
  /** в этот аватар только что прилетела молния — он вздрагивает (zapShake) */
  shake?: boolean;
  onPress?: () => void;
  onReact?: () => void;
}

export function MemberFace({
  contactId, name, color, initials, sub, paid, reaction, shake, onPress, onReact,
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

  const pop = useSharedValue(reaction ? 1 : 0);
  useEffect(() => {
    if (!reaction) {
      pop.value = 0;
      return;
    }
    pop.value = withSequence(
      withTiming(0, { duration: 0 }),
      withTiming(1.15, { duration: 300 }),
      withTiming(1, { duration: 200 }),
    );
  }, [reaction, pop]);

  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reaction ? 0.6 + pop.value * 0.4 : 1 }],
  }));

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${tilt.value * 8}deg` }, { scale: 1 + Math.abs(tilt.value) * 0.06 }],
  }));

  return (
    <PressableScale haptic={false} style={styles.col} onPress={onPress}>
      <Animated.View style={[styles.ring, { borderColor: ring }, shakeStyle]}>
        {/* неоплатившие в макете приглушены до 55% — взгляд идёт к оплатившим */}
        <View style={paid ? undefined : styles.dim}>
          <Avatar contactId={contactId} name={name} letter={initials} color={color ?? '#8A887E'} size={58} />
        </View>

        {/* статус из макета: ✓ на лайме у оплативших, «+» у ожидающих */}
        <View
          style={[
            styles.badge,
            { backgroundColor: paid ? fixed.lime : colors.cream, borderColor: colors.dune2 },
          ]}
        >
          <Text style={[styles.badgeText, { color: paid ? fixed.ink : colors.muted }]}>
            {paid ? '✓' : '+'}
          </Text>
        </View>

        <Animated.View style={[styles.react, popStyle]}>
          <PressableScale
            style={[
              styles.reactBtn,
              { backgroundColor: reaction ? colors.paper : colors.cream, borderColor: colors.dune2 },
            ]}
            onPress={onReact}
          >
            <Text style={[styles.reactText, { color: colors.muted }]}>{reaction ?? '+'}</Text>
          </PressableScale>
        </Animated.View>
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
  react: { position: 'absolute', left: -8, top: 18 },
  reactBtn: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: { opacity: 0.55 },
  reactText: { fontSize: 12 },
  name: { fontFamily: font.bold, fontSize: 12, marginTop: 8 },
  sub: { fontFamily: font.semibold, fontSize: 9.5, marginTop: 2 },
});
