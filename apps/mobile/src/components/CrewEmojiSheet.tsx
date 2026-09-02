// Выбор знака компании — «Select emoji for Crew».
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { trigger } from 'react-native-haptic-feedback';
import { BottomSheet } from '@/components/BottomSheet';
import { PressableScale } from '@/components/PressableScale';
import { CREW_COLORS, CREW_EMOJI, setCrewColor, setCrewEmoji } from '@/lib/crewEmoji';
import { VenueIcon } from '@/components/VenueIcon';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

interface Props {
  open: boolean;
  groupId: string;
  current: string;
  currentColor: string;
  onClose: () => void;
}

export function CrewEmojiSheet({ open, groupId, current, currentColor, onClose }: Props) {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();

  const tap = () =>
    trigger('impactMedium', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });

  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={[styles.title, { color: colors.ink }]}>{t('group.pickEmoji')}</Text>

      {/* предпросмотр — сразу видно, что получится */}
      <View style={styles.preview}>
        <VenueIcon name="" glyph={current} color={currentColor} size={64} />
      </View>

      <View style={styles.colors}>
        {CREW_COLORS.map((c) => (
          <PressableScale
            key={c}
            haptic={false}
            onPress={() => {
              tap();
              setCrewColor(groupId, c);
            }}
          >
            <View
              style={[
                styles.swatch,
                { backgroundColor: c },
                c === currentColor && { borderColor: colors.ink, borderWidth: 3 },
              ]}
            />
          </PressableScale>
        ))}
      </View>

      <View style={styles.grid}>
        {CREW_EMOJI.map((e) => (
          <PressableScale
            key={e}
            haptic={false}
            onPress={() => {
              tap();
              setCrewEmoji(groupId, e);
            }}
          >
            <View
              style={[
                styles.cell,
                { backgroundColor: colors.sand },
                e === current && { backgroundColor: fixed.lime },
              ]}
            >
              <Text style={styles.glyph}>{e}</Text>
            </View>
          </PressableScale>
        ))}
      </View>

      <PressableScale style={[styles.done, { backgroundColor: colors.ink }]} onPress={onClose}>
        <Text style={[styles.doneText, { color: fixed.lime }]}>{t('common.done')}</Text>
      </PressableScale>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: font.extrabold, fontSize: 19, letterSpacing: -0.2, marginBottom: 14 },
  preview: { alignItems: 'center', marginBottom: 16 },
  colors: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 16 },
  swatch: { width: 34, height: 34, borderRadius: 999, borderWidth: 0, borderColor: 'transparent' },
  done: { height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  doneText: { fontFamily: font.extrabold, fontSize: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', paddingBottom: 8 },
  cell: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 26 },
});
