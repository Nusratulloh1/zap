// Group / Live Bill — «сердце ZAP» (PRODUCT-VISION, часть B §2, часть C §3–5).
//
// Это не платёжный экран, а мини-комната компании: центральный чек, вокруг —
// крупные лица участников, мгновенно читаемый статус «3 / 4 оплатили»,
// реакции прямо на деньги и «⚡ Пингануть» вместо сухого «Напомнить».
// Когда кто-то платит, его карточка оживает у всех одновременно (сокет).
//
// СЦЕНА ДЛЯ АНИМАЦИЙ (следующий проход, ничего из этого пока не анимируется):
//   • Split the Bill  → stage.receipt: scale 1→0.96, молния, разрыв на куски,
//                        куски летят к stage.members по measure()
//   • Friend Paid     → карточка участника: серое кольцо → лайм + ✓ + «zapped»
//   • Everyone Paid   → stage.center: схождение аватаров, вспышка ZAP!, частицы
//   • Reminder        → от аватара «меня» к stage.members[id] летит ⚡
//   • QR → receipt    → на ScanScreen, приземляется в stage.receipt этого экрана
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { ShareCardSheet } from '@/components/share/ShareCardSheet';
import { StickerBurst } from '@/components/StickerBurst';
import { cue } from '@/lib/feedback';
import { reminderLine } from '@/lib/reminders';
import { themeForMerchant } from '@/lib/merchantTheme';
import { ZapOverlay } from '@/components/ZapOverlay';
import { ZapLoader } from '@/components/ZapLoader';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PressableScale } from '@/components/PressableScale';
import { BottomSheet } from '@/components/BottomSheet';
import { PinSheet } from '@/components/PinSheet';
import { toast } from '@/components/ToastHost';
import { BillReceipt } from '@/components/bill/BillReceipt';
import { ThemeGarnish } from '@/components/bill/ThemeGarnish';
import { BoltFlight } from '@/components/bill/BoltFlight';
import { MemberOrb } from '@/components/bill/MemberOrb';
import { SplitTheBill } from '@/components/bill/SplitTheBill';
import { EveryonePaid } from '@/components/bill/EveryonePaid';
import { fetchSplit, remindMember, coverRemainder, reactToMember, renameSplit } from '@/api/splits';
import { qk } from '@/api/data';
import type { Db, SplitReaction } from '@zap/shared/types';
import { joinSplitRoom, onRealtime } from '@/lib/realtime';
import { shareSplit } from '@/lib/share';
import { BillStageProvider, useBillStageValue } from '@/lib/billStage';
import { useHomeData } from '@/store/bootstrap';
import { money } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { SCREEN_PAD_X, font } from '@/theme/tokens';
import { EASE_ZAP, SPLIT_TIMELINE } from '@/lib/motion';
import { reduceMotion } from '@/lib/feedback';

const MERCHANT_LOGOS: Record<string, number> = {
  m_bellissimo: require('../../assets/brand/partners/bellissimo.png'),
};

/** Подписи ожидания оплаты. */
const PAY_STEPS = ['loading.paying1', 'loading.paying2'] as const;
const PAY_STICKERS = ['heartZap', 'paidDone'] as const;

