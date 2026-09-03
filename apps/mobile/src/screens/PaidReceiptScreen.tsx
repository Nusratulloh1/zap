// Чек после оплаты — перенос spec/16-receipt: лаймовый экран, сумма моно
// 44 pt, белая карточка заказа с пунктирным отрывом, состав участников и QR,
// две кнопки внизу.
//
// Номер транзакции приходит с сервера (`/payments/pay` → txId): выдумывать его
// на клиенте нельзя — по нему ищут платёж в поддержке.
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Screen } from '@/components/Screen';
import { Avatar } from '@/components/Avatar';
import { PressableScale } from '@/components/PressableScale';
import { VenueIcon } from '@/components/VenueIcon';
import QRCode from 'react-native-qrcode-svg';
import { STICKER } from '@/components/EmptyState';
import { CloseIcon } from '@/components/icons';
import { useHomeData } from '@/store/bootstrap';
import { dayMonth, money } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/RootNavigator';

const wordmark = require('../../assets/brand/zap-wordmark.png');

export function PaidReceiptScreen() {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'PaidReceipt'>>();
  const home = useHomeData();

  const split = home.db?.splits.find((s) => s.id === params.splitId);
  const merchant = home.db?.merchants.find((m) => m.id === split?.merchantId);
  const card = home.db?.cards.find((c) => c.primary) ?? home.db?.cards[0];
  const name = merchant?.name ?? split?.title ?? '';
  const members = split?.members ?? [];
  const paidCount = members.filter((m) => m.status === 'paid' || m.status === 'debt').length;
  const share = members.length ? Math.round(params.amount / members.length) : params.amount;

  return (
    <Screen style={styles.root} background={fixed.lime} darkBar={false} noTopFade edges={['top']}>
      <View style={styles.topRow}>
        <Image source={wordmark} style={styles.wordmark} resizeMode="contain" />
        <PressableScale style={styles.close} onPress={() => nav.popTo('Tabs')}>
          <CloseIcon size={16} color="#121212" />
        </PressableScale>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 12, flexGrow: 1 }}>
        <Animated.View entering={FadeInDown.duration(320)} style={styles.head}>
          <Text style={styles.kicker}>{t('receipt.done')}</Text>
          <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>{money(params.amount)}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {t('receipt.sub', {
              members: `${paidCount} / ${members.length}`,
              title: split?.title ?? '',
            })}
          </Text>

          {params.cashback ? (
            <View style={[styles.cbChip, { backgroundColor: fixed.ink }]}>
              <Image source={STICKER.wallet} style={styles.cbArt} resizeMode="contain" />
              <Text style={[styles.cbText, { color: fixed.lime }]}>
                {t('receipt.cashbackChip', { amount: money(params.cashback) })}
              </Text>
            </View>
          ) : null}
        </Animated.View>

        {/* карточка заказа: белая, с пунктирным «отрывом» как у чека */}
        <View style={[styles.card, { backgroundColor: colors.paper }]}>
          <View style={styles.merchantRow}>
            <VenueIcon name={name} size={48} />
            <View style={styles.merchantBody}>
              <Text style={[styles.merchantName, { color: colors.ink }]} numberOfLines={1}>{name}</Text>
              <Text style={[styles.orderLine, { color: colors.faint2 }]} numberOfLines={1}>
                {split?.bill?.orderNo ? `${t('receipt.order', { no: split.bill.orderNo })} · ` : ''}
                {dayMonth(new Date(params.at))}
              </Text>
            </View>
            <View style={[styles.paidChip, { backgroundColor: fixed.lime }]}>
              <Text style={styles.paidChipText}>{t('receipt.paid')}</Text>
            </View>
          </View>

          <View style={[styles.dashed, { borderTopColor: colors.sand2 }]} />

          {[
            { l: t('receipt.tx'), v: params.txId ?? '—' },
            { l: t('receipt.card'), v: card ? `${card.network} ·· ${card.last4}` : '—' },
            ...(params.cashback ? [{ l: t('receipt.cashbackGroup'), v: `+${money(params.cashback)}` }] : []),
          ].map((r) => (
            <View key={r.l} style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.faint2 }]}>{r.l}</Text>
              <Text style={[styles.rowValue, { color: colors.ink }]} numberOfLines={1}>{r.v}</Text>
            </View>
          ))}
        </View>

        {members.length > 1 ? (
          <View style={styles.membersCard}>
            <View style={styles.faces}>
              {members.slice(0, 3).map((m, i) => (
                <Avatar
                  key={m.contactId + i}
                  contactId={m.isYou ? 'me' : m.contactId}
                  name={home.contactById(m.contactId)?.name}
                  color={home.contactById(m.contactId)?.color ?? '#8A887E'}
                  size={32}
                  ring={fixed.lime}
                  ringWidth={2}
                  style={i > 0 ? styles.faceStacked : undefined}
                />
              ))}
            </View>
            <Text style={[styles.membersText, { color: fixed.ink }]} numberOfLines={3}>
              <Text style={styles.membersNames}>
                {members
                  .slice(0, 3)
                  .map((m) => (m.isYou ? t('members.youShort') : home.nameOfContact(m.contactId).split(' ')[0]))
                  .join(', ')}
              </Text>
              {t('receipt.eachFor', { amount: money(share) })}
            </Text>

            {/* QR подтверждает оплату у мерчанта — как в новом макете чека */}
            <View style={[styles.qr, { backgroundColor: colors.paper }]}>
              <QRCode
                value={params.txId ?? split?.code ?? 'ZAP'}
                size={52}
                color="#121212"
                backgroundColor="transparent"
              />
            </View>
          </View>
        ) : null}

        <Text style={[styles.qrHint, { color: 'rgba(18,18,18,0.55)' }]} numberOfLines={2}>
          {t('receipt.showToMerchant')}
        </Text>

        <View style={styles.spacer} />

        <View style={styles.actions}>
          <PressableScale style={[styles.cta, { backgroundColor: fixed.ink }]} onPress={() => nav.popTo('Tabs')}>
            <Text style={[styles.ctaText, { color: fixed.lime }]}>{t('receipt.close')}</Text>
          </PressableScale>
          {split ? (
            <PressableScale
              style={[styles.cta, { backgroundColor: colors.paper }]}
              onPress={() => nav.navigate('SplitLive', { id: split.id })}
            >
              <Text style={[styles.ctaText, { color: colors.ink }]}>{t('receipt.backToBill')}</Text>
            </PressableScale>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 15 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 20 },
  wordmark: { height: 44, width: 96 },
  close: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(18,18,18,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  head: { alignItems: 'flex-start', paddingTop: 40, paddingRight: 9 },
  kicker: { fontFamily: font.monoBold, fontSize: 8, letterSpacing: 2.5, color: 'rgba(18,18,18,0.6)' },
  // моно 44 pt с разрядкой — как в макете: сумма читается как на чеке
  amount: { fontFamily: font.monoBold, fontSize: 44, letterSpacing: 1, color: '#121212', marginTop: 8 },
  sub: { fontFamily: font.semibold, fontSize: 12, color: 'rgba(18,18,18,0.6)', marginTop: 6 },
  cbChip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12, marginTop: 14 },
  cbArt: { width: 22, height: 24 },
  cbText: { fontFamily: font.bold, fontSize: 12 },
  card: { borderRadius: 22, padding: 16, marginTop: 28 },
  merchantRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  merchantBody: { flex: 1, minWidth: 0 },
  merchantName: { fontFamily: font.bold, fontSize: 16 },
  orderLine: { fontFamily: font.monoBold, fontSize: 8, letterSpacing: 1.2, marginTop: 4 },
  paidChip: { borderRadius: 12, paddingVertical: 5, paddingHorizontal: 10 },
  paidChipText: { fontFamily: font.extrabold, fontSize: 10, color: '#121212' },
  dashed: { borderTopWidth: 1.5, borderStyle: 'dashed', marginTop: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingTop: 10 },
  rowLabel: { fontFamily: font.semibold, fontSize: 11 },
  rowValue: { fontFamily: font.mono, fontSize: 11, flexShrink: 1, textAlign: 'right' },
  membersCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 14,
    backgroundColor: 'rgba(18,18,18,0.06)',
  },
  faces: { flexDirection: 'row' },
  faceStacked: { marginLeft: -10 },
  membersText: { flex: 1, fontFamily: font.semibold, fontSize: 11 },
  qr: { width: 64, height: 64, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  qrHint: { fontFamily: font.semibold, fontSize: 10.5, marginTop: 10 },
  membersNames: { fontFamily: font.extrabold },
  spacer: { flex: 1, minHeight: 18 },
  actions: { gap: 10 },
  cta: { height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: font.bold, fontSize: 15 },
});
