// Экран-заглушка для маршрутов следующих чанков. Нужен именно как экран, а не
// как «ничего не делающая кнопка»: тап с главной должен куда-то приводить и
// иметь путь назад, иначе получаются мёртвые нажатия.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { PressableScale } from '@/components/PressableScale';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

export function SoonScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<any>();
  const route = useRoute();

  return (
    <Screen>
      <View style={styles.root}>
        <Text style={[styles.title, { color: colors.ink }]}>{route.name}</Text>
        <Text style={[styles.sub, { color: colors.muted }]}>Chunk B / C</Text>
        {nav.canGoBack() ? (
          <PressableScale style={[styles.btn, { backgroundColor: colors.sand }]} onPress={() => nav.goBack()}>
            <Text style={[styles.btnText, { color: colors.ink }]}>{t('common.back')}</Text>
          </PressableScale>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontFamily: font.extrabold, fontSize: 26 },
  sub: { fontFamily: font.mono, fontSize: 12, letterSpacing: 1.5 },
  btn: { marginTop: 18, height: 46, paddingHorizontal: 24, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: font.bold, fontSize: 15 },
});