export function SplitLiveScreen() {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const qc = useQueryClient();
  const home = useHomeData();
  const id = route.params?.id as string;
  const stage = useBillStageValue();
  const centerRef = useAnimatedRef<View>();

  const { data: split, refetch } = useQuery({
    queryKey: qk.split(id),
    queryFn: () => fetchSplit(id),
    enabled: !!id,
    // сплит уже есть в загруженном /bootstrap — рисуем сразу, сеть догоняет
    initialData: () => qc.getQueryData<Db>(qk.bootstrap)?.splits.find((s) => s.id === id),
    initialDataUpdatedAt: () => qc.getQueryState(qk.bootstrap)?.dataUpdatedAt,
  });

  useEffect(() => {
    stage.setCenter(centerRef);
    return () => stage.setCenter(null);
  }, [stage, centerRef]);

  // ⚡ Split the Bill проигрывается один раз при первом открытии свежего
  // сплита: это момент «я только что разделил счёт», а не каждый вход
  const [splitAnim, setSplitAnim] = useState(false);
  const splitPlayed = useRef(false);
  // кольца участников загораются на шаге 800–1000 мс таймлайна
  const [ringsLit, setRingsLit] = useState(true);

  // 🎉 Everyone Paid — когда последний участник закрыл долю
  const [celebrate, setCelebrate] = useState(false);
  const prevPaidCount = useRef<number | null>(null);

  // был ли активен при открытии — закрытие уводим на экран «Готово»
  const wasActive = useRef<boolean | null>(null);
  if (split && wasActive.current === null) wasActive.current = split.status === 'active';

  // Live: комната сплита + переспрос при любом событии, чтобы у всех за
  // столом состояние совпадало
  useEffect(() => {
    if (!split?.code) return;
    joinSplitRoom(split.code);
    return onRealtime(() => {
      void refetch();
      void qc.invalidateQueries({ queryKey: qk.bootstrap });
    });
  }, [split?.code, refetch, qc]);

  // сплит открыт впервые и ещё никто не платил — играем подписную анимацию
  useEffect(() => {
    if (!split || splitPlayed.current) return;
    const fresh = route.params?.justCreated === true;
    if (!fresh) return;
    splitPlayed.current = true;
    if (reduceMotion()) return;
    setRingsLit(false);
    setSplitAnim(true);
  }, [split, route.params?.justCreated]);

  useEffect(() => {
    if (!split) return;
    const paidNow = split.members.filter((m) => m.status === 'paid' || m.status === 'debt').length;
    const total = split.members.length;
    const was = prevPaidCount.current;
    prevPaidCount.current = paidNow;

    // именно ПЕРЕХОД в «все оплатили», а не открытие уже закрытого счёта
    if (was !== null && was < total && paidNow === total && total > 0) {
      setCelebrate(true);
    } else if (was === null && paidNow === total && split.status === 'closed') {
      // экран открыт на уже закрытом сплите — празднование не повторяем
      wasActive.current = false;
    }
  }, [split]);

  useEffect(() => {
    // на закрытие уводим только после празднования
    if (split?.status === 'closed' && wasActive.current && !celebrate) {
      const timer = setTimeout(() => nav.replace('SplitClosed', { id }), 900);
      return () => clearTimeout(timer);
    }
  }, [split?.status, nav, id, celebrate]);

  // одна памятка на весь расчёт: список участников — новая ссылка на каждый
  // рендер, и без этого мемо пересчёт шёл бы на каждое событие сокета
  const members = useMemo(() => split?.members ?? [], [split?.members]);
  const { paidMembers, paidAmount, remainder, progress } = useMemo(() => {
    const paidList = members.filter((m) => m.status === 'paid' || m.status === 'debt');
    return {
      paidMembers: paidList,
      paidAmount: paidList.reduce((s, m) => s + m.amount, 0),
      remainder: members
        .filter((m) => m.status !== 'paid' && m.status !== 'debt')
        .reduce((s, m) => s + m.amount, 0),
      progress: members.length ? paidList.length / members.length : 0,
    };
  }, [members]);

  const bar = useSharedValue(0);
  useEffect(() => {
    bar.value = withTiming(progress, { duration: 700, easing: EASE_ZAP });
  }, [progress, bar]);
  const barStyle = useAnimatedStyle(() => ({ width: `${Math.min(100, bar.value * 100)}%` }));

  const [pinged, setPinged] = useState<Set<string>>(new Set());
  const [coverSheet, setCoverSheet] = useState(false);
  const covering = useRef(false);
  // ref спасает от двойного тапа, состояние — рисует ожидание
  const [isCovering, setCovering] = useState(false);
  const [coverBurst, setCoverBurst] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [boltTo, setBoltTo] = useState<string | null>(null);
  const [boltContact, setBoltContact] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  // реакции: сервер уже отдаёт их вместе со сплитом, локально держим
  // оптимистичный слой, чтобы тап отзывался мгновенно
  const [optimistic, setOptimistic] = useState<SplitReaction[] | null>(null);
  const reactions = optimistic ?? split?.reactions ?? [];
  useEffect(() => {
    setOptimistic(null);
  }, [split?.reactions]);

  const nameOf = useCallback(
    (cid: string) => (cid === 'me' ? (home.db?.user?.name ?? t('members.youShort')) : (home.contactById(cid)?.name ?? '?')),
    [home, t],
  );
  const colorOf = (cid: string) => (cid === 'me' ? '#111110' : (home.contactById(cid)?.color ?? '#8A887E'));
  const merchant = home.db?.merchants.find((m) => m.id === split?.merchantId);
  const myUserId = home.db?.user?.id;

  /** Ваша карточка — точка вылета молнии при пинге. */
  const myMemberId = (() => {
    const me = members.find((m) => m.isYou) as { memberId?: string; contactId: string } | undefined;
    return me ? (me.memberId ?? me.contactId) : undefined;
  })();

  /**
   * «⚡ Пингануть» — фирменная механика (vision, часть A, «👀 Reminder»).
   *
   * Сначала из вашего аватара вылетает молния и летит к должнику, и только
   * когда она долетит — его карточка вздрагивает и получает «Pinged 👀».
   * Поэтому статус ставится не здесь, а в onDone у полёта: иначе аватар
   * дёргался бы раньше, чем до него что-то долетело.
   */
  const ping = async (m: { contactId: string; memberId?: string }) => {
    const target = m.memberId ?? m.contactId;
    setBoltTo(target);
    setBoltContact(m.contactId);
    cue('reminder');
    try {
      await remindMember(id, target);
    } catch (e) {
      setBoltTo(null);
      toast(e instanceof Error ? e.message : t('debts.alreadyReminded'));
    }
  };

  /** Молния долетела: теперь вздрагивание и подпись. */
  const onBoltLanded = () => {
    const contactId = boltContact;
    setBoltTo(null);
    if (!contactId) return;
    setPinged((sset) => new Set([...sset, contactId]));
    // живая фраза вместо «напоминание отправлено» (vision §B4)
    const m = members.find((x) => x.contactId === contactId);
    toast.success(
      reminderLine(contactId, pinged.size, {
        name: nameOf(contactId),
        amount: money(m?.amount ?? 0),
      }),
    );
  };

  const react = async (memberId: string, emoji: string) => {
    if (!myUserId) return;
    const mine = reactions.find((r) => r.memberId === memberId && r.fromUserId === myUserId);
    const next = reactions.filter((r) => !(r.memberId === memberId && r.fromUserId === myUserId));
    if (mine?.emoji !== emoji) {
      next.push({ memberId, emoji, fromUserId: myUserId, fromName: (home.db?.user?.name ?? '').split(' ')[0] ?? '' });
    }
    setOptimistic(next);
    try {
      await reactToMember(id, memberId, emoji);
      await refetch();
    } catch {
      setOptimistic(null);
    }
  };

  const saveTitle = async () => {
    const next = renameValue.trim();
    setRenameOpen(false);
    if (!next || next === split?.title) return;
    // оптимистично: название меняется сразу, сервер догоняет
    qc.setQueryData<typeof split>(qk.split(id), (prev) => (prev ? { ...prev, title: next } : prev));
    try {
      await renameSplit(id, next);
      await qc.invalidateQueries({ queryKey: qk.bootstrap });
      toast.success(t('live.renamed'));
    } catch (e) {
      await refetch();
      toast(e instanceof Error && e.message ? e.message : t('errors.generic'));
    }
  };

  /**
   * «Поделиться» открывает карточку «ZAP COMPLETE» (vision §7), а не сразу
   * системный шеринг: человек должен увидеть, что именно он выкладывает.
   * Пока счёт не закрыт, делиться карточкой рано — уходит обычная ссылка.
   */
  const doShare = async () => {
    if (!split) return;
    if (split.status === 'closed') {
      setCardOpen(true);
      return;
    }
    try {
      cue('share');
      await shareSplit(split.code, split.title);
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : t('live.shareFailed'));
    }
  };

  const confirmCover = async () => {
    setCoverSheet(false);
    if (covering.current) return;
    covering.current = true;
    setCovering(true);
    try {
      await coverRemainder(id);
      cue('paid');
      // стикер успеха: если этим действием счёт закрылся полностью, его
      // место займёт празднование «все оплатили» — два подряд не нужны
      if (remainder < (split?.total ?? 0)) setCoverBurst(true);
      await refetch();
      await qc.invalidateQueries({ queryKey: qk.bootstrap });
    } finally {
      covering.current = false;
      setCovering(false);
    }
  };

  if (!split) {
    return (
      <Screen style={styles.root} background={colors.cream}>
        <ScreenHeader onBack={() => nav.navigate('Tabs')} />
        <View style={styles.loading}>
          <ZapLoader label={t('bill.loading')} />
        </View>
      </Screen>
    );
  }

  // тема заведения — гарнир, а не перекраска (vision §5)
  const theme = themeForMerchant(merchant?.name ?? split.title);

  const allPaid = paidMembers.length === members.length && members.length > 0;
  const waitingNames = members
    .filter((m) => m.status !== 'paid' && m.status !== 'debt')
    .map((m) => nameOf(m.contactId));

  return (
    <BillStageProvider value={stage}>
      <Screen style={styles.root} background={colors.cream}>
        <ScreenHeader onBack={() => nav.navigate('Tabs')} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* «3 / 4 оплатили» — статус читается мгновенно (Who's left) */}
          <View style={styles.statusRow}>
            <View style={styles.statusHead}>
              <Text style={[styles.status, { color: colors.ink }]}>
                {t('live.paidOfCount', { paid: paidMembers.length, total: members.length })}
              </Text>
              {/* доля закрытого — крупной плашкой, а не мелким процентом у полосы */}
              <View style={[styles.pct, { backgroundColor: allPaid ? fixed.lime : colors.sand }]}>
                <Text style={[styles.pctText, { color: colors.ink }]}>
                  {Math.round((paidMembers.length / Math.max(1, members.length)) * 100)}%
                </Text>
              </View>
            </View>
            <Text style={[styles.statusSub, { color: colors.muted }]} numberOfLines={1}>
              {allPaid ? t('live.allPaidHeadline') : t('live.waitingFor', { names: waitingNames.join(', ') })}
            </Text>
          </View>

          <View style={[styles.track, { backgroundColor: colors.pebble }]}>
            <Animated.View style={[styles.fill, { backgroundColor: fixed.lime }, barStyle]} />
          </View>

          {/* центральный чек — узел для Split the Bill */}
          <View>
            <ThemeGarnish theme={theme} />
            <BillReceipt
            title={split.title}
            merchantName={merchant?.name}
            merchantLogo={split.merchantId ? MERCHANT_LOGOS[split.merchantId] : undefined}
            orderLine={split.bill ? t('live.orderNo', { no: split.bill.orderNo }).trim() : undefined}
            total={split.total}
            paidAmount={paidAmount}
              onPressTitle={() => {
                setRenameValue(split.title);
                setRenameOpen(true);
              }}
            />
          </View>

          {/* точка схождения для Everyone Paid */}
          <Animated.View ref={centerRef} style={styles.center} pointerEvents="none" />

          {/* лица вокруг чека: крупно, деньги вторичны */}
          <View style={styles.members}>
            {members.map((m, i) => {
              const memberId = (m as { memberId?: string }).memberId ?? m.contactId;
              return (
                <MemberOrb
                  key={memberId + i}
                  memberId={memberId}
                  contactId={m.contactId}
                  name={nameOf(m.contactId)}
                  initials={home.contactById(m.contactId)?.initials}
                  color={colorOf(m.contactId)}
                  amount={m.amount}
                  paid={ringsLit && (m.status === 'paid' || m.status === 'debt')}
                  covered={m.status === 'debt'}
                  opened={m.status === 'opened'}
                  isYou={m.isYou}
                  pinged={pinged.has(m.contactId)}
                  ringDelay={splitAnim ? Math.max(0, SPLIT_TIMELINE.rings.at - SPLIT_TIMELINE.fly.at) + i * 60 : 0}
                  reactions={reactions.filter((r) => r.memberId === memberId)}
                  myUserId={myUserId}
                  onPing={m.isYou ? undefined : () => void ping({ contactId: m.contactId, memberId: (m as { memberId?: string }).memberId })}
                  onReact={(e) => void react(memberId, e)}
                />
              );
            })}
          </View>

          <View style={styles.spacer} />

          <View style={styles.actions}>
            {remainder > 0 ? (
              <PressableScale
                primary
                style={[styles.cta, { backgroundColor: fixed.ink }]}
                onPress={() => setCoverSheet(true)}
              >
                <Text style={[styles.ctaText, { color: fixed.lime }]}>
                  {t('live.coverAction', { amount: money(remainder) })}
                </Text>
              </PressableScale>
            ) : null}

            {/* Share Card появится следующим проходом — кнопка уже на месте */}
            <PressableScale
              style={[styles.cta, { backgroundColor: colors.sand }]}
              onPress={() => void doShare()}
            >
              <Text style={[styles.ctaText, { color: colors.ink }]}>{t('live.shareAction')}</Text>
            </PressableScale>
          </View>
        </ScrollView>

        {/* своё название вечера: «Boys Dinner 🍕» вместо мерчанта (vision §14) */}
        <BottomSheet open={renameOpen} onClose={() => setRenameOpen(false)}>
          <Text style={[styles.sheetTitle, { color: colors.ink }]}>{t('live.renameTitle')}</Text>
          <TextInput
            value={renameValue}
            onChangeText={setRenameValue}
            placeholder={t('live.renameHint')}
            placeholderTextColor={colors.faint}
            cursorColor={colors.lime}
            style={[styles.renameInput, { color: colors.ink, borderBottomColor: colors.lime }]}
            autoFocus
          />
          <PressableScale
            primary
            style={[styles.sheetBtn, { backgroundColor: colors.ink }]}
            onPress={() => void saveTitle()}
          >
            <Text style={[styles.sheetBtnText, { color: colors.paper }]}>{t('live.renameSave')}</Text>
          </PressableScale>
        </BottomSheet>

        {/* ⚡ подписная анимация разделения счёта */}
        <SplitTheBill
          run={splitAnim}
          pieces={members.map((m) => ({
            memberId: (m as { memberId?: string }).memberId ?? m.contactId,
            amount: m.amount,
          }))}
          onDone={() => {
            setSplitAnim(false);
            setRingsLit(true);
          }}
        />

        {/* 🎉 все закрыли счёт */}
        <EveryonePaid
          run={celebrate}
          onDone={() => {
            setCelebrate(false);
            nav.replace('SplitClosed', { id });
          }}
          onShare={() => {
            setCelebrate(false);
            void doShare();
            nav.replace('SplitClosed', { id });
          }}
        />

        <PinSheet
          open={coverSheet}
          hint={t('live.pinHint', { amount: money(remainder) })}
          onClose={() => setCoverSheet(false)}
          onConfirm={() => void confirmCover()}
        />
        <ZapOverlay open={isCovering} steps={PAY_STEPS} stickers={PAY_STICKERS} />
        {/* доля закрыта — стикер вспыхивает и уходит сам */}
        <StickerBurst run={coverBurst} sticker="handsHeart" onDone={() => setCoverBurst(false)} />
        {/* ⚡ летит от вашего аватара к должнику */}
        <BoltFlight fromMemberId={myMemberId} toMemberId={boltTo} onDone={onBoltLanded} />

        {/* карточка для сторис — то, что расходится органически */}
        <ShareCardSheet
          open={cardOpen}
          onClose={() => setCardOpen(false)}
          title={split.title}
          total={split.total}
          code={split.code}
          merchantLogo={split.merchantId ? MERCHANT_LOGOS[split.merchantId] : undefined}
          members={members.map((m) => ({
            contactId: m.contactId,
            name: nameOf(m.contactId),
            initials: home.contactById(m.contactId)?.initials,
            color: colorOf(m.contactId),
            paid: m.status === 'paid' || m.status === 'debt',
          }))}
        />
      </Screen>
    </BillStageProvider>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: SCREEN_PAD_X },
  scroll: { paddingBottom: 10, flexGrow: 1 },
  loading: { marginTop: 48, alignItems: 'center' },
  statusRow: { marginTop: 18, gap: 5 },
  statusHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  status: { flex: 1, fontFamily: font.extrabold, fontSize: 30, letterSpacing: -0.6 },
  pct: { height: 34, minWidth: 56, paddingHorizontal: 12, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  pctText: { fontFamily: font.extrabold, fontSize: 15 },
  statusSub: { fontFamily: font.semibold, fontSize: 13.5 },
  // полоса заметно толще прежних 8 px: это заголовок экрана, а не сноска
  track: { height: 13, borderRadius: 999, overflow: 'hidden', marginTop: 14, marginBottom: 20 },
  fill: { height: '100%', borderRadius: 999 },
  center: { alignSelf: 'center', width: 1, height: 1 },
  // +9 px под зубцы чека, которые выступают за его нижний край
  members: { gap: 10, marginTop: 27 },
  spacer: { flexGrow: 1, minHeight: 18 },
  actions: { gap: 10, marginTop: 18 },
  cta: { height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: font.extrabold, fontSize: 16 },
  sheetTitle: { fontFamily: font.extrabold, fontSize: 15, textAlign: 'center', marginBottom: 12 },
  renameInput: { fontFamily: font.bold, fontSize: 18, borderBottomWidth: 2, paddingBottom: 10, padding: 0 },
  sheetBtn: { height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  sheetBtnText: { fontFamily: font.bold, fontSize: 15 },
});
