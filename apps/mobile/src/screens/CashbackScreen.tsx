// «Накопленные кэшбеки» — порт CashbackPage.vue (дизайн 5h): баланс 44px,
// чипы групп, записи, «Потратить» / «Вывести» (карта → сумма → PIN).
import React, { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/EmptyState';
import { PressableScale } from '@/components/PressableScale';
import { CountUp } from '@/components/CountUp';
import { VenueIcon } from '@/components/VenueIcon';
import { Avatar } from '@/components/Avatar';
import { CashbackTier } from '@/components/CashbackTier';
import { Podium } from '@/components/Podium';
import { SectionLabel } from '@/components/SectionLabel';
import { STICKER } from '@/components/EmptyState';
import { BottomSheet } from '@/components/BottomSheet';
import { PinSheet } from '@/components/PinSheet';
import { toast } from '@/components/ToastHost';
import { spendCashbackNext, withdrawCashback } from '@/api/actions';
import { qk } from '@/api/data';
import { useHomeData } from '@/store/bootstrap';
import { SkinSheet } from '@/components/SkinSheet';
import { isDarkSkin, useSkin } from '@/lib/screenSkin';
import { useNavigation } from '@react-navigation/native';
import { money, humanDateLc } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { SCREEN_PAD_X, font } from '@/theme/tokens';

export function CashbackScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors, fixed } = useTheme();
  const qc = useQueryClient();
  const home = useHomeData();
  const nav = useNavigation<any>();
  const pct = (bp: number) => `${(bp / 100).toFixed(bp % 100 ? 1 : 0)}%`;

  const [filter, setFilter] = useState('all');
  const groups = home.db?.groups ?? [];
  const cards = home.db?.cards ?? [];

  const rows = useMemo(() => {
    const entries = home.db?.cashbackEntries ?? [];
    return filter === 'all' ? entries : entries.filter((e) => e.groupId === filter);
  }, [home.db?.cashbackEntries, filter]);

  /* сводка: сколько накапало за календарный месяц, лучшая ставка среди
     компаний и заведение с наибольшим кэшбэком */
  const monthAmount = useMemo(() => {
    const from = new Date();
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
    return (home.db?.cashbackEntries ?? [])
      .filter((e) => e.createdAt >= from.getTime())
      .reduce((s, e) => s + e.amount, 0);
  }, [home.db?.cashbackEntries]);

  const bestRateBp = useMemo(
    () => Math.max(200, ...(home.db?.groups ?? []).map((g) => g.rateBp ?? 200)),
    [home.db?.groups],
  );


  const activeGroup = useMemo(
    () => (filter === 'all' ? null : (home.db?.groups ?? []).find((g) => g.id === filter) ?? null),
    [filter, home.db?.groups],
  );
  const groupPool = activeGroup?.cashback ?? 0;

  /* вклад участников: доли закрытых сплитов компании × её ставка */
  const contributors = useMemo(() => {
    if (!activeGroup) return [];
    const rate = (activeGroup.rateBp ?? 200) / 10000;
    const acc = new Map<string, { contactId: string; amount: number; splits: number }>();
    for (const s of home.db?.splits ?? []) {
      if (s.groupId !== activeGroup.id || s.status !== 'closed') continue;
      for (const m of s.members) {
        const cur = acc.get(m.contactId) ?? { contactId: m.contactId, amount: 0, splits: 0 };
        cur.amount += Math.round(m.amount * rate);
        cur.splits += 1;
        acc.set(m.contactId, cur);
      }
    }
    return [...acc.values()].sort((a, b) => b.amount - a.amount);
  }, [activeGroup, home.db?.splits]);

  const spentAmount = useMemo(
    () => (home.db?.cashbackEntries ?? []).filter((e) => e.amount < 0).reduce((a, e) => a - e.amount, 0),
    [home.db?.cashbackEntries],
  );
  const splitsOfGroup = (gid: string) =>
    (home.db?.splits ?? []).filter((s) => s.groupId === gid).length;

  const badgeOf = (badge: string) => badge.split(' · ')[0] ?? badge;

  const spend = async () => {
    try {
      const reserved = await spendCashbackNext();
      await qc.invalidateQueries({ queryKey: qk.bootstrap });
      toast.success(t('cashback.spendToastAmount', { amount: money(reserved) }));
    } catch (e) {
      toast(e instanceof Error ? e.message : t('errors.payCancelled'));
    }
  };

  // вывод: карта → сумма → PIN → запрос
  const [withdrawSheet, setWithdrawSheet] = useState(false);
  const [withdrawCard, setWithdrawCard] = useState('');
  const [withdrawRaw, setWithdrawRaw] = useState('');
  const [withdrawPin, setWithdrawPin] = useState(false);

  const openWithdraw = () => {
    setWithdrawCard(cards.find((c) => c.primary)?.id ?? cards[0]?.id ?? '');
    setWithdrawRaw(String(home.cashbackBalance));
    setWithdrawSheet(true);
  };

  const withdrawNext = () => {
    const v = Number(withdrawRaw || '0');
    if (v <= 0 || v > home.cashbackBalance) {
      toast(t('cashback.outOfRange'));
      return;
    }
    setWithdrawSheet(false);
    setWithdrawPin(true);
  };

  const confirmWithdraw = async () => {
    setWithdrawPin(false);
    const v = Number(withdrawRaw || '0');
    try {
      await withdrawCashback(withdrawCard, v);
      await qc.invalidateQueries({ queryKey: qk.bootstrap });
      const card = cards.find((c) => c.id === withdrawCard);
      toast.success(t('cashback.withdrawToastAmount', { amount: money(v), last4: card?.last4 ?? '' }));
    } catch (e) {
      toast(e instanceof Error ? e.message : t('errors.payCancelled'));
    }
  };

  const skin = useSkin();
  const [skinSheet, setSkinSheet] = useState(false);
  const [historySheet, setHistorySheet] = useState(false);
  const bg = skin ?? colors.dune2;
  const onDark = isDarkSkin(skin);
  const ink = onDark ? '#FFFFFF' : colors.ink;
  const muted = onDark ? 'rgba(255,255,255,0.6)' : colors.muted;

  const merchantRows = useMemo(() => {
    const src = filter === 'all' ? rows : rows.filter((e) => e.groupId === filter);
    const acc = new Map<string, { title: string; amount: number; count: number; last: number; badge: string }>();
    for (const e of src) {
      const cur = acc.get(e.title) ?? { title: e.title, amount: 0, count: 0, last: 0, badge: e.badge };
      cur.amount += e.amount;
      cur.count += 1;
      cur.last = Math.max(cur.last, e.createdAt);
      acc.set(e.title, cur);
    }
    return [...acc.values()].sort((a, b) => b.amount - a.amount);
  }, [rows, filter]);

  return (
    <Screen style={styles.root} background={bg} darkBar={onDark}>
      {/* шапка spec/09,10: назад — заголовок с подзаголовком — «🎨» */}
      <View style={styles.head}>
        <PressableScale style={[styles.round, { backgroundColor: onDark ? 'rgba(255,255,255,0.12)' : colors.paper }]} onPress={() => nav.goBack()}>
          <Text style={[styles.roundGlyph, { color: ink }]}>←</Text>
        </PressableScale>
        <View style={styles.headBody}>
          <Text style={[styles.headTitle, { color: ink }]} numberOfLines={1}>{t('home.cashbackCard')}</Text>
          <Text style={[styles.headSub, { color: muted }]} numberOfLines={1}>
            {activeGroup ? `Crew · ${activeGroup.name}` : t('cashback.allYourGroups')}
          </Text>
        </View>
        <PressableScale style={[styles.round, { backgroundColor: onDark ? 'rgba(255,255,255,0.12)' : colors.paper }]} onPress={() => setSkinSheet(true)}>
          <Text style={styles.roundGlyph}>🎨</Text>
        </PressableScale>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 12, flexGrow: 1 }}
      >
        {filter === 'all' ? (
          <>
            {/* лаймовая карточка «ДОСТУПНО» (spec/10) */}
            <View style={[styles.availCard, { backgroundColor: fixed.lime }]}>
              <Text style={styles.availKicker}>{t('cashback.available')}</Text>
              <View style={styles.availRow}>
                <CountUp value={home.cashbackBalance} duration={800} style={styles.availAmount} />
                <Text style={styles.availUnit}>{t('common.currency')}</Text>
              </View>
              <Text style={styles.availSub}>
                {t('cashback.groupsAndMerchants', { groups: groups.length, merchants: merchantRows.length })}
              </Text>
              <View style={styles.availActions}>
                <PressableScale style={[styles.availBtn, { backgroundColor: fixed.ink }]} onPress={() => void spend()}>
                  <Text style={[styles.availBtnText, { color: fixed.lime }]}>{t('cashback.spendShort')}</Text>
                </PressableScale>
                <PressableScale style={[styles.availBtn, styles.availBtnGhost]} onPress={openWithdraw}>
                  <Text style={[styles.availBtnText, { color: fixed.ink }]}>{t('cashback.withdraw')}</Text>
                </PressableScale>
                <PressableScale
                  style={[styles.availBtn, styles.availBtnGhost]}
                  onPress={() => setHistorySheet(true)}
                >
                  <Text style={[styles.availBtnText, { color: fixed.ink }]}>{t('cashback.historyBtn')}</Text>
                </PressableScale>
              </View>
              <Image source={STICKER.wallet} style={styles.availArt} resizeMode="contain" />
            </View>

            <View style={styles.tiles}>
              {[
                { l: t('cashback.perMonth'), v: `+${money(monthAmount)}` },
                { l: t('cashback.spentLabel'), v: money(spentAmount) },
                { l: t('cashback.rate'), v: t('cashback.rateUpTo', { rate: pct(bestRateBp) }) },
              ].map((x) => (
                <View key={x.l} style={[styles.tile, { backgroundColor: colors.paper }]}>
                  <Text style={[styles.tileLabel, { color: colors.muted }]}>{x.l}</Text>
                  <Text style={[styles.tileValue, { color: colors.ink }]} numberOfLines={1} adjustsFontSizeToFit>
                    {x.v}
                  </Text>
                </View>
              ))}
            </View>

            {groups.length ? (
              <>
                <View style={styles.sectionHead}>
                  <SectionLabel onDark={onDark}>{t('cashback.byGroups')}</SectionLabel>
                  <Text style={[styles.sectionCount, { color: ink }]}>{groups.length}</Text>
                </View>
                {groups.map((g) => (
                  <PressableScale
                    key={g.id}
                    haptic={false}
                    style={[styles.row, { backgroundColor: colors.paper }]}
                    onPress={() => setFilter(g.id)}
                  >
                    <VenueIcon name={g.name} size={40} />
                    <View style={styles.rowBody}>
                      <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>{g.name}</Text>
                      {/* лица участников рядом с числом сплитов (spec/10) */}
                      <View style={styles.miniRow}>
                        {[...new Set(g.memberIds)].slice(0, 3).map((cid, i) => (
                          <Avatar
                            key={cid}
                            contactId={cid}
                            name={home.nameOfContact(cid)}
                            color={home.contactById(cid)?.color ?? '#8A887E'}
                            size={18}
                            ring={colors.paper}
                            ringWidth={1.5}
                            style={i > 0 ? styles.miniStacked : undefined}
                          />
                        ))}
                        {g.memberIds.length > 3 ? (
                          <View style={[styles.miniMore, { backgroundColor: colors.sand, borderColor: colors.paper }]}>
                            <Text style={[styles.miniMoreText, { color: colors.muted }]}>
                              +{g.memberIds.length - 3}
                            </Text>
                          </View>
                        ) : null}
                        <Text style={[styles.rowSub, styles.miniCount, { color: colors.muted }]} numberOfLines={1}>
                          {t('debts.splitsCount', { n: splitsOfGroup(g.id) })}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.rowRight}>
                      <Text style={[styles.rowAmount, { color: colors.ink }]}>{money(g.cashback)}</Text>
                      <Text style={[styles.rowRate, { color: colors.muted }]}>{pct(g.rateBp ?? 200)}</Text>
                    </View>
                    <Text style={[styles.chevron, { color: colors.muted }]}>›</Text>
                  </PressableScale>
                ))}
              </>
            ) : null}

            {merchantRows[0] ? (
              <>
                <SectionLabel onDark={onDark} style={styles.sectionMono}>{t('cashback.topMerchant')}</SectionLabel>
                <View style={[styles.row, { backgroundColor: colors.paper }]}>
                  <VenueIcon name={merchantRows[0].title} size={40} />
                  <View style={styles.rowBody}>
                    <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>
                      {merchantRows[0].title}
                    </Text>
                    <Text style={[styles.rowSub, { color: colors.muted }]} numberOfLines={1}>
                      {t('debts.splitsCount', { n: merchantRows[0].count })}
                    </Text>
                  </View>
                  <Text style={[styles.rowAmount, { color: colors.ink }]}>{money(merchantRows[0].amount)}</Text>
                </View>
              </>
            ) : null}
          </>
        ) : (
          <>
            {/* «НАКОПИЛИ ВМЕСТЕ» + стикер (spec/09) */}
            <View style={styles.poolRow}>
              <View style={styles.poolBody}>
                <SectionLabel onDark={onDark}>{t('cashback.pooledTogether')}</SectionLabel>
                <View style={styles.poolAmountRow}>
                  <Text style={[styles.poolAmount, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit>
                    {money(groupPool)}
                  </Text>
                  <Text style={[styles.poolUnit, { color: muted }]}>{t('common.currency')}</Text>
                </View>
                <Text style={[styles.poolNote, { color: muted }]}>{t('cashback.tierNote')}</Text>
              </View>
              <Image source={STICKER.wallet} style={styles.poolArt} resizeMode="contain" />
            </View>

            <View style={[styles.tierCard, { backgroundColor: colors.paper }]}>
              <CashbackTier pool={groupPool} rateBp={activeGroup?.rateBp} nextTier={activeGroup?.nextTier} />
            </View>

            {contributors.length > 1 ? (
              <>
                <SectionLabel onDark={onDark} style={styles.sectionMono}>{t('group.contributors')}</SectionLabel>
                <Podium
                  frame={bg}
                  items={contributors.slice(0, 3).map((c) => ({
                    key: c.contactId,
                    contactId: c.contactId,
                    name: c.contactId === 'me' ? t('members.youShort') : home.nameOfContact(c.contactId),
                    color: home.contactById(c.contactId)?.color,
                    initials: home.contactById(c.contactId)?.initials,
                    amount: c.amount,
                    sub: t('debts.splitsCount', { n: c.splits }),
                  }))}
                />
              </>
            ) : null}

            {merchantRows.length ? (
              <>
                <View style={styles.sectionHead}>
                  <SectionLabel onDark={onDark}>{t('cashback.merchants')}</SectionLabel>
                  <Text style={[styles.sectionCount, { color: ink }]}>{merchantRows.length}</Text>
                </View>
                {merchantRows.map((m) => (
                  <View key={m.title} style={[styles.row, { backgroundColor: colors.paper }]}>
                    <VenueIcon name={m.title} size={40} />
                    <View style={styles.rowBody}>
                      <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>{m.title}</Text>
                      <Text style={[styles.rowSub, { color: colors.muted }]} numberOfLines={1}>
                        {t('debts.splitsCount', { n: m.count })} · {humanDateLc(m.last)}
                      </Text>
                    </View>
                    <View style={styles.rowRight}>
                      <Text style={[styles.rowAmount, { color: colors.ink }]}>{money(m.amount)}</Text>
                      <Text style={[styles.rowRate, { color: colors.muted }]}>{badgeOf(m.badge)}</Text>
                    </View>
                    <Text style={[styles.chevron, { color: colors.muted }]}>›</Text>
                  </View>
                ))}
              </>
            ) : null}

            {!merchantRows.length ? (
              <EmptyState sticker="wallet" title={t('empty.cashbackTitle')} hint={t('empty.cashbackHint')} />
            ) : null}

            <View style={styles.spacer} />

            {/* CTA в макете — чернильная с лаймовым текстом, 48/24 */}
            <PressableScale style={[styles.cta, { backgroundColor: fixed.ink }]} onPress={() => void spend()}>
              <Text style={[styles.ctaText, { color: fixed.lime }]}>{t('cashback.spend')}</Text>
            </PressableScale>
          </>
        )}
      </ScrollView>

      {/* история начислений — списком в шите, чтобы не растягивать экран */}
      <BottomSheet open={historySheet} onClose={() => setHistorySheet(false)}>
        <Text style={[styles.sheetTitle, { color: colors.ink }]}>{t('cashback.historyTitle')}</Text>
        <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
          {rows.map((e) => (
            <View key={e.id} style={styles.historyRow}>
              <VenueIcon name={e.title} size={38} />
              <View style={styles.historyBody}>
                <Text style={[styles.historyTitle, { color: colors.ink }]} numberOfLines={1}>{e.title}</Text>
                <Text style={[styles.historySub, { color: colors.muted }]} numberOfLines={1}>
                  {badgeOf(e.badge)} · {humanDateLc(e.createdAt)}
                </Text>
              </View>
              <Text style={[styles.historyAmount, { color: colors.ink }]} numberOfLines={1}>
                {e.amount > 0 ? '+' : ''}{money(e.amount)}
              </Text>
            </View>
          ))}
          {!rows.length ? (
            <Text style={[styles.historyEmpty, { color: colors.muted }]}>{t('empty.cashbackTitle')}</Text>
          ) : null}
        </ScrollView>
      </BottomSheet>

      <SkinSheet open={skinSheet} onClose={() => setSkinSheet(false)} />

      <BottomSheet open={withdrawSheet} onClose={() => setWithdrawSheet(false)}>
        <View style={styles.sheetBody}>
          <Text style={[styles.sheetTitle, { color: colors.ink }]}>{t('cashback.withdrawTitle')}</Text>
          <View style={styles.cardRow}>
            {cards.map((c) => {
              const active = withdrawCard === c.id;
              return (
                <PressableScale
                  key={c.id}
                  style={[styles.cardChip, { backgroundColor: active ? colors.ink : colors.sand }]}
                  onPress={() => setWithdrawCard(c.id)}
                >
                  <Text style={[styles.cardChipText, { color: active ? colors.cream : colors.muted }]}>
                    {c.network} ·· {c.last4}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
          <TextInput
            value={withdrawRaw ? money(Number(withdrawRaw)) : ''}
            onChangeText={(v) => setWithdrawRaw(v.replace(/\D/g, '').slice(0, 9))}
            keyboardType="number-pad"
            style={[styles.amountInput, { color: colors.ink }]}
            selectionColor={fixed.lime}
          />
          <Text style={[styles.availLabel, { color: colors.faint2 }]}>
            {t('cashback.availableWith', { amount: money(home.cashbackBalance) })}
          </Text>
          <PressableScale style={[styles.sheetCta, { backgroundColor: fixed.lime }]} onPress={withdrawNext}>
            <Text style={styles.ctaDark}>{t('common.continue')}</Text>
          </PressableScale>
        </View>
      </BottomSheet>

      <PinSheet
        open={withdrawPin}
        hint={t('cashback.withdrawHint', { amount: money(Number(withdrawRaw || '0')) })}
        onClose={() => setWithdrawPin(false)}
        onConfirm={() => void confirmWithdraw()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  // шапка spec/09,10
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 20 },
  round: { width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  roundGlyph: { fontSize: 18 },
  headBody: { flex: 1, minWidth: 0, alignItems: 'center' },
  headTitle: { fontFamily: font.bold, fontSize: 19 },
  headSub: { fontFamily: font.semibold, fontSize: 11, marginTop: 2 },
  sectionMono: { marginTop: 24, marginBottom: 12 },
  rowRight: { alignItems: 'flex-end' },
  ctaText: { fontFamily: font.bold, fontSize: 15 },
  rowRate: { fontFamily: font.semibold, fontSize: 9, marginTop: 2 },
  miniRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  miniStacked: { marginLeft: -8 },
  miniMore: {
    marginLeft: -8,
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniMoreText: { fontFamily: font.bold, fontSize: 8 },
  miniCount: { marginLeft: 6, marginTop: 0 },
  spacer: { flex: 1, minHeight: 18 },

  // spec 10
  availCard: { borderRadius: 22, paddingTop: 18, paddingHorizontal: 16, paddingBottom: 16, marginTop: 26, overflow: 'hidden' },
  availKicker: { fontFamily: font.monoBold, fontSize: 8, letterSpacing: 2.5, color: '#5A6A16' },
  availRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 },
  availAmount: { fontFamily: font.extrabold, fontSize: 40, letterSpacing: -0.5, color: '#121212' },
  availUnit: { fontFamily: font.semibold, fontSize: 12, color: '#5A6A16' },
  availSub: { fontFamily: font.semibold, fontSize: 11, color: '#5A6A16', marginTop: 6 },
  availActions: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  historyList: { maxHeight: 420, marginTop: 12 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  historyBody: { flex: 1, minWidth: 0 },
  historyTitle: { fontFamily: font.bold, fontSize: 14 },
  historySub: { fontFamily: font.semibold, fontSize: 11, marginTop: 2 },
  historyAmount: { fontFamily: font.extrabold, fontSize: 15 },
  historyEmpty: { fontFamily: font.semibold, fontSize: 13, textAlign: 'center', paddingVertical: 28 },
  availBtn: { height: 34, borderRadius: 17, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  availBtnGhost: { backgroundColor: 'rgba(18,18,18,0.08)' },
  availBtnText: { fontFamily: font.bold, fontSize: 11 },
  availArt: { position: 'absolute', right: 14, top: 14, width: 78, height: 85 },
  tiles: { flexDirection: 'row', gap: 8, marginTop: 12 },
  tile: { flex: 1, borderRadius: 16, padding: 12 },
  tileLabel: { fontFamily: font.monoBold, fontSize: 7, letterSpacing: 2 },
  tileValue: { fontFamily: font.extrabold, fontSize: 16, marginTop: 6 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 },
  sectionCount: { fontFamily: font.bold, fontSize: 11 },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8 },
  groupBody: { flex: 1, minWidth: 0 },
  groupName: { fontFamily: font.bold, fontSize: 13 },
  groupSub: { fontFamily: font.semibold, fontSize: 10, marginTop: 4 },
  groupRight: { alignItems: 'flex-end' },
  groupAmount: { fontFamily: font.extrabold, fontSize: 16 },
  groupRate: { fontFamily: font.semibold, fontSize: 9, marginTop: 2 },
  chevron: { fontFamily: font.semibold, fontSize: 16 },

  // spec 09: сумма 40 pt, стикер 78×85 справа
  poolRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22 },
  poolBody: { flex: 1, minWidth: 0 },
  mono: { fontFamily: font.monoBold, fontSize: 8, letterSpacing: 2.5 },
  poolAmountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 },
  poolAmount: { fontFamily: font.extrabold, fontSize: 40, letterSpacing: -0.5 },
  poolUnit: { fontFamily: font.semibold, fontSize: 12 },
  poolNote: { fontFamily: font.semibold, fontSize: 11, marginTop: 6 },
  poolArt: { width: 78, height: 85 },
  tierCard: { borderRadius: 18, paddingHorizontal: 14, paddingBottom: 12, marginTop: 18 },


  root: { paddingHorizontal: SCREEN_PAD_X },
  title: { fontFamily: font.extrabold, fontSize: 27, letterSpacing: -0.3, marginTop: 24 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 12 },
  amount: { fontFamily: font.extrabold, fontSize: 44, letterSpacing: -1.4, lineHeight: 48 },
  unit: { fontFamily: font.monoBold, fontSize: 11, flexShrink: 1 },
  // с запасом от точек слайдера: подпись прилипала к карточкам
  hint: { fontFamily: font.semibold, fontSize: 13, marginTop: 18 },
  // раньше было -24 при паддинге экрана 16: лента вылезала за край,
  // первый чип срезался слева, последний — справа
  filtersWrap: { flexGrow: 0, marginTop: 20, marginHorizontal: -SCREEN_PAD_X },
  filters: { gap: 8 , paddingHorizontal: SCREEN_PAD_X },
  filter: { height: 38, paddingHorizontal: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  filterText: { fontFamily: font.bold, fontSize: 13 },
  filterTextActive: { fontFamily: font.extrabold, fontSize: 13 },
  list: { marginTop: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8 },
  icon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  iconLetter: { fontFamily: font.extrabold, fontSize: 15 },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: font.bold, fontSize: 15.5 },
  rowSub: { fontFamily: font.semibold, fontSize: 12 },
  rowAmount: { fontFamily: font.extrabold, fontSize: 16 },
  empty: { fontFamily: font.semibold, fontSize: 13, textAlign: 'center', paddingVertical: 32 },
  ctas: { gap: 10, marginTop: 20 },
  cta: { height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  ctaDark: { fontFamily: font.extrabold, fontSize: 16, color: '#121212' },
  ctaLight: { fontFamily: font.bold, fontSize: 16 },
  sheetBody: { paddingBottom: 10 },
  sheetTitle: { fontFamily: font.extrabold, fontSize: 15, textAlign: 'center' },
  cardRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 16 },
  cardChip: { height: 40, paddingHorizontal: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  cardChipText: { fontFamily: font.monoBold, fontSize: 12 },
  amountInput: { fontFamily: font.extrabold, fontSize: 36, textAlign: 'center', marginVertical: 20, padding: 0 },
  availLabel: { fontFamily: font.monoBold, fontSize: 10, letterSpacing: 1.6, textAlign: 'center' },
  sheetCta: { height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
});
