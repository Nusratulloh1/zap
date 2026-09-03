// Круг отряда (spec/01-crew): пунктирная окружность 200 pt, владелец сверху,
// участники по нижним углам, в центре «+» — позвать.
//
// Раньше состав был сеткой слотов; в макете это именно круг — компания
// «стоит вокруг стола», и порядок сразу читается: сверху тот, кто собрал.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/Avatar';
import { PressableScale } from '@/components/PressableScale';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

export interface SquadMember {
  contactId: string;
  name: string;
  color?: string;
  initials?: string;
  /** должен вам — на аватаре появляется «⚡» */
  owes?: boolean;
  onPing?: () => void;
}

interface Props {
  owner: SquadMember;
  members: SquadMember[];
  /** цвет фона экрана — им обводятся бейджи */
  frame: string;
  onInvite: () => void;
}

const SIZE = 200;

export function SquadCircle({ owner, members, frame, onInvite }: Props) {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();
  const sides = members.slice(0, 2);

  const face = (m: SquadMember, extra?: 'left' | 'right') => (
    <View>
      <Avatar contactId={m.contactId} name={m.name} letter={m.initials} color={m.color ?? '#8A887E'} size={64} />
      {m.owes ? (
        <PressableScale
          style={[
            styles.bolt,
            extra === 'left' ? styles.boltLeft : styles.boltRight,
            { backgroundColor: colors.ink, borderColor: frame },
          ]}
          onPress={m.onPing}
        >
          <Text style={[styles.boltText, { color: fixed.lime }]}>⚡</Text>
        </PressableScale>
      ) : null}
    </View>
  );

  return (
    <View style={styles.wrap}>
      <View style={[styles.circle, { borderColor: 'rgba(18,18,18,0.28)' }]}>
        {/* владелец — сверху, наполовину над окружностью */}
        <View style={styles.top}>
          {face(owner)}
          <View style={[styles.ownerChip, { backgroundColor: colors.ink, borderColor: frame }]}>
            <Text style={[styles.ownerText, { color: fixed.lime }]}>{t('group.owner')}</Text>
          </View>
        </View>

        {sides.map((m, i) => (
          <View key={m.contactId} style={i === 0 ? styles.left : styles.right}>
            {face(m, i === 0 ? 'left' : 'right')}
            <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>
              {m.name.split(' ')[0]}
            </Text>
          </View>
        ))}

        <PressableScale style={[styles.plus, { backgroundColor: colors.paper }]} onPress={onInvite}>
          <Text style={[styles.plusText, { color: colors.muted }]}>+</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 34 },
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: 999,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  top: { position: 'absolute', left: SIZE / 2 - 32, top: -20, alignItems: 'center' },
  left: { position: 'absolute', left: -20, bottom: 12, alignItems: 'center' },
  right: { position: 'absolute', right: -20, bottom: 12, alignItems: 'center' },
  ownerChip: {
    marginTop: -8,
    borderRadius: 10,
    borderWidth: 2,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  ownerText: { fontFamily: font.monoBold, fontSize: 7, letterSpacing: 1.5 },
  name: { fontFamily: font.bold, fontSize: 11, marginTop: 4 },
  bolt: {
    position: 'absolute',
    bottom: -4,
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boltLeft: { right: -6 },
  boltRight: { left: -6 },
  boltText: { fontSize: 11 },
  plus: {
    position: 'absolute',
    left: SIZE / 2 - 22,
    top: SIZE / 2 - 22,
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: { fontFamily: font.semibold, fontSize: 20 },
});
