// «Сохранить эту компанию?» — порт SaveGroupPage.vue (дизайн 3h): стек
// аватаров, карточка с названием и участниками, тумблер кэшбэка, CTA.
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PressableScale } from '@/components/PressableScale';
import { Avatar } from '@/components/Avatar';
import { VenueIcon } from '@/components/VenueIcon';
import { CREW_COLORS, CREW_EMOJI, colorForGlyph, setCrewColor, setCrewEmoji } from '@/lib/crewEmoji';
import { Toggle } from '@/components/Toggle';
import { toast } from '@/components/ToastHost';
import { fetchSplit, saveGroup } from '@/api/splits';
import { qk } from '@/api/data';
import type { Db } from '@zap/shared/types';
import { useHomeData } from '@/store/bootstrap';
import { useTheme } from '@/theme/ThemeProvider';
import { SCREEN_PAD_X, font, radius } from '@/theme/tokens';

export function SaveGroupScreen() {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const qc = useQueryClient();
  const home = useHomeData();
  const id = route.params?.id as string;

  const { data: split } = useQuery({
    queryKey: qk.split(id),
    queryFn: () => fetchSplit(id),
    enabled: !!id,
    // сплит уже есть в загруженном /bootstrap — рисуем сразу, сеть догоняет
    initialData: () => qc.getQueryData<Db>(qk.bootstrap)?.splits.find((s) => s.id === id),
    initialDataUpdatedAt: () => qc.getQueryState(qk.bootstrap)?.dataUpdatedAt,
  });

  const nameOf = (cid: string) =>
    cid === 'me' ? (home.db?.user?.name ?? t('members.youShort')) : (home.contactById(cid)?.name ?? '?');
  const colorOf = (cid: string) => (cid === 'me' ? '#111110' : (home.contactById(cid)?.color ?? '#8A887E'));

  const [name, setName] = useState('');
  const [accrue, setAccrue] = useState(true);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  // знак и цвет компании выбираются здесь же, при создании
  const [glyph, setGlyph] = useState<string>('🍕');
  const [color, setColor] = useState<string>(colorForGlyph('🍕'));
  const [saving, setSaving] = useState(false);

  // название по умолчанию — из имён участников: «Nusrat + Amal»
  const suggested = useMemo(() => {
    const firsts = memberIds.map((cid) => nameOf(cid).split(' ')[0]).filter(Boolean).slice(0, 3);
    return firsts.length > 1 ? firsts.join(' + ') : t('saveGroup.andCompany', { name: firsts[0] ?? '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberIds]);

  useEffect(() => {
    if (!split || memberIds.length) return;
    setMemberIds(split.members.map((m) => m.contactId));
    const existing = split.groupId ? home.db?.groups.find((g) => g.id === split.groupId) : undefined;
    if (existing) {
      setName(existing.name);
      setAccrue(existing.accrueCashback);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [split]);

  useEffect(() => {
    if (!name && memberIds.length) setName(suggested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggested]);

  const save = async () => {
    if (saving || !name.trim()) return;
    setSaving(true);
    try {
      const created = await saveGroup(id, name.trim(), accrue, memberIds);
      // знак живёт локально: привязываем к id, который вернул сервер
      setCrewEmoji(created.id, glyph);
      setCrewColor(created.id, color);
      await qc.invalidateQueries({ queryKey: qk.bootstrap });
      toast.success(t('saveGroup.saved'));
      nav.replace('CashbackAward', { id });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen style={styles.root} background={colors.dune}>
      <ScreenHeader onBack={() => nav.popTo('SplitClosed', { id })} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10, flexGrow: 1 }}>
        {/* значок компании: сначала показываем, потом даём поменять */}
        <View style={styles.iconWrap}>
          <VenueIcon name={name} glyph={glyph} color={color} size={76} />
        </View>

        <View style={styles.swatches}>
          {CREW_COLORS.map((c) => (
            <PressableScale key={c} haptic onPress={() => setColor(c)}>
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: c },
                  c === color && { borderWidth: 3, borderColor: colors.ink },
                ]}
              />
            </PressableScale>
          ))}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.glyphStrip}
          contentContainerStyle={styles.glyphBody}
        >
          {CREW_EMOJI.map((e) => (
            <PressableScale
              key={e}
              haptic
              onPress={() => {
                setGlyph(e);
                setColor(colorForGlyph(e));
              }}
            >
              <View
                style={[
                  styles.glyphCell,
                  { backgroundColor: colors.paper },
                  e === glyph && { backgroundColor: fixed.lime },
                ]}
              >
                <Text style={styles.glyphText}>{e}</Text>
              </View>
            </PressableScale>
          ))}
        </ScrollView>

        <Text style={[styles.title, { color: colors.ink }]}>{t('saveGroup.title')}</Text>
        <Text style={[styles.sub, { color: colors.muted }]}>{t('saveGroup.subtitle')}</Text>

        <View style={[styles.card, { backgroundColor: colors.paper }]}>
          <View style={[styles.nameRow, { borderBottomColor: colors.sand2 }]}>
            <Text style={[styles.nameLabel, { color: colors.ink }]}>{t('saveGroup.nameLabel')}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              style={[styles.nameInput, { color: colors.ink }]}
              selectionColor={fixed.lime}
            />
          </View>
          {memberIds.map((cid, i) => (
            <Animated.View
              key={cid}
              entering={FadeInDown.delay(Math.min(i, 8) * 40)}
              layout={LinearTransition.springify()}
              style={[styles.memberRow, i < memberIds.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.sand2 }]}
            >
              <Avatar name={nameOf(cid)} contactId={cid} color={colorOf(cid)} size={38} />
              <View style={styles.memberBody}>
                <Text style={[styles.memberName, { color: colors.ink }]} numberOfLines={1}>
                  {nameOf(cid)}
                  {cid === 'me' ? t('live.youSuffix') : ''}
                </Text>
              </View>
              {cid === 'me' ? (
                <View style={[styles.ownerChip, { backgroundColor: colors.dune2 }]}>
                  <Text style={[styles.ownerText, { color: colors.muted }]}>{t('group.owner')}</Text>
                </View>
              ) : (
                <PressableScale
                  small
                  accessibilityLabel={t('common.removeAria')}
                  style={[styles.remove, { backgroundColor: colors.dune2 }]}
                  onPress={() => setMemberIds((ids) => ids.filter((x) => x !== cid))}
                >
                  <Text style={[styles.removeGlyph, { color: colors.muted }]}>×</Text>
                </PressableScale>
              )}
            </Animated.View>
          ))}
        </View>

        <PressableScale style={[styles.accrueCard, { backgroundColor: colors.paper }]} onPress={() => setAccrue((v) => !v)}>
          <View style={styles.accrueBody}>
            <Text style={[styles.accrueTitle, { color: colors.ink }]}>{t('saveGroup.accrue')}</Text>
            <Text style={[styles.accrueSub, { color: colors.muted }]}>{t('saveGroup.accrueSub')}</Text>
          </View>
          <Toggle size="md" value={accrue} onChange={setAccrue} />
        </PressableScale>

        <View style={styles.spacer} />

        <View style={styles.ctas}>
          <PressableScale
            disabled={!name.trim() || saving}
            style={[styles.cta, { backgroundColor: fixed.lime }, (!name.trim() || saving) && styles.disabled]}
            onPress={() => void save()}
          >
            <Text style={styles.ctaDark}>{t('saveGroup.save')}</Text>
          </PressableScale>
          <PressableScale style={[styles.cta, { backgroundColor: colors.paper }]} onPress={() => nav.replace('CashbackAward', { id })}>
            <Text style={[styles.ctaLight, { color: colors.ink }]}>{t('saveGroup.notNow')}</Text>
          </PressableScale>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: 'center', marginTop: 8 },
  swatches: { flexDirection: 'row', gap: 9, justifyContent: 'center', marginTop: 16 },
  swatch: { width: 30, height: 30, borderRadius: 999 },
  glyphStrip: { marginHorizontal: -SCREEN_PAD_X, marginTop: 12 },
  glyphBody: { paddingHorizontal: SCREEN_PAD_X, gap: 8 },
  glyphCell: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  glyphText: { fontSize: 23 },

  root: { paddingHorizontal: SCREEN_PAD_X },
  stack: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  stacked: { marginLeft: -16 },
  title: { fontFamily: font.extrabold, fontSize: 25, letterSpacing: -0.3, textAlign: 'center', marginTop: 14 },
  sub: { fontFamily: font.semibold, fontSize: 13.5, textAlign: 'center', marginTop: 5 },
  card: { borderRadius: radius.card, paddingHorizontal: 18, paddingVertical: 4, marginTop: 20 , shadowColor: '#1E1C10', shadowOpacity: 0.05, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderBottomWidth: 1 },
  nameLabel: { fontFamily: font.extrabold, fontSize: 15.5 },
  nameInput: { flex: 1, fontFamily: font.semibold, fontSize: 16, textAlign: 'right', padding: 0 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60 },
  memberBody: { flex: 1 },
  memberName: { fontFamily: font.bold, fontSize: 15 },
  ownerChip: { height: 28, paddingHorizontal: 12, borderRadius: 999, justifyContent: 'center' },
  ownerText: { fontFamily: font.bold, fontSize: 11.5 },
  remove: { width: 30, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  removeGlyph: { fontSize: 14, fontFamily: font.semibold },
  accrueCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.card, paddingHorizontal: 18, paddingVertical: 16, marginTop: 12 , shadowColor: '#1E1C10', shadowOpacity: 0.05, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 3 },
  accrueBody: { flex: 1, gap: 2 },
  accrueTitle: { fontFamily: font.extrabold, fontSize: 15.5 },
  accrueSub: { fontFamily: font.semibold, fontSize: 12.5 },
  spacer: { flexGrow: 1, minHeight: 24 },
  ctas: { gap: 10 },
  cta: { height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  ctaDark: { fontFamily: font.extrabold, fontSize: 16, color: '#111110' },
  ctaLight: { fontFamily: font.bold, fontSize: 16 },
  disabled: { opacity: 0.4 },
});
