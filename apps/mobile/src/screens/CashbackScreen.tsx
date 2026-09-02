// «Накопленные кэшбеки» — порт CashbackPage.vue (дизайн 5h): баланс 44px,
// чипы групп, записи, «Потратить» / «Вывести» (карта → сумма → PIN).
import React, { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PressableScale } from '@/components/PressableScale';
import { MerchantCashbackSlider } from '@/components/MerchantCashbackSlider';
import { BottomSheet } from '@/components/BottomSheet';
import { PinSheet } from '@/components/PinSheet';
import { toast } from '@/components/ToastHost';
import { spendCashbackNext, withdrawCashback } from '@/api/actions';
import { qk } from '@/api/data';
import { useHomeData } from '@/store/bootstrap';
import { money, humanDateLc } from '@/lib/format';
import { entryText } from '@/lib/entryText';
import { merchantGlyph, merchantLogo } from '@/lib/merchantLogo';
import { venueGlyph } from '@/lib/merchantTheme';
import { useTheme } from '@/theme/ThemeProvider';
import { SCREEN_PAD_X, font } from '@/theme/tokens';

export function CashbackScreen() {
  const { t } = useTranslation();
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

      {/* свайп-карточки по заведениям: общая сумма + где именно накопилось */}
      <MerchantCashbackSlider entries={home.db?.cashbackEntries ?? []} total={home.cashbackBalance} />

      <Text style={[styles.hint, { color: colors.muted }]}>{t('cashback.empty')}</Text>

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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10, flexGrow: 1 }}>
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
                  {venueGlyph(e.title)}
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
  root: { paddingHorizontal: SCREEN_PAD_X },
  title: { fontFamily: font.extrabold, fontSize: 27, letterSpacing: -0.3, marginTop: 24 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 12 },
  amount: { fontFamily: font.extrabold, fontSize: 44, letterSpacing: -1.4, lineHeight: 48 },
  unit: { fontFamily: font.monoBold, fontSize: 11, flexShrink: 1 },
  // с запасом от точек слайдера: подпись прилипала к карточкам
  hint: { fontFamily: font.semibold, fontSize: 13, marginTop: 18 },
  filtersWrap: { flexGrow: 0, marginTop: 20 , marginHorizontal: -24 },
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
