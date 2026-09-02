// Экран-чек — порт BillPage.vue (дизайн 3e): логотип, пунктирные разделители,
// позиции, итого, CTA «Разделить» / «Оплатить целиком». Фискальный чек:
// позиции догружаются (поллинг статуса), при неудаче — фото/ручной ввод.
import React, { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { ThemeGarnish } from '@/components/bill/ThemeGarnish';
import { ZapLoader } from '@/components/ZapLoader';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PressableScale } from '@/components/PressableScale';
import { PinSheet } from '@/components/PinSheet';
import { Skeleton } from '@/components/Skeleton';
import { toast } from '@/components/ToastHost';
import { fiscalStatus } from '@/api/actions';
import { createSplit } from '@/api/splits';
import { qk } from '@/api/data';
import { useDraft } from '@/store/draft';
import { useHomeData } from '@/store/bootstrap';
import { money } from '@/lib/format';
import { themeForMerchant } from '@/lib/merchantTheme';
import { useTheme } from '@/theme/ThemeProvider';
import { SCREEN_PAD_X, font } from '@/theme/tokens';

export function BillScreen() {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();
  const nav = useNavigation<any>();
  const qc = useQueryClient();
  const home = useHomeData();
  const draft = useDraft();

  const bill = draft.bill;
  const merchant = home.db?.merchants.find((m) => m.id === bill?.merchantId);
  const isFiscal = !!draft.fiscal;
  const fiscalLoading = isFiscal && draft.fiscal?.status === 'pending';
  const fiscalFailed = isFiscal && draft.fiscal?.status === 'failed';
  const fiscalNoTotal = fiscalFailed && !bill?.total;

  const theme = themeForMerchant(draft.fiscal?.merchant ?? merchant?.name);
  const [paySheet, setPaySheet] = useState(false);
  const paying = useRef(false);

  // поллинг фискального статуса: сокет с fiscal_ready сюда не подключён,
  // опрашиваем раз в 2с до 12с, дальше честный фейл
  useEffect(() => {
    if (!fiscalLoading || !draft.fiscal?.jobId) return;
    const jobId = draft.fiscal.jobId;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      void fiscalStatus(jobId)
        .then((res) => {
          if (res.status === 'ready' && res.receipt) {
            clearInterval(timer);
            draft.applyFiscalItems(
              { merchant: res.receipt.merchant, total: res.receipt.total, items: res.receipt.items },
              false,
            );
          } else if (res.status === 'failed' || tries >= 6) {
            clearInterval(timer);
            draft.fiscalFailed();
          }
        })
        .catch(() => {
          clearInterval(timer);
          draft.fiscalFailed();
        });
    }, 2000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fiscalLoading, draft.fiscal?.jobId]);

  // Сторож срабатывает ТОЛЬКО при входе на экран.
  //
  // Раньше он висел на изменении черновика, и любое обновление стора уже
  // ПОСЛЕ успешного распознавания выбрасывало обратно в камеру: человек видел
  // «чек распознан», а оказывался снова перед сканером. Нет данных на входе —
  // уходим; всё, что меняется дальше, экран разруливает сам.
  useEffect(() => {
    if (!draft.bill) nav.replace('Scan');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!bill) {
    return (
      <Screen style={styles.root}>
        <View />
      </Screen>
    );
  }

  const toSplit = () => {
    // фискальные/OCR позиции обязаны пройти экран проверки перед сплитом
    if (isFiscal && bill.items.length) nav.navigate('ReviewItems');
    else nav.navigate('Members');
  };

  const confirmPayWhole = async () => {
    setPaySheet(false);
    if (paying.current) return;
    paying.current = true;
    try {
      const split = await createSplit(
        {
          title: t('bill.wholeBill'),
          total: bill.total,
          mode: 'equal',
          merchantId: bill.merchantId || undefined,
          billId: (bill as typeof bill & { billId?: string }).billId,
          members: [{ contactId: 'me', amount: bill.total }],
        },
        home.db?.contacts ?? [],
      );
      await qc.invalidateQueries({ queryKey: qk.bootstrap });
      toast.success(t('bill.paidToast', { amount: money(bill.total) }));
      nav.replace('SplitClosed', { id: split.id });
    } finally {
      paying.current = false;
    }
  };

  return (
    <Screen style={styles.root}>
      <ScreenHeader onBack={() => nav.popTo('Scan')} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10, flexGrow: 1 }}>
        <View style={styles.head}>
          {/* демо-счёт Bellissimo — фирменный логотип, как в вебе */}
          {!isFiscal ? (
            <Image source={require('../../assets/brand/partners/bellissimo.png')} style={styles.merchantImg} />
          ) : (
            <View style={[styles.logo, { backgroundColor: colors.ink }]}>
              <Text style={[styles.logoLetter, { color: fixed.lime }]}>
                {(draft.fiscal?.merchant ?? merchant?.name ?? t('bill.merchantInitialFallback'))[0]?.toUpperCase()}
              </Text>
            </View>
          )}
          <ThemeGarnish theme={theme} />
          <Text style={[styles.merchant, { color: colors.ink }]}>
            {draft.fiscal?.merchant ?? merchant?.name ?? t('bill.fiscalTitle')}
          </Text>
          <Text style={[styles.meta, { color: colors.faint2 }]}>
            {isFiscal
              ? t('bill.fiscalSource')
              : t('bill.orderTable', { order: bill.orderNo, table: bill.table ?? '', time: bill.time })}
          </Text>
        </View>

        <View style={[styles.dashed, { borderColor: colors.hairline }]} />

        {fiscalLoading ? (
          <View style={styles.loadingBox}>
            <ZapLoader label={t('bill.loading')} size="sm" />
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.skeletonRow}>
                <Skeleton height={16} width={120 + i * 30} radius={6} />
                <Skeleton height={16} width={64} radius={6} />
              </View>
            ))}
          </View>
        ) : fiscalFailed ? (
          <View style={[styles.failBox, { backgroundColor: colors.shell }]}>
            <Text style={[styles.failTitle, { color: colors.ink }]}>{t('bill.loadFailed')}</Text>
            <Text style={[styles.failSub, { color: colors.muted }]}>
              {fiscalNoTotal ? t('bill.photoOrManual') : t('bill.totalKnown')}
            </Text>
            <PressableScale style={[styles.failCta, { backgroundColor: colors.ink }]} onPress={() => nav.navigate('Scan')}>
              <Text style={[styles.failCtaText, { color: colors.cream }]}>📷 {t('bill.photographReceipt')}</Text>
            </PressableScale>
            <PressableScale
              style={[styles.failCta, { backgroundColor: colors.sand }]}
              onPress={() => (fiscalNoTotal ? nav.popTo('Tabs', { screen: 'Amount' }) : nav.navigate('Members'))}
            >
              <Text style={[styles.failCtaText, { color: colors.ink }]}>
                {fiscalNoTotal ? t('bill.manualAmount') : t('bill.continueWith', { amount: money(bill.total) })}
              </Text>
            </PressableScale>
          </View>
        ) : (
          <View style={styles.items}>
            {bill.items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <Text style={[styles.itemTitle, { color: colors.ink }]}>
                  {item.title}
                  {item.qty > 1 ? ` ×${item.qty}` : ''}
                </Text>
                <Text style={[styles.itemAmount, { color: colors.ink }]}>{money(item.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {!fiscalNoTotal ? (
          <>
            <View style={[styles.dashed, { borderColor: colors.hairline }]} />
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.ink }]}>{t('bill.totalRow')}</Text>
              <View style={styles.totalRight}>
                <Text style={[styles.total, { color: colors.ink }]}>{money(bill.total)}</Text>
                <Text style={[styles.currency, { color: colors.faint2 }]}>UZS</Text>
              </View>
            </View>
          </>
        ) : null}

        {!isFiscal && bill.promo ? (
          <View style={[styles.promo, { backgroundColor: colors.shell }]}>
            <Text style={[styles.promoText, { color: colors.ink }]}>{bill.promo}</Text>
          </View>
        ) : null}

        <View style={styles.spacer} />

        {!fiscalNoTotal ? (
          <View style={styles.ctas}>
            <PressableScale
              disabled={fiscalLoading}
              style={[styles.cta, { backgroundColor: fixed.lime }, fiscalLoading && styles.disabled]}
              onPress={toSplit}
            >
              <Text style={styles.ctaDark}>{t('bill.split')}</Text>
            </PressableScale>
            <PressableScale
              disabled={fiscalLoading}
              style={[styles.cta, { backgroundColor: colors.sand }, fiscalLoading && styles.disabled]}
              onPress={() => setPaySheet(true)}
            >
              <Text style={[styles.ctaLight, { color: colors.ink }]}>{t('bill.payWhole')}</Text>
            </PressableScale>
          </View>
        ) : null}
      </ScrollView>

      <PinSheet
        open={paySheet}
        hint={t('bill.pinHint', { amount: money(bill.total), merchant: merchant?.name ?? 'Bellissimo' })}
        onClose={() => setPaySheet(false)}
        onConfirm={() => void confirmPayWhole()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: SCREEN_PAD_X },
  head: { marginTop: 26, paddingHorizontal: 4, gap: 6 },
  merchantImg: { width: 84, height: 84, marginLeft: -10 },
  logo: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { fontFamily: font.extrabold, fontSize: 24 },
  merchant: { fontFamily: font.extrabold, fontSize: 19 },
  meta: { fontFamily: font.monoBold, fontSize: 9.5, letterSpacing: 1.2 },
  dashed: { borderTopWidth: 2, borderStyle: 'dashed', marginTop: 16 },
  loadingBox: { marginTop: 12, gap: 10, paddingHorizontal: 4 },
  loadingText: { fontFamily: font.semibold, fontSize: 12.5 },
  skeletonRow: { flexDirection: 'row', justifyContent: 'space-between' },
  failBox: { marginTop: 12, borderRadius: 18, padding: 16, gap: 8 },
  failTitle: { fontFamily: font.bold, fontSize: 14 },
  failSub: { fontFamily: font.semibold, fontSize: 12.5, lineHeight: 17 },
  failCta: { height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  failCtaText: { fontFamily: font.bold, fontSize: 14 },
  items: { marginTop: 10, paddingHorizontal: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 34 },
  itemTitle: { fontFamily: font.semibold, fontSize: 14, flexShrink: 1 },
  itemAmount: { fontFamily: font.monoBold, fontSize: 12.5 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 14, paddingHorizontal: 4 },
  totalLabel: { fontFamily: font.extrabold, fontSize: 15 },
  totalRight: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  total: { fontFamily: font.extrabold, fontSize: 19, letterSpacing: -0.2 },
  currency: { fontFamily: font.monoBold, fontSize: 10 },
  promo: { height: 36, borderRadius: 999, justifyContent: 'center', paddingHorizontal: 14, marginTop: 12, alignSelf: 'flex-start' },
  promoText: { fontFamily: font.bold, fontSize: 12.5 },
  spacer: { flexGrow: 1, minHeight: 24 },
  ctas: { gap: 10 },
  cta: { height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  ctaDark: { fontFamily: font.extrabold, fontSize: 16, color: '#111110' },
  ctaLight: { fontFamily: font.bold, fontSize: 16 },
  disabled: { opacity: 0.4 },
});
