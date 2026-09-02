// Выбор знака компании — «Select emoji for Crew».
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { trigger } from 'react-native-haptic-feedback';
import { BottomSheet } from '@/components/BottomSheet';
import { PressableScale } from '@/components/PressableScale';
import { CREW_EMOJI, setCrewEmoji } from '@/lib/crewEmoji';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

interface Props {
  open: boolean;
  groupId: string;
  current: string;
  onClose: () => void;
}

export function CrewEmojiSheet({ open, groupId, current, onClose }: Props) {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();

  const pick = (e: string) => {
    trigger('impactMedium', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
    setCrewEmoji(groupId, e);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={[styles.title, { color: colors.ink }]}>{t('group.pickEmoji')}</Text>
      <View style={styles.grid}>
        {CREW_EMOJI.map((e) => (
          <PressableScale key={e} haptic={false} onPress={() => pick(e)}>
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
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: font.extrabold, fontSize: 19, letterSpacing: -0.2, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', paddingBottom: 8 },
  cell: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 26 },
});
