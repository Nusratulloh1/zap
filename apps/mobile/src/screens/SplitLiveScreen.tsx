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
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View , useWindowDimensions } from 'react-native';
import Animated, { useAnimatedRef, useSharedValue, withTiming } from 'react-native-reanimated';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { LiveReceipt } from '@/components/bill/LiveReceipt';
import { UnpaidStub } from '@/components/bill/UnpaidStub';
import { ReactionBurst } from '@/components/bill/ReactionBurst';
import { ReactionPicker } from '@/components/bill/ReactionPicker';
import { PingStrike } from '@/components/bill/PingStrike';
import { PingToast } from '@/components/bill/PingToast';
import { Confetti } from '@/components/bill/Confetti';
import { STICKER } from '@/components/EmptyState';
import { BackIcon } from '@/components/icons';
import { MemberFace } from '@/components/bill/MemberFace';
import { TornEdge } from '@/components/bill/TornEdge';
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
import { startLiveActivity, endLiveActivity } from '@/lib/liveActivity';
import { merchantLogo } from '@/lib/merchantLogo';
import { EASE_ZAP } from '@/lib/motion';
import { reduceMotion } from '@/lib/feedback';



/** Палитра реакций — столбик: кружок 34 + поля 6, высота на 5 эмодзи. */
const PICKER_W = 34 + 12;
const PICKER_H = 5 * 34 + 4 * 6 + 16;

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
  /*
    Отрыв корешков от чека играем при каждом открытии счёта, а не только сразу
    после создания: это главный жест экрана — «чек разорвали на части». Если
    перед этим идёт подписная анимация разделения, ждём, пока она отыграет.
  */
  const justCreated = route.params?.justCreated === true;
  const centerRef = useAnimatedRef<View>();
  // слой сцены: от него считаются координаты молнии и палитры
  const layerRef = useAnimatedRef<View>();
  const [layerAt, setLayerAt] = useState({ x: 0, y: 0 });

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


  /*
    Live Activity / Dynamic Island (vision §C18): «ZAP · Bellissimo / 3 of 4
    paid / ⚡ Timur left, и обновлять состояние прямо с lock screen».

    Держим плашку ровно пока счёт активен, и снимаем при закрытии — иначе на
    локскрине останется «3 из 4» у давно закрытого счёта. Обновления идут по
    тем же данным, что и полоска прогресса выше, поэтому расхождения быть не
    может по построению.
  */
  const merchantName = useMemo(
    () => home.db?.merchants.find((m) => m.id === split?.merchantId)?.name ?? split?.title ?? 'ZAP',
    [home.db, split?.merchantId, split?.title],
  );

  useEffect(() => {
    if (!split || split.status !== 'active') return;
    const paidNow = members.filter((m) => m.status === 'paid' || m.status === 'debt').length;
    const waiting = members.find((m) => m.status !== 'paid' && m.status !== 'debt');
    const name = waiting && !waiting.isYou ? (home.contactById(waiting.contactId)?.name ?? '') : '';
    /*
      Строка «кто не заплатил» — с подколом (замечание руководства: сухое
      «X left» скучно). Вариант выбирается стабильно из id сплита и имени,
      чтобы плашка не меняла шутку при каждом обновлении.
    */
    let pending = '';
    if (name) {
      const seed = [...(split.id + name)].reduce((a, c) => a + c.charCodeAt(0), 0);
      pending = t(`live.roast${(seed % 4) + 1}`, { name: name.split(' ')[0] });
    }
    startLiveActivity(split.id, merchantName, money(split.total), paidNow, members.length, pending);
  }, [split, members, merchantName, home, t]);

  useEffect(() => {
    if (split?.status === 'closed') endLiveActivity(split.id);
  }, [split?.status, split?.id]);

  /*
    Кто закрыл долю только что: сравниваем состав оплативших с прошлым
    рендером. Первый заход только запоминает список — иначе при открытии
    экрана лаймом вспыхнули бы все строки сразу.
  */
  const knownPaid = useRef<Set<string> | null>(null);
  useEffect(() => {
    const now = new Set(
      members
        .filter((m) => m.status === 'paid' || m.status === 'debt')
        .map((m) => (m as { memberId?: string }).memberId ?? m.contactId),
    );
    const was = knownPaid.current;
    knownPaid.current = now;
    if (!was) return;
    const added = [...now].filter((x) => !was.has(x));
    if (!added.length) return;
    setFresh(new Set(added));
    const timer = setTimeout(() => setFresh(new Set()), 1200);
    return () => clearTimeout(timer);
  }, [members]);

  const bar = useSharedValue(0);
  useEffect(() => {
    bar.value = withTiming(progress, { duration: 700, easing: EASE_ZAP });
  }, [progress, bar]);

  const [pinged, setPinged] = useState<Set<string>>(new Set());
  // кому именно закрываем долю: null — никому, иначе PIN на эту сумму
  const [coverFor, setCoverFor] = useState<{ memberId: string; amount: number } | null>(null);
  // аватар, в который только что прилетела молния
  const [shakeId, setShakeId] = useState<string | null>(null);
  // строки, появившиеся в чеке только что: они въезжают с лаймовой вспышкой
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  // реакция, которую сейчас показываем во весь экран
  const [burst, setBurst] = useState<{ emoji: string } | null>(null);
  const covering = useRef(false);
  // ref спасает от двойного тапа, состояние — рисует ожидание
  const [isCovering, setCovering] = useState(false);
  const [coverBurst, setCoverBurst] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [boltTo, setBoltTo] = useState<string | null>(null);
  const [boltContact, setBoltContact] = useState<string | null>(null);
  // откуда вылетает молния — центр нажатой кнопки ⚡
  const [boltFrom, setBoltFrom] = useState<{ x: number; y: number } | null>(null);
  // плашка «получил пинг» из макета
  const [pingToast, setPingToast] = useState<{ title: string; line: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  /*
    Палитра реакций: держим не только «кому», но и экранные координаты
    кружка «+». Раньше она вставлялась в поток и сдвигала весь чек вниз —
    в Telegram палитра всплывает над контентом, ничего не двигая.
  */
  const [reactFor, setReactFor] = useState<
    { memberId: string; x: number; y: number; width: number; height: number } | null
  >(null);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
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
  const colorOf = (cid: string) => (cid === 'me' ? '#121212' : (home.contactById(cid)?.color ?? '#8A887E'));
  const merchant = home.db?.merchants.find((m) => m.id === split?.merchantId);
  const myUserId = home.db?.user?.id;

  /**
   * «⚡ Пингануть» — фирменная механика (vision, часть A, «👀 Reminder»).
   *
   * Сначала из вашего аватара вылетает молния и летит к должнику, и только
   * когда она долетит — его карточка вздрагивает и получает «Pinged 👀».
   * Поэтому статус ставится не здесь, а в onDone у полёта: иначе аватар
   * дёргался бы раньше, чем до него что-то долетело.
   */
  const ping = async (m: { contactId: string; memberId?: string }, from?: { x: number; y: number } | null) => {
    const target = m.memberId ?? m.contactId;
    /*
      Кнопка гасла только когда молния долетала — за эти полсекунды успевали
      нажать второй раз, и второй запрос упирался в троттлинг сервера: два
      «отправлено» подряд и следом «попробуйте позже». Гасим сразу.
    */
    if (pinged.has(m.contactId)) return;
    setPinged((prev) => new Set([...prev, m.contactId]));
    setBoltFrom(from ?? null);
    setBoltTo(target);
    setBoltContact(m.contactId);
    cue('reminder');
    try {
      await remindMember(id, target);
    } catch (e) {
      setBoltTo(null);
      setPinged((prev) => {
        const next = new Set(prev);
        next.delete(m.contactId);
        return next;
      });
      toast(e instanceof Error ? e.message : t('debts.alreadyReminded'));
    }
  };

  /** Молния долетела: аватар вздрагивает, сверху приезжает плашка. */
  const onBoltLanded = () => {
    const contactId = boltContact;
    if (!contactId) return;
    setShakeId(contactId);
    setTimeout(() => setShakeId(null), 700);
    // живая фраза вместо «напоминание отправлено» (vision §B4)
    const m = members.find((x) => x.contactId === contactId);
    setPingToast({
      title: t('live.pingToast', { name: nameOf(contactId).split(' ')[0] }),
      line: reminderLine(contactId, pinged.size, {
        name: nameOf(contactId),
        amount: money(m?.amount ?? 0),
      }),
    });
  };

  const react = async (memberId: string, emoji: string) => {
    if (!myUserId) return;
    const mine = reactions.find((r) => r.memberId === memberId && r.fromUserId === myUserId);
    const next = reactions.filter((r) => !(r.memberId === memberId && r.fromUserId === myUserId));
    if (mine?.emoji !== emoji) {
      next.push({ memberId, emoji, fromUserId: myUserId, fromName: (home.db?.user?.name ?? '').split(' ')[0] ?? '' });
    }
    setOptimistic(next);
    if (mine?.emoji !== emoji) setBurst({ emoji });
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
    const target = coverFor;
    setCoverFor(null);
    if (!target) return;
    if (covering.current) return;
    covering.current = true;
    setCovering(true);
    try {
      await coverRemainder(id, [target.memberId]);
      cue('paid');
      // стикер успеха: если этим действием счёт закрылся полностью, его
      // место займёт празднование «все оплатили» — два подряд не нужны
      if (target.amount < remainder) setCoverBurst(true);
      await refetch();
      await qc.invalidateQueries({ queryKey: qk.bootstrap });
    } finally {
      covering.current = false;
      setCovering(false);
    }
  };

  if (!split) {
    return (
      <Screen style={styles.root} background={colors.dune2}>
        <ScreenHeader onBack={() => nav.popTo('Tabs')} />
        <View style={styles.loading}>
          <ZapLoader label={t('bill.loading')} />
        </View>
      </Screen>
    );
  }

  // тема заведения — стикер в углу чека (vision §5)
  const theme = themeForMerchant(merchant?.name ?? split.title);

  const allPaid = paidMembers.length === members.length && members.length > 0;
  const unpaid = members.filter((m) => m.status !== 'paid' && m.status !== 'debt');

  /*
    Колонка лица: 90 pt из макета, но при четверых и более ряд шире экрана —
    ужимаем до 72, дальше в дело вступает горизонтальный скролл.
  */
  const faceW = Math.max(72, Math.min(90, (width - SCREEN_PAD_X * 2 - 14 * (members.length - 1)) / Math.max(1, members.length)));

  return (
    <BillStageProvider value={stage}>
      {/* фон #F1EFE9 из макета: лаймом подсвечен только чип процента */}
      <Screen style={styles.root} background={colors.dune2} darkBar={false}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/*
            Шапка spec/11: круглая «назад», название по центру и лаймовый чип
            процента. Подзаголовок в макете есть только у закрытого счёта
            (spec/12) — там он несёт «Все оплатили. Красиво. ⚡».
          */}
          <View style={styles.titleRow}>
            <PressableScale
              small
              style={[styles.round, { backgroundColor: colors.cream }]}
              onPress={() => nav.popTo('Tabs')}
            >
              <BackIcon size={20} color={colors.ink} />
            </PressableScale>

            <View style={styles.titleBody}>
              {/* тап по названию — меню счёта: переименовать и поделиться */}
              <PressableScale haptic={false} onPress={() => setMenuOpen(true)}>
                <Text style={[styles.titleText, { color: colors.ink }]} numberOfLines={1}>{split.title}</Text>
              </PressableScale>
              {allPaid ? (
                <Text style={[styles.titleSub, { color: colors.muted }]} numberOfLines={1}>
                  {t('live.paidOfCount', { paid: paidMembers.length, total: members.length })}
                  {' · '}
                  {t('live.allPaidHeadline')}
                </Text>
              ) : null}
            </View>

            <View style={[styles.pct, { backgroundColor: fixed.lime }]}>
              <Text style={[styles.pctText, { color: fixed.ink }]}>
                {Math.round((paidMembers.length / Math.max(1, members.length)) * 100)}%
              </Text>
            </View>
          </View>

          {/*
            Ряд лиц. В макете колонка 90 pt и трое участников; вчетвером ряд
            уже не влезает — колонка ужимается, а если и этого мало (пятеро и
            больше), ряд едет горизонтально, а не обрезается краем экрана.
          */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.faces}
          >
            {members.map((m, i) => {
              const memberId = (m as { memberId?: string }).memberId ?? m.contactId;
              const paid = ringsLit && (m.status === 'paid' || m.status === 'debt');
              const mine = reactions.find((r) => r.memberId === memberId && r.fromUserId === myUserId)?.emoji;
              return (
                <MemberFace
                  key={memberId + i}
                  memberId={memberId}
                  contactId={m.isYou ? 'me' : m.contactId}
                  name={m.isYou ? t('members.youShort') : (nameOf(m.contactId).split(' ')[0] ?? '?')}
                  initials={home.contactById(m.contactId)?.initials}
                  color={colorOf(m.contactId)}
                  paid={paid}
                  reaction={mine}
                  shake={shakeId === m.contactId}
                  sub={
                    paid
                      ? m.status === 'debt'
                        ? t('live.debtCoveredShort')
                        : m.isYou
                          ? t('live.youZapped')
                          : t('live.zapped', { name: nameOf(m.contactId).split(' ')[0] })
                      : money(m.amount)
                  }
                  onReact={(a) => setReactFor({ memberId, ...a })}
                  width={faceW}
                />
              );
            })}
          </ScrollView>

          {/* чек: сумма, оплатившие и итог — узел для Split the Bill */}
          <View style={styles.receiptWrap}>
            <LiveReceipt
              merchantName={merchant?.name ?? split.title}
              orderLine={split.bill ? t('live.orderNo', { no: split.bill.orderNo }).trim() : undefined}
              sticker={theme?.sticker ? STICKER[theme.sticker] : undefined}
              paidAmount={paidAmount}
              total={split.total}
              membersCount={members.length}
              rows={paidMembers.map((m) => {
                const memberId = (m as { memberId?: string }).memberId ?? m.contactId;
                return {
                  key: memberId,
                  contactId: m.isYou ? 'me' : m.contactId,
                  name: m.isYou ? `${nameOf(m.contactId)}${t('live.youSuffix')}` : nameOf(m.contactId),
                  initials: home.contactById(m.contactId)?.initials,
                  color: colorOf(m.contactId),
                  sub:
                    m.status === 'debt'
                      ? t('live.debtCoveredShort')
                      : m.isYou
                        ? t('live.youZapped')
                        : t('live.zapped', { name: nameOf(m.contactId).split(' ')[0] }),
                  amount: m.amount,
                  fresh: fresh.has(memberId),
                };
              })}
              onPressTitle={() => {
                setRenameValue(split.title);
                setRenameOpen(true);
              }}
            />
            {/* низ чека: зубцы, если кто-то ещё должен, иначе ровный край */}
            {unpaid.length ? (
              <TornEdge color={colors.paper} side="bottom" width={width - SCREEN_PAD_X * 2} />
            ) : (
              <View style={[styles.receiptFoot, { backgroundColor: colors.paper }]} />
            )}
          </View>

          {/* корешки тех, кто ещё не оплатил */}
          {unpaid.map((m, i) => (
            <UnpaidStub
              key={(m as { memberId?: string }).memberId ?? m.contactId}
              index={i}
              justSplit
              delay={justCreated ? 950 : 0}
              contactId={m.isYou ? 'me' : m.contactId}
              name={nameOf(m.contactId)}
              initials={home.contactById(m.contactId)?.initials}
              color={colorOf(m.contactId)}
              amount={m.amount}
              width={width - SCREEN_PAD_X * 2}
              last={i === unpaid.length - 1}
              mine={m.isYou}
              pinged={pinged.has(m.contactId)}
              onLend={() => {
                if (m.isYou) {
                  nav.navigate('Participant', { code: split.code });
                  return;
                }
                setCoverFor({ memberId: (m as { memberId?: string }).memberId ?? m.contactId, amount: m.amount });
              }}
              onPing={(pt) =>
                void ping({ contactId: m.contactId, memberId: (m as { memberId?: string }).memberId }, pt)
              }
            />
          ))}

          <View style={styles.spacer} />

          {/*
            Photo Moment (vision §C15) — в макете это единственная кнопка внизу
            экрана: пунктирная «Добавить фото 📸».
          */}
          {members.length > 1 ? (
            split.photoUrl ? (
              <Image source={{ uri: split.photoUrl }} style={styles.moment} resizeMode="cover" />
            ) : (
              <PressableScale
                style={[styles.addPhoto, { borderColor: colors.hairline }]}
                onPress={() => nav.navigate('PhotoMoment', { id })}
              >
                <Text style={[styles.addPhotoText, { color: colors.ink }]}>{t('photoMoment.add')}</Text>
              </PressableScale>
            )
          ) : null}
        </ScrollView>

        {/*
          Меню счёта. Кнопки «поделиться» в шапке нет — в макете там только
          «назад», название и процент; действия живут за тапом по названию.
        */}
        <BottomSheet open={menuOpen} onClose={() => setMenuOpen(false)}>
          <Text style={[styles.sheetTitle, { color: colors.ink }]} numberOfLines={1}>{split.title}</Text>
          <PressableScale
            style={[styles.menuRow, { backgroundColor: colors.sand }]}
            onPress={() => {
              setMenuOpen(false);
              setRenameValue(split.title);
              setRenameOpen(true);
            }}
          >
            <Text style={styles.menuGlyph}>✏️</Text>
            <Text style={[styles.menuText, { color: colors.ink }]}>{t('live.renameTitle')}</Text>
          </PressableScale>
          <PressableScale
            style={[styles.menuRow, { backgroundColor: colors.sand }]}
            onPress={() => {
              setMenuOpen(false);
              void doShare();
            }}
          >
            <Text style={styles.menuGlyph}>↗</Text>
            <Text style={[styles.menuText, { color: colors.ink }]}>{t('live.shareAction')}</Text>
          </PressableScale>
        </BottomSheet>

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
          open={!!coverFor}
          hint={t('live.pinHint', { amount: money(coverFor?.amount ?? 0) })}
          onClose={() => setCoverFor(null)}
          onConfirm={() => void confirmCover()}
        />
        <ZapOverlay open={isCovering} steps={PAY_STEPS} stickers={PAY_STICKERS} />
        {/* доля закрыта — стикер вспыхивает и уходит сам */}
        <StickerBurst run={coverBurst} sticker="handsHeart" onDone={() => setCoverBurst(false)} />
        {/*
          Слой сцены во всё окно: measure() отдаёт оконные координаты, а
          содержимое экрана лежит внутри safe-area и полей по 15 — без этого
          слоя молния и палитра приземлялись бы со сдвигом.
        */}
        <Animated.View
          ref={layerRef}
          onLayout={() =>
            layerRef.current?.measureInWindow((x, y) => setLayerAt({ x, y }))
          }
          style={[
            styles.stageLayer,
            { left: -SCREEN_PAD_X, right: -SCREEN_PAD_X, top: -insets.top, bottom: -insets.bottom },
          ]}
          pointerEvents="box-none"
        >
          {/* палитра реакций: всплывает под кружком «+», контент не двигается */}
          {reactFor ? (
            <>
              <Pressable style={styles.backdrop} onPress={() => setReactFor(null)} />
              <View
                style={[
                  styles.pickerFloat,
                  {
                    left: Math.max(
                      12,
                      Math.min(
                        reactFor.x + reactFor.width / 2 - PICKER_W / 2 - layerAt.x,
                        width - PICKER_W - 12,
                      ),
                    ),
                    // если снизу не хватает места — раскрываем вверх
                    top: Math.min(
                      reactFor.y + reactFor.height + 10 - layerAt.y,
                      height - PICKER_H - 24,
                    ),
                  },
                ]}
              >
                <ReactionPicker
                  current={
                    reactions.find((r) => r.memberId === reactFor.memberId && r.fromUserId === myUserId)?.emoji
                  }
                  onPick={(e) => {
                    void react(reactFor.memberId, e);
                    setReactFor(null);
                  }}
                />
              </View>
            </>
          ) : null}

          {/* реакция во весь экран: большой эмодзи и облако значков */}
          <ReactionBurst emoji={burst?.emoji ?? null} onDone={() => setBurst(null)} />

          {/* ⚡ летит из кнопки в аватар: полёт, вспышка и удар сверху */}
          <PingStrike
            toMemberId={boltTo}
            layer={layerRef}
            from={boltFrom}
            onHit={onBoltLanded}
            onDone={() => setBoltTo(null)}
          />
          <PingToast
            title={pingToast?.title ?? null}
            line={pingToast?.line ?? ''}
            top={insets.top + 8 - layerAt.y}
            onDone={() => setPingToast(null)}
          />

          {/* 🎉 все закрыли счёт — конфетти сыплется прямо на экран сплита */}
          <Confetti run={celebrate} />
        </Animated.View>

        {/* карточка для сторис — то, что расходится органически */}
        <ShareCardSheet
          open={cardOpen}
          onClose={() => setCardOpen(false)}
          title={split.title}
          total={split.total}
          code={split.code}
          merchantLogo={merchantLogo(merchantName) ?? undefined}
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
  scroll: { paddingBottom: 12, flexGrow: 1 },
  loading: { marginTop: 48, alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 },
  round: { width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, zIndex: 40 },
  pickerFloat: { position: 'absolute', zIndex: 41 },
  stageLayer: { position: 'absolute', zIndex: 40 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 56,
    borderRadius: 18,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  menuGlyph: { fontSize: 17 },
  menuText: { fontFamily: font.bold, fontSize: 15 },
  receiptWrap: { marginTop: 30 },
  receiptFoot: { height: 14, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 },
  addPhotoText: { fontFamily: font.bold, fontSize: 14 },
  titleBody: { flex: 1, minWidth: 0, alignItems: 'center' },
  titleText: { fontFamily: font.extrabold, fontSize: 19 },
  titleSub: { fontFamily: font.semibold, fontSize: 11, marginTop: 2 },
  faces: { flexGrow: 1, justifyContent: 'center', gap: 14, marginTop: 30 },
  reactBar: { alignItems: 'center', marginTop: 14 },
  reactPill: { flexDirection: 'row', gap: 6, borderRadius: 22, paddingVertical: 6, paddingHorizontal: 8 },
  reactCell: { width: 34, height: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  reactGlyph: { fontSize: 18 },
  pct: { height: 30, minWidth: 52, paddingHorizontal: 10, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pctText: { fontFamily: font.extrabold, fontSize: 13 },
  center: { alignSelf: 'center', width: 1, height: 1 },
  spacer: { flexGrow: 1, minHeight: 18 },
  moment: { height: 190, borderRadius: 24, marginTop: 24, backgroundColor: 'rgba(18,18,18,0.06)' },
  addPhoto: {
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  sheetTitle: { fontFamily: font.extrabold, fontSize: 15, textAlign: 'center', marginBottom: 12 },
  renameInput: { fontFamily: font.bold, fontSize: 18, borderBottomWidth: 2, paddingBottom: 10, padding: 0 },
  sheetBtn: { height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  sheetBtnText: { fontFamily: font.bold, fontSize: 15 },
});
