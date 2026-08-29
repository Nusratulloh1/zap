// Экран ссылки на сплит: QR, нативный шэр, копирование, отправка SMS
// сервером. Порт web/src/pages/SharePage.vue.
import React, { useState } from 'react';
import { Clipboard, Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { PressableScale } from '@/components/PressableScale';
import { Avatar } from '@/components/Avatar';
import { fetchSplit, sendSplitLinkSms } from '@/api/splits';
import { qk } from '@/api/data';
import { useHomeData } from '@/store/bootstrap';
import { money } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

const ORIGIN = 'https://zapapp.uz';

export function ShareScreen() {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const home = useHomeData();
  const id = route.params?.id as string;

  const { data: split } = useQuery({ queryKey: qk.split(id), queryFn: () => fetchSplit(id), enabled: !!id });
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!split) {
    return (
      <Screen style={styles.root}>
        <Text style={[styles.loading, { color: colors.muted }]}>{t('bill.loading')}</Text>
      </Screen>
    );
  }

  const url = `${ORIGIN}/s/${split.code}`;
  const perPerson = split.members.length
    ? Math.round(split.total / split.members.length)
    : split.total;
  const merchant = home.db?.merchants.find((m) => m.id === split.merchantId);

  const onShare = () => void Share.share({ message: url });
  const onCopy = () => {
    Clipboard.setString(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const onSms = async () => {
    if (sending) return;
    setSending(true);
    try {
      await sendSplitLinkSms(split.id);
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen style={styles.root}>
      <PressableScale small style={[styles.back, { backgroundColor: colors.sand }]} onPress={() => nav.goBack()}>
        <Text style={[styles.backGlyph, { color: colors.ink }]}>←</Text>
      </PressableScale>

      <Text style={[styles.title, { color: colors.ink }]}>{t('share.title')}</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>
        {split.bill
          ? t('share.subtitleWithOrder', {
              merchant: merchant?.name ?? split.title,
              order: split.bill.orderNo,
              amount: money(perPerson),
            })
          : t('share.subtitleLine', { merchant: merchant?.name ?? split.title, amount: money(perPerson) })}
      </Text>

      <Animated.View entering={FadeInDown.duration(320)} style={[styles.qrBox, { backgroundColor: colors.shell }]}>
        <QRCode value={url} size={182} backgroundColor="#F7F5F0" color="#111110" />
      </Animated.View>

      <Text style={[styles.link, { color: colors.faint2 }]}>{url.replace(/^https?:\/\//, '')}</Text>

      <View style={styles.members}>
        {split.members.map((m, i) => {
          const c = home.contactById(m.contactId);
          return (
            <Animated.View key={m.contactId + i} entering={FadeInDown.delay(i * 45)} style={styles.memberRow}>
              <Avatar name={c?.name} letter={c?.initials} contactId={m.contactId} color={c?.color ?? '#3E3C35'} size={38} />
              <Text style={[styles.memberName, { color: colors.ink }]}>{c?.name ?? t('home.participantFallback')}</Text>
              <Text style={[styles.memberAmount, { color: colors.muted }]}>{money(m.amount)}</Text>
            </Animated.View>
          );
        })}
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 14 }]}>
        <PressableScale style={[styles.btn, { backgroundColor: fixed.lime }]} onPress={onShare}>
          <Text style={styles.btnDark}>{t('common.copy')}</Text>
        </PressableScale>
        <View style={styles.row}>
          <PressableScale style={[styles.btnSm, { backgroundColor: colors.sand }]} onPress={onCopy}>
            <Text style={[styles.btnSmText, { color: colors.ink }]}>
              {copied ? t('common.copied') : t('common.copy')}
            </Text>
          </PressableScale>
          <PressableScale
            style={[styles.btnSm, { backgroundColor: colors.sand }]}
            onPress={() => void onSms()}
            disabled={sending}
          >
            <Text style={[styles.btnSmText, { color: colors.ink }]}>{t('share.sendSms')}</Text>
          </PressableScale>
        </View>
        <PressableScale onPress={() => nav.replace('SplitLive', { id: split.id })}>
          <Text style={[styles.toStatus, { color: colors.muted }]}>{t('share.toStatusArrow')}</Text>
        </PressableScale>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 20 },
  loading: { fontFamily: font.semibold, fontSize: 15, marginTop: 40, textAlign: 'center' },
  back: { width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  backGlyph: { fontSize: 20, fontFamily: font.bold },
  title: { fontFamily: font.extrabold, fontSize: 25, letterSpacing: -0.6, marginTop: 18 },
  sub: { fontFamily: font.semibold, fontSize: 13.5, marginTop: 5 },
  qrBox: { alignSelf: 'center', width: 214, height: 214, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  link: { fontFamily: font.monoBold, fontSize: 11, letterSpacing: 1, textAlign: 'center', marginTop: 12 },
  members: { marginTop: 20, gap: 2 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  memberName: { flex: 1, fontFamily: font.bold, fontSize: 14.5 },
  memberAmount: { fontFamily: font.extrabold, fontSize: 14.5 },
  actions: { marginTop: 'auto', gap: 10 },
  btn: { height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  btnDark: { fontFamily: font.extrabold, fontSize: 16, color: '#111110' },
  row: { flexDirection: 'row', gap: 10 },
  btnSm: { flex: 1, height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  btnSmText: { fontFamily: font.bold, fontSize: 14 },
  toStatus: { fontFamily: font.bold, fontSize: 14, textAlign: 'center', paddingVertical: 8 },
});
