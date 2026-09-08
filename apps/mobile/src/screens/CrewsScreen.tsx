// Все компании списком — «все N →» с главной.
//
// Раньше ссылка разворачивала список прямо на главной: он вырастал между
// плитками и лентой, и ради двух лишних строк приходилось прокручивать всю
// страницу заново. Отдельный экран показывает состав, знак и состояние счёта
// у каждой компании, и с него сразу заходишь внутрь.
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { Avatar } from '@/components/Avatar';
import { PressableScale } from '@/components/PressableScale';
import { SectionLabel } from '@/components/SectionLabel';
import { BackIcon } from '@/components/icons';
import { useHomeData } from '@/store/bootstrap';
import { crewColorOf, crewEmojiOf, useCrewSignsVersion } from '@/lib/crewEmoji';
import { money, peopleCount } from '@/lib/format';
import { isDarkSkin, useSkin } from '@/lib/screenSkin';
import { useTheme } from '@/theme/ThemeProvider';
import { SCREEN_PAD_X, font } from '@/theme/tokens';

export function CrewsScreen() {
  const { t } = useTranslation();
  const nav = useNavigation<any>();
  const home = useHomeData();
  const { colors, fixed } = useTheme();
  const skin = useSkin();
  const signs = useCrewSignsVersion();

  const bg = skin ?? colors.dune2;
  const onDark = isDarkSkin(bg);
  const ink = onDark ? '#FFFFFF' : colors.ink;

  const crews = useMemo(
    () =>
      home.groups.map((g) => {
        const splits = home.splits.filter((s) => s.groupId === g.id);
        const active = splits.find((s) => s.status === 'active');
        return {
          id: g.id,
          name: g.name,
          glyph: crewEmojiOf(home.db, g.id),
          color: crewColorOf(home.db, g.id),
          members: g.memberIds,
          cashback: g.cashback,
          zaps: splits.length,
          waiting: active
            ? active.members.filter((m) => m.status !== 'paid' && m.status !== 'debt').length
            : 0,
        };
      }),
    // signs — версия локальных знаков: без неё смена эмодзи сюда не долетит
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [home.groups, home.splits, home.db, signs],
  );

  return (
    <Screen style={styles.root} background={bg} darkBar={onDark}>
      <View style={styles.head}>
        <PressableScale
          small
          style={[styles.round, { backgroundColor: onDark ? 'rgba(255,255,255,0.12)' : colors.paper }]}
          onPress={() => nav.goBack()}
        >
          <BackIcon size={20} color={ink} />
        </PressableScale>
        <Text style={[styles.title, { color: ink }]} numberOfLines={1}>{t('home2.crews')}</Text>
        <View style={styles.round} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <SectionLabel onDark={onDark} style={styles.section}>
          {t('home2.crewsCount', { n: crews.length })}
        </SectionLabel>

        {crews.map((crew) => (
          <PressableScale
            key={crew.id}
            haptic={false}
            style={[styles.row, { backgroundColor: colors.paper }]}
            onPress={() => nav.navigate('Group', { id: crew.id })}
          >
            <View style={[styles.icon, { backgroundColor: crew.color }]}>
              <Text style={styles.iconGlyph}>{crew.glyph}</Text>
            </View>

            <View style={styles.body}>
              <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>{crew.name}</Text>
              <View style={styles.faces}>
                {crew.members.slice(0, 4).map((cid, i) => (
                  <Avatar
                    key={cid}
                    contactId={cid}
                    name={home.nameOfContact(cid)}
                    color={home.contactById(cid)?.color}
                    size={20}
                    ring={colors.paper}
                    ringWidth={1.5}
                    style={i > 0 ? styles.faceStacked : undefined}
                  />
                ))}
                <Text style={[styles.sub, { color: colors.muted }]} numberOfLines={1}>
                  {peopleCount(crew.members.length)} · {t('home2.crewZaps', { n: crew.zaps })}
                </Text>
              </View>
            </View>

            <View style={styles.right}>
              <Text style={[styles.cashback, { color: colors.ink }]} numberOfLines={1}>
                {money(crew.cashback)}
              </Text>
              {crew.waiting ? (
                <View style={[styles.chip, { backgroundColor: fixed.lime }]}>
                  <Text style={[styles.chipText, { color: fixed.ink }]}>
                    {t('home2.crewWaitingShort', { n: crew.waiting })}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.sub, { color: colors.muted }]}>{t('home2.crewSettled')}</Text>
              )}
            </View>
          </PressableScale>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: SCREEN_PAD_X },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 },
  round: { width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: font.extrabold, fontSize: 19 },
  scroll: { paddingBottom: 120 },
  section: { marginTop: 22, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 14, marginBottom: 8 },
  icon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  iconGlyph: { fontSize: 21 },
  body: { flex: 1, minWidth: 0 },
  name: { fontFamily: font.extrabold, fontSize: 15 },
  faces: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  faceStacked: { marginLeft: -8 },
  sub: { fontFamily: font.semibold, fontSize: 10.5, marginLeft: 6, flexShrink: 1 },
  right: { alignItems: 'flex-end', gap: 6 },
  cashback: { fontFamily: font.monoBold, fontSize: 13 },
  chip: { borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8 },
  chipText: { fontFamily: font.extrabold, fontSize: 10 },
});
