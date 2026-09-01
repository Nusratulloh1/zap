// Экран ссылки на сплит: QR, нативный шэр, копирование, отправка SMS
// сервером. Порт web/src/pages/SharePage.vue.
import React, { useEffect, useState } from 'react';
import { Clipboard, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { StickerBurst } from '@/components/StickerBurst';
import { cue, reduceMotion } from '@/lib/feedback';
import { enablePush, pushAsked } from '@/lib/push';
import { splitUrl } from '@/lib/share';
import { ZapLoader } from '@/components/ZapLoader';
import { PressableScale } from '@/components/PressableScale';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Avatar } from '@/components/Avatar';
import { MailIcon } from '@/components/icons';
import { toast } from '@/components/ToastHost';
import { fetchSplit, sendSplitLinkSms } from '@/api/splits';
import { qk } from '@/api/data';
import type { Db } from '@zap/shared/types';
import { useHomeData } from '@/store/bootstrap';
import { money, equalShares } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { SCREEN_PAD_X, fixedPalette, font } from '@/theme/tokens';


export function ShareScreen() {
  const { t } = useTranslation();
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
  const [sending, setSending] = useState(false);
  const [burst, setBurst] = useState(false);

  // «сплит готов» — звук и отдача один раз при входе на экран.
  // Хук стоит ДО раннего return по загрузке: порядок хуков обязан совпадать
  // на каждом рендере.
  useEffect(() => {
    cue('splitDone');
    setBurst(true);

    // Разрешение на пуши просим ЗДЕСЬ, а не на первом запуске: сплит только
    // что создан, и смысл уведомлений очевиден — «узнаешь, когда друг
    // оплатит». На старте приложения этот вопрос выглядит навязчивым и его
    // чаще отклоняют. Спрашиваем один раз (см. pushAsked).
    if (!pushAsked()) {
      const id = setTimeout(() => void enablePush(), 1200);
      return () => clearTimeout(id);
    }
  }, []);


  if (!split) {
    return (
      <Screen style={styles.root}>
        <View style={styles.loading}>
          <ZapLoader label={t('bill.loading')} />
        </View>
      </Screen>
    );
  }

  const url = splitUrl(split.code);
  const perPerson = equalShares(split.total, split.members.length)[0] ?? 0;
  const merchant = home.db?.merchants.find((m) => m.id === split.merchantId);
  const waitingNames = split.members
    .filter((m) => m.status === 'waiting' || m.status === 'opened')
    .map((m) => home.contactById(m.contactId)?.name ?? '?')
    .join(t('common.and'));

  const onCopy = () => {
    Clipboard.setString(url);
    toast.success(t('common.copied'));
  };
  const onSms = async () => {
    if (sending) return;
    setSending(true);
    try {
      const res = await sendSplitLinkSms(split.id);
      toast.success(res.sent > 1 ? t('share.smsSentMany', { n: res.sent }) : t('share.smsSent'));
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : t('share.smsFailed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen style={styles.root}>
      <ScreenHeader onBack={() => nav.replace('SplitLive', { id })} />

      <Animated.Text
        entering={reduceMotion() ? undefined : FadeInDown.delay(90).duration(300)}
        style={[styles.title, { color: colors.ink }]}
      >
        {t('share.title')}
      </Animated.Text>
      <Text style={[styles.sub, { color: colors.muted }]}>
        {split.bill
          ? t('share.subtitleWithOrder', {
              merchant: merchant?.name ?? split.title,
              order: split.bill.orderNo,
              amount: money(perPerson),
            })
          : t('share.subtitleLine', { merchant: merchant?.name ?? split.title, amount: money(perPerson) })}
      </Text>

      <Animated.View entering={FadeInDown.duration(320)} style={[styles.qrBox, { backgroundColor: fixedPalette.shell }]}>
        <QRCode value={url} size={182} backgroundColor="#F7F5F0" color="#111110" />
      </Animated.View>

      <Text style={[styles.link, { color: colors.faint2 }]}>{url.replace(/^https?:\/\//, '')}</Text>

      <View style={styles.statusRow}>
        <View style={styles.stack}>
          {split.members.map((m, i) => {
            const c = home.contactById(m.contactId);
            return (
              <Avatar
                key={m.contactId + i}
                name={c?.name ?? t('members.youShort')}
                letter={c?.initials}
                contactId={m.contactId}
                color={m.contactId === 'me' ? '#111110' : (c?.color ?? '#111110')}
                size={34}
                ring={colors.paper}
                style={i > 0 ? styles.stackOverlap : undefined}
              />
            );
          })}
        </View>
        <Text style={[styles.statusText, { color: colors.muted }]}>
          {waitingNames ? t('share.statusPaidWaiting', { names: waitingNames }) : t('share.allCollected')}
        </Text>
      </View>

      <View style={[styles.actions, { paddingBottom: 10 }]}>
        <PressableScale
          style={[styles.btn, { backgroundColor: fixed.lime }, sending && styles.sendingDim]}
          onPress={() => void onSms()}
          disabled={sending}
        >
          <MailIcon size={19} color="#111110" />
          <Text style={styles.btnDark}>{t('share.sendSms')}</Text>
        </PressableScale>
        <PressableScale style={[styles.btn, { backgroundColor: colors.sand }]} onPress={onCopy}>
          <Text style={[styles.btnLight, { color: colors.ink }]}>{t('common.copy')}</Text>
        </PressableScale>
        <PressableScale onPress={() => nav.replace('SplitLive', { id: split.id, justCreated: true })}>
          <Text style={[styles.toStatus, { color: colors.muted }]}>{t('share.toStatusArrow')}</Text>
        </PressableScale>
      </View>
      {/* сплит создан — стикер вспыхивает и уходит сам */}
      <StickerBurst run={burst} sticker="billDone" onDone={() => setBurst(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: SCREEN_PAD_X },
  loading: { marginTop: 48, alignItems: 'center' },
  back: { width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  backGlyph: { fontSize: 20, fontFamily: font.bold },
  title: { fontFamily: font.extrabold, fontSize: 25, letterSpacing: -0.3, marginTop: 22 },
  sub: { fontFamily: font.semibold, fontSize: 13.5, marginTop: 5 },
  qrBox: { alignSelf: 'center', width: 214, height: 214, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  link: { fontFamily: font.monoBold, fontSize: 11, letterSpacing: 1, textAlign: 'center', marginTop: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  stack: { flexDirection: 'row' },
  stackOverlap: { marginLeft: -10 },
  statusText: { flex: 1, fontFamily: font.semibold, fontSize: 12.5 },
  actions: { marginTop: 'auto', gap: 10 },
  btn: { height: 56, borderRadius: 999, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  btnDark: { fontFamily: font.extrabold, fontSize: 16, color: '#111110' },
  btnLight: { fontFamily: font.bold, fontSize: 16 },
  sendingDim: { opacity: 0.6 },
  toStatus: { fontFamily: font.bold, fontSize: 14, textAlign: 'center', paddingVertical: 8 },
});
