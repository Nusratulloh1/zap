// «Готово, сплит закрыт» — порт SplitClosedPage.vue (дизайн 3g): лаймовый
// экран, логотип мерчанта, сумма каунт-апом, пилл кэшбэка, участники, CTA.
import React, { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { ThemeGarnish } from '@/components/bill/ThemeGarnish';
import { MomentCard } from '@/components/bill/MomentCard';
import { ShareCardSheet } from '@/components/share/ShareCardSheet';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PressableScale } from '@/components/PressableScale';
import { Avatar } from '@/components/Avatar';
import { CountUp } from '@/components/CountUp';
import { BottomSheet } from '@/components/BottomSheet';
import { fetchSplit } from '@/api/splits';
import { qk } from '@/api/data';
import type { Db } from '@zap/shared/types';
import { useHomeData } from '@/store/bootstrap';
import { money } from '@/lib/format';
import { themeForMerchant } from '@/lib/merchantTheme';
import { merchantGlyph, merchantLogo } from '@/lib/merchantLogo';
import { momentFor } from '@/lib/moments';
import { useTheme } from '@/theme/ThemeProvider';
import { SCREEN_PAD_X, font } from '@/theme/tokens';

export function SplitClosedScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors, fixed } = useTheme();
  const nav = useNavigation<any>();
  const qc = useQueryClient();
  const route = useRoute<any>();
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
  const [billSheet, setBillSheet] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);

  // ZAP Moment: милестоун компании (§B6) или редкий сюрприз (§C10).
  // useMemo обязателен — внутри seeded-выбор, и без него карточка мигала бы
  // на каждый ререндер экрана.
  const moment = useMemo(() => momentFor(home.db, split), [home.db, split]);

  if (!split) {
    return (
      <Screen background={fixed.lime} darkBar={false} style={styles.root}>
        <ScreenHeader tint="onLime" onBack={() => nav.popTo('Tabs')} />
      </Screen>
    );
  }

  const group = split.groupId ? home.db?.groups.find((g) => g.id === split.groupId) : undefined;
  const merchant = home.db?.merchants.find((m) => m.id === split.merchantId);
  const isSolo = split.members.length < 2;

  const nameOf = (cid: string) =>
    cid === 'me' ? (home.db?.user?.name ?? t('members.youShort')) : (home.contactById(cid)?.name ?? '?');
  const colorOf = (cid: string) => (cid === 'me' ? '#111110' : (home.contactById(cid)?.color ?? '#8A887E'));

  return (
    <Screen background={fixed.lime} darkBar={false} style={styles.root}>
      <ScreenHeader tint="onLime" onBack={() => nav.popTo('Tabs')} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 12, flexGrow: 1 }}>
        <View style={styles.head}>
          <ThemeGarnish theme={themeForMerchant(merchant?.name ?? split.title)} />
          {merchantLogo(merchant?.name ?? split.title) ? (
            <Image source={merchantLogo(merchant?.name ?? split.title)!} style={styles.logoImg} />
          ) : (
            <View style={[styles.logo, { backgroundColor: fixed.ink }]}>
              <Text style={styles.logoLetter}>{merchantGlyph(merchant?.name ?? split.title)}</Text>
            </View>
          )}
          <Text style={[styles.title, { color: fixed.ink }]}>{t('closed.title')}</Text>
          <Text style={styles.sub}>
            {merchant?.name ?? split.title}
            {split.bill ? t('live.orderNo', { no: split.bill.orderNo }) : ''}
            {group ? ` · ${group.name}` : isSolo ? t('closed.paidWhole') : ''}
          </Text>
          <View style={styles.amountRow}>
            <CountUp value={split.total} duration={900} style={[styles.amount, { color: fixed.ink }]} />
            <Text style={styles.currency}>UZS</Text>
          </View>
          {split.cashback ? (
            <View style={[styles.cashbackPill, { backgroundColor: fixed.ink }]}>
              <Text style={[styles.cashbackText, { color: fixed.lime }]}>
                {t('closed.cashbackBadge', { amount: money(split.cashback) })}
              </Text>
            </View>
          ) : null}
        </View>

        {moment ? <MomentCard moment={moment} splitId={split.id} /> : null}

        {/*
          Photo Moment (§C15). Снятое фото показываем прямо здесь, рядом с
          суммой и составом — именно эта связка «деньги + вечер + лица» и
          делает из транзакции воспоминание.
        */}
        {!isSolo ? (
          split.photoUrl ? (
            <Image source={{ uri: split.photoUrl }} style={styles.moment} resizeMode="cover" />
          ) : (
            <PressableScale
              style={[styles.addPhoto, { borderColor: 'rgba(17,17,16,0.28)' }]}
              onPress={() => nav.navigate('PhotoMoment', { id })}
            >
              <Text style={[styles.addPhotoText, { color: fixed.ink }]}>{t('photoMoment.add')}</Text>
            </PressableScale>
          )
        ) : null}

        {!isSolo ? (
          <View style={styles.list}>
            {split.members.map((m, i) => (
              <View
                key={m.contactId + i}
                style={[styles.row, i < split.members.length - 1 && styles.rowBorder]}
              >
                <Avatar name={nameOf(m.contactId)} contactId={m.contactId} color={colorOf(m.contactId)} size={38} solid
              />
                <View style={styles.rowBody}>
                  <Text style={[styles.rowName, { color: fixed.ink }]}>
                    {nameOf(m.contactId)}
                    {m.isYou ? t('live.youSuffix') : ''}
                  </Text>
                  {m.status === 'debt' ? <Text style={styles.rowSub}>{t('closed.covered')}</Text> : null}
                </View>
                <Text style={[styles.rowAmount, { color: fixed.ink }]}>{money(m.amount)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {group ? (
          <View style={styles.groupRow}>
            <Text style={styles.groupLabel}>{t('closed.groupTotalLabel', { name: group.name })}</Text>
            <Text style={[styles.groupAmount, { color: fixed.ink }]}>{money(group.cashback)}</Text>
          </View>
        ) : null}

        <View style={styles.spacer} />

        {!isSolo ? (
          <View style={styles.ctas}>
            <PressableScale style={[styles.cta, styles.ctaGhost]} onPress={() => setCardOpen(true)}>
              <Text style={[styles.ctaText, { color: fixed.ink }]}>{t('closed.shareMoment')}</Text>
            </PressableScale>
            <PressableScale style={[styles.cta, { backgroundColor: fixed.ink }]} onPress={() => nav.navigate('SaveGroup', { id })}>
              <Text style={[styles.ctaText, { color: fixed.paper }]}>{t('closed.saveGroup')}</Text>
            </PressableScale>
            <PressableScale style={[styles.cta, styles.ctaGhost]} onPress={() => nav.navigate('CashbackAward', { id })}>
              <Text style={[styles.ctaText, { color: fixed.ink }]}>{t('closed.close')}</Text>
            </PressableScale>
          </View>
        ) : (
          <View style={styles.ctas}>
            <PressableScale style={[styles.cta, { backgroundColor: fixed.ink }]} onPress={() => nav.popTo('Tabs')}>
              <Text style={[styles.ctaText, { color: fixed.paper }]}>{t('closed.close')}</Text>
            </PressableScale>
            {split.bill ? (
              <PressableScale style={[styles.cta, styles.ctaGhost]} onPress={() => setBillSheet(true)}>
                <Text style={[styles.ctaText, { color: fixed.ink }]}>{t('closed.viewReceipt')}</Text>
              </PressableScale>
            ) : null}
          </View>
        )}
      </ScrollView>

      <BottomSheet open={billSheet} onClose={() => setBillSheet(false)}>
        {split.bill ? (
          <View style={styles.billBody}>
            <Text style={[styles.billTitle, { color: colors.ink }]}>
              {merchant?.name ?? split.title} · #{split.bill.orderNo}
            </Text>
            <View style={[styles.dashed, { borderColor: colors.hairline }]} />
            {split.bill.items.map((item) => (
              <View key={item.id} style={styles.billRow}>
                <Text style={[styles.billItem, { color: colors.ink }]}>
                  {item.title}
                  {item.qty > 1 ? ` ×${item.qty}` : ''}
                </Text>
                <Text style={[styles.billAmount, { color: colors.ink }]}>{money(item.amount)}</Text>
              </View>
            ))}
            <View style={[styles.dashed, { borderColor: colors.hairline }]} />
            <View style={styles.billTotalRow}>
              <Text style={[styles.billTotalLabel, { color: colors.ink }]}>{t('closed.totalRow')}</Text>
              <Text style={[styles.billTotal, { color: colors.ink }]}>{money(split.bill.total)}</Text>
            </View>
          </View>
        ) : null}
      </BottomSheet>
      <ShareCardSheet
        open={cardOpen}
        onClose={() => setCardOpen(false)}
        title={split.title}
        total={split.total}
        code={split.code}
        members={split.members.map((m) => ({
          contactId: m.contactId,
          name: nameOf(m.contactId),
          initials: home.contactById(m.contactId)?.initials,
          color: colorOf(m.contactId),
          paid: m.status === 'paid' || m.status === 'debt',
        }))}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: SCREEN_PAD_X },
  head: { marginTop: 30 },
  logoImg: { width: 76, height: 76, marginLeft: -8 },
  logo: { width: 76, height: 76, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { fontFamily: font.extrabold, fontSize: 26 },
  title: { fontFamily: font.extrabold, fontSize: 25, letterSpacing: -0.3, marginTop: 10 },
  sub: { fontFamily: font.semibold, fontSize: 13.5, marginTop: 5, color: 'rgba(17,17,16,0.6)' },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 24 },
  amount: { fontFamily: font.extrabold, fontSize: 48, letterSpacing: -1.5, lineHeight: 52 },
  currency: { fontFamily: font.monoBold, fontSize: 11, color: 'rgba(17,17,16,0.55)' },
  cashbackPill: { alignSelf: 'flex-start', height: 34, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center', marginTop: 14 },
  cashbackText: { fontFamily: font.extrabold, fontSize: 12.5 },
  moment: { height: 190, borderRadius: 24, marginTop: 22, backgroundColor: 'rgba(17,17,16,0.08)' },
  addPhoto: {
    height: 56,
    borderRadius: 999,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  addPhotoText: { fontFamily: font.extrabold, fontSize: 15 },
  list: { marginTop: 26, borderTopWidth: 1, borderTopColor: 'rgba(17,17,16,0.14)', paddingTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(17,17,16,0.14)' },
  rowBody: { flex: 1, gap: 1 },
  rowName: { fontFamily: font.bold, fontSize: 15 },
  rowSub: { fontFamily: font.semibold, fontSize: 12, color: 'rgba(17,17,16,0.55)' },
  rowAmount: { fontFamily: font.extrabold, fontSize: 15 },
  groupRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 20 },
  groupLabel: { fontFamily: font.bold, fontSize: 14.5, color: 'rgba(17,17,16,0.6)' },
  groupAmount: { fontFamily: font.extrabold, fontSize: 19 },
  spacer: { flexGrow: 1, minHeight: 24 },
  ctas: { gap: 10 },
  cta: { height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  ctaGhost: { backgroundColor: 'rgba(255,255,255,0.55)' },
  ctaText: { fontFamily: font.extrabold, fontSize: 16 },
  billBody: { paddingBottom: 10 },
  billTitle: { fontFamily: font.extrabold, fontSize: 15, textAlign: 'center' },
  dashed: { borderTopWidth: 2, borderStyle: 'dashed', marginTop: 12, marginBottom: 6 },
  billRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 34 },
  billItem: { fontFamily: font.semibold, fontSize: 14, flexShrink: 1 },
  billAmount: { fontFamily: font.monoBold, fontSize: 12.5 },
  billTotalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 8 },
  billTotalLabel: { fontFamily: font.extrabold, fontSize: 15 },
  billTotal: { fontFamily: font.extrabold, fontSize: 17 },
});
