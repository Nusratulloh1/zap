// «Накопленные кэшбеки» — порт CashbackPage.vue (дизайн 5h): баланс 44px,
// чипы групп, записи, «Потратить» / «Вывести» (карта → сумма → PIN).
import React, { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PressableScale } from '@/components/PressableScale';
import { MerchantCashbackSlider } from '@/components/MerchantCashbackSlider';
import { CashbackTier } from '@/components/CashbackTier';
import { Podium } from '@/components/Podium';
import { STICKER } from '@/components/EmptyState';
import { BottomSheet } from '@/components/BottomSheet';
import { PinSheet } from '@/components/PinSheet';
import { toast } from '@/components/ToastHost';
import { spendCashbackNext, withdrawCashback } from '@/api/actions';
import { qk } from '@/api/data';
import { useHomeData } from '@/store/bootstrap';
import { money, humanDateLc } from '@/lib/format';
import { entryText } from '@/lib/entryText';
import { merchantGlyph, merchantLogo } from '@/lib/merchantLogo';
import { useTheme } from '@/theme/ThemeProvider';
import { SCREEN_PAD_X, font } from '@/theme/tokens';

export function CashbackScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors, fixed } = useTheme();
  const qc = useQueryClient();
  const home = useHomeData();

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

  const topMerchant = useMemo(() => {
    const acc = new Map<string, { title: string; amount: number }>();
    for (const e of home.db?.cashbackEntries ?? []) {
      const cur = acc.get(e.title) ?? { title: e.title, amount: 0 };
      cur.amount += e.amount;
      acc.set(e.title, cur);
    }
    return [...acc.values()].sort((a, b) => b.amount - a.amount)[0] ?? null;
  }, [home.db?.cashbackEntries]);

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

  const groupName = (gid?: string) => (gid ? (groups.find((g) => g.id === gid)?.name ?? '') : '');
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

  return (
    <Screen style={styles.root}>
      <ScreenHeader />

      <Text style={[styles.title, { color: colors.ink }]}>{t('home.cashbackCard')}</Text>

      {filter === 'all' ? (
        /* свайп-карточки по заведениям: общая сумма + где именно накопилось */
        <MerchantCashbackSlider entries={home.db?.cashbackEntries ?? []} total={home.cashbackBalance} />
      ) : (
        /*
          Экран компании по макету: «НАКОПИЛИ ВМЕСТЕ» с суммой 40 pt и
          стикером‑кошельком, белая карточка ступени, подиум «кто принёс
          больше» и список заведений.
        */
        <View>
          <View style={styles.poolRow}>
            <View style={styles.poolBody}>
              <Text style={[styles.mono, { color: colors.faint2 }]}>{t('cashback.pooledTogether')}</Text>
              <View style={styles.poolAmountRow}>
                <Text style={[styles.poolAmount, { color: colors.ink }]} numberOfLines={1} adjustsFontSizeToFit>
                  {money(groupPool)}
                </Text>
                <Text style={[styles.poolUnit, { color: colors.faint2 }]}>{t('common.currency')}</Text>
              </View>
              <Text style={[styles.poolNote, { color: colors.faint2 }]}>{t('cashback.tierNote')}</Text>
            </View>
            <Image source={STICKER.wallet} style={styles.poolArt} resizeMode="contain" />
          </View>

          <View style={[styles.tierCard, { backgroundColor: colors.paper }]}>
            <CashbackTier pool={groupPool} rateBp={activeGroup?.rateBp} nextTier={activeGroup?.nextTier} />
          </View>

          {contributors.length > 1 ? (
            <>
              <Text style={[styles.mono, { color: colors.faint2, marginTop: 24 }]}>{t('group.contributors')}</Text>
              <Podium
                frame={colors.dune2}
                items={contributors.slice(0, 3).map((c) => ({
                  key: c.contactId,
                  contactId: c.contactId,
                  name: c.contactId === 'me' ? t('members.youShort') : (home.contactById(c.contactId)?.name ?? '?'),
                  color: home.contactById(c.contactId)?.color,
                  initials: home.contactById(c.contactId)?.initials,
                  amount: c.amount,
                  sub: t('debts.splitsCount', { n: c.splits }),
                }))}
              />
            </>
          ) : null}
        </View>
      )}

      <Text style={[styles.hint, { color: colors.muted }]}>{t('cashback.empty')}</Text>

      {/* сводка месяца и ставки — по макету редизайна */}
      <View style={[styles.summary, filter !== 'all' && styles.hidden]}>
        <View style={[styles.sumCard, { backgroundColor: colors.shell }]}>
          <Text style={[styles.sumLabel, { color: colors.faint2 }]}>{t('cashback.perMonth')}</Text>
          <Text style={[styles.sumValue, { color: colors.ink }]} numberOfLines={1} adjustsFontSizeToFit>
            +{money(monthAmount)}
          </Text>
        </View>
        <View style={[styles.sumCard, { backgroundColor: colors.shell }]}>
          <Text style={[styles.sumLabel, { color: colors.faint2 }]}>{t('cashback.rate')}</Text>
          <Text style={[styles.sumValue, { color: colors.ink }]} numberOfLines={1}>
            {t('cashback.rateUpTo', { rate: `${(bestRateBp / 100).toFixed(bestRateBp % 100 ? 1 : 0)}%` })}
          </Text>
        </View>
        <View style={[styles.sumCard, { backgroundColor: colors.shell }]}>
          <Text style={[styles.sumLabel, { color: colors.faint2 }]}>{t('cashback.topMerchant')}</Text>
          <Text style={[styles.sumValue, { color: colors.ink }]} numberOfLines={1} adjustsFontSizeToFit>
            {topMerchant?.title ?? '—'}
          </Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersWrap} contentContainerStyle={styles.filters}>
        {[{ value: 'all', label: t('cashback.allGroups') }, ...groups.map((g) => ({ value: g.id, label: g.name }))].map(
          (f) => {
            const active = filter === f.value;
            return (
              <PressableScale
                key={f.value}
                style={[styles.filter, { backgroundColor: active ? fixed.lime : colors.sand }]}
                onPress={() => setFilter(f.value)}
              >
                <Text style={[active ? styles.filterTextActive : styles.filterText, { color: active ? '#111110' : colors.slate }]}>{f.label}</Text>
              </PressableScale>
            );
          },
        )}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 12, flexGrow: 1 }}>
        <View style={styles.list}>
          {rows.map((e, i) => (
            <Animated.View
              key={e.id}
              entering={FadeInDown.delay(Math.min(i, 8) * 40).duration(240)}
              style={[styles.row, i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.sand2 }]}
            >
              {merchantLogo(e.title) ? (
                <Image source={merchantLogo(e.title)!} style={styles.icon} />
              ) : (
                <View style={[styles.icon, { backgroundColor: colors.sand }]}>
                  {/* знак заведения вместо безликой буквы */}
                  <Text style={styles.iconLetter}>{merchantGlyph(e.title)}</Text>
                </View>
              )}
              <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>
                  {entryText(e.title, e.titleKey)}
                </Text>
                <Text style={[styles.rowSub, { color: colors.faint }]} numberOfLines={1}>
                  {groupName(e.groupId) ? `${groupName(e.groupId)} · ` : ''}
                  {badgeOf(e.badge)} · {humanDateLc(e.createdAt)}
                </Text>
              </View>
              <Text style={[styles.rowAmount, { color: colors.ink }]} numberOfLines={1} adjustsFontSizeToFit>{money(e.amount)}</Text>
            </Animated.View>
          ))}
          {!rows.length ? (
            <EmptyState sticker="wallet" title={t('empty.cashbackTitle')} hint={t('empty.cashbackHint')} />
          ) : null}
        </View>

        <View style={styles.spacer} />

        <View style={styles.ctas}>
          <PressableScale style={[styles.cta, { backgroundColor: fixed.lime }]} onPress={() => void spend()}>
            <Text style={styles.ctaDark}>{t('cashback.spend')}</Text>
          </PressableScale>
          <PressableScale style={[styles.cta, { backgroundColor: colors.sand }]} onPress={openWithdraw}>
            <Text style={[styles.ctaLight, { color: colors.ink }]}>{t('cashback.withdraw')}</Text>
          </PressableScale>
        </View>
      </ScrollView>

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
  hidden: { display: 'none' },
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

  summary: { flexDirection: 'row', gap: 8, marginTop: 14 },
  sumCard: { flex: 1, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 12 },
  sumLabel: { fontFamily: font.monoBold, fontSize: 8, letterSpacing: 1.6 },
  sumValue: { fontFamily: font.extrabold, fontSize: 16, marginTop: 5, letterSpacing: -0.2 },

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
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 72 },
  icon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  iconLetter: { fontFamily: font.extrabold, fontSize: 15 },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: font.bold, fontSize: 15.5 },
  rowSub: { fontFamily: font.semibold, fontSize: 12 },
  rowAmount: { fontFamily: font.extrabold, fontSize: 16 },
  empty: { fontFamily: font.semibold, fontSize: 13, textAlign: 'center', paddingVertical: 32 },
  spacer: { flexGrow: 1, minHeight: 20 },
  ctas: { gap: 10, marginTop: 20 },
  cta: { height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  ctaDark: { fontFamily: font.extrabold, fontSize: 16, color: '#111110' },
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
