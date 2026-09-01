// «С кем делим» — порт web/src/pages/MembersPage.vue один в один:
// три режима (поровну / вручную через шит / по позициям), «в долг» тапом
// по сумме, быстрые контакты + поиск + «+ Номер», поиск пользователей ZAP!
// по @username, кэшбэк-чип под CTA.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, Keyframe, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { ZapOverlay } from '@/components/ZapOverlay';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PressableScale } from '@/components/PressableScale';
import { Avatar } from '@/components/Avatar';
import { BottomSheet } from '@/components/BottomSheet';
import { PinSheet } from '@/components/PinSheet';
import Svg, { Defs, LinearGradient, Stop, Rect as SvgRect } from 'react-native-svg';
import { SearchIcon } from '@/components/icons';
import { toast } from '@/components/ToastHost';
import { useHomeData } from '@/store/bootstrap';
import { reduceMotion } from '@/lib/feedback';
import { themeForMerchant } from '@/lib/merchantTheme';
import { keyboardLift, useKeyboardHeight } from '@/lib/keyboard';
import { useDraft, sharesOf, unassignedItemsOf } from '@/store/draft';
import { createSplit } from '@/api/splits';
import { searchUsers, addContact, type UserSearchResult } from '@/api/actions';
import { qk } from '@/api/data';
import { money } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { SCREEN_PAD_X, font } from '@/theme/tokens';
import type { SplitMode } from '@zap/shared/types';

const ME = 'me';
const MODES: { value: SplitMode; label: string }[] = [
  { value: 'equal', label: 'members.modeEqual' },
  { value: 'manual', label: 'members.modeManual' },
  { value: 'items', label: 'members.modeItems' },
];

/**
 * «Друг влетает в компанию» (vision, часть A, «👤 Friend Added»).
 *
 * Не появление строки списка, а именно прилёт сбоку: scale 0.2 -> 1.08 -> 1
 * с поворотом -8° -> 0°. Применяется ТОЛЬКО к тем, кого добавили только что:
 * на первом показе экрана все участники уже «в компании», и прилетать им
 * неоткуда — там остаётся спокойное появление снизу.
 */
const JOIN = new Keyframe({
  0: { opacity: 0, transform: [{ translateX: 52 }, { scale: 0.2 }, { rotate: '-8deg' }] },
  55: { opacity: 1, transform: [{ translateX: 0 }, { scale: 1.08 }, { rotate: '2deg' }] },
  100: { opacity: 1, transform: [{ translateX: 0 }, { scale: 1 }, { rotate: '0deg' }] },
}).duration(430);

/** Подписи ожидания при создании сплита — крутятся по кругу. */
const CREATE_STEPS = ['loading.splitting1', 'loading.splitting2', 'loading.splitting3'] as const;

/** Пока ждём сервер — показываем, ради чего всё это. */
const CREATE_STICKERS = ['oneBill', 'howItWorks', 'receiptHero'] as const;

export function MembersScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const nav = useNavigation<any>();
  const qc = useQueryClient();
  const home = useHomeData();

  const draft = useDraft();
  const [contactsOpen, setContactsOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // как в вебе: без суммы делить нечего — назад к скану
  // Сторож срабатывает ТОЛЬКО при входе на экран.
  //
  // Раньше он висел на изменении черновика, и любое обновление стора уже
  // ПОСЛЕ успешного распознавания выбрасывало обратно в камеру: человек видел
  // «чек распознан», а оказывался снова перед сканером. Нет данных на входе —
  // уходим; всё, что меняется дальше, экран разруливает сам.
  useEffect(() => {
    if (draft.total <= 0) nav.replace('Scan');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modes = useMemo(() => MODES.filter((m) => m.value !== 'items' || draft.bill), [draft.bill]);

  const shares = useMemo(
    () => sharesOf({ mode: draft.mode, total: draft.total, members: draft.members, bill: draft.bill }),
    [draft.mode, draft.total, draft.members, draft.bill],
  );
  const sharesSum = useMemo(() => Object.values(shares).reduce((s, v) => s + v, 0), [shares]);
  const unassigned = unassignedItemsOf({ mode: draft.mode, members: draft.members, bill: draft.bill });
  const myShare = shares[ME] ?? 0;
  const payNow = draft.members
    .filter((m) => m.contactId === ME || m.debt)
    .reduce((s, m) => s + (shares[m.contactId] ?? 0), 0);

  const isValid =
    draft.members.length >= 2 &&
    draft.total > 0 &&
    (draft.mode !== 'manual' || sharesSum === draft.total) &&
    (draft.mode !== 'items' || unassigned === 0);

  // сообщение валидации под полем «За что» — как в вебе
  const validationMessage =
    draft.mode === 'manual' && sharesSum !== draft.total
      ? draft.total - sharesSum > 0
        ? t('members.sumMismatch', { amount: money(draft.total - sharesSum) })
        : t('members.sumOver', { amount: money(sharesSum - draft.total) })
      : draft.mode === 'items' && unassigned > 0
        ? t('members.itemsUnassigned', { n: unassigned })
        : '';

  const nameOf = (id: string) => (id === ME ? (home.db?.user?.name || t('members.youShort')) : (home.contactById(id)?.name ?? '?'));
  const colorOf = (id: string) => (id === ME ? '#111110' : (home.contactById(id)?.color ?? '#8A887E'));
  const subOf = (id: string, debt?: boolean) => {
    if (id === ME) return t('members.youPayNow');
    if (debt) return t('members.debtNote');
    const handle = home.contactById(id)?.handle;
    return handle ? t('members.viaSmsWithHandle', { handle }) : t('members.viaSms');
  };

  const chosen = new Set(draft.members.map((m) => m.contactId));

  // кто был в списке на прошлом рендере — остальные «влетают»
  const seen = useRef<Set<string> | null>(null);
  const justJoined = useMemo(() => {
    const now = new Set(draft.members.map((m) => m.contactId));
    const prev = seen.current;
    seen.current = now;
    if (!prev) return new Set<string>(); // первый показ — никто не «прилетал»
    return new Set([...now].filter((idc) => !prev.has(idc)));
  }, [draft.members]);

  const notAdded = (home.db?.contacts ?? []).filter((c) => !chosen.has(c.id));

  // зарезервированный кэшбэк уменьшает «вашу долю»
  const pendingCashback = Math.min(home.db?.settings?.pendingCashback ?? 0, myShare);
  const merchant = (home.db?.merchants ?? []).find((m) => m.id === draft.merchantId);

  // редактирование доли (режим «Вручную») — через шит, как в вебе
  const [editing, setEditing] = useState<string | null>(null);
  const [editRaw, setEditRaw] = useState('');
  const onAmountTap = (contactId: string) => {
    if (draft.mode === 'manual') {
      setEditing(contactId);
      setEditRaw(String(shares[contactId] ?? 0));
      return;
    }
    if (contactId !== ME) draft.toggleDebt(contactId);
  };
  const commitEdit = () => {
    if (editing) draft.setMemberAmount(editing, Number(editRaw || '0'));
    setEditing(null);
  };

  // поиск: локальные контакты + пользователи ZAP! по @username
  const [contactSearch, setContactSearch] = useState('');
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchSeq = useRef(0);
  useEffect(() => {
    const q = contactSearch.trim();
    if (q.length < 2) {
      setUserResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const seq = ++searchSeq.current;
    const id = setTimeout(async () => {
      try {
        const res = await searchUsers(q);
        if (seq !== searchSeq.current) return;
        const known = new Set((home.db?.contacts ?? []).map((c) => (c.phone ?? '').replace(/\D/g, '').slice(-9)));
        setUserResults(res.filter((u) => !known.has(u.phone.replace(/\D/g, '').slice(-9))));
      } catch {
        if (seq === searchSeq.current) setUserResults([]);
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(id);
  }, [contactSearch, home.db?.contacts]);

  const filteredContacts = useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    const all = home.db?.contacts ?? [];
    return q ? all.filter((c) => c.name.toLowerCase().includes(q)) : all;
  }, [contactSearch, home.db?.contacts]);

  const addFoundUser = async (u: UserSearchResult) => {
    try {
      const c = await addContact(u.phone.replace(/\D/g, '').slice(-9), u.name);
      await qc.invalidateQueries({ queryKey: qk.bootstrap });
      draft.toggleMember(c.id);
      setUserResults((prev) => prev.filter((x) => x.id !== u.id));
      setContactSearch('');
    } catch (e) {
      toast(e instanceof Error ? e.message : t('errors.generic'));
    }
  };

  // «+ Номер»
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phoneDigits, setPhoneDigits] = useState('');
  const [phoneName, setPhoneName] = useState('');
  const phoneMask = (d: string) => [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ');
  const addByPhone = async () => {
    if (phoneDigits.length !== 9 || phoneName.trim().length < 2) return;
    try {
      const c = await addContact(phoneDigits, phoneName);
      await qc.invalidateQueries({ queryKey: qk.bootstrap });
      draft.toggleMember(c.id);
      setPhoneOpen(false);
      setPhoneDigits('');
      setPhoneName('');
    } catch (e) {
      toast(e instanceof Error ? e.message : t('errors.generic'));
    }
  };

  const creating = useRef(false);
  const submit = async () => {
    // setBusy асинхронный — от повторного тапа спасает только ref
    if (creating.current) return;
    creating.current = true;
    setBusy(true);
    try {
      const split = await createSplit(
        {
          total: draft.total,
          // тема заведения подсказывает имя вечера («🍕 Ужин»); пользователь
          // всё равно может переименовать — это только предзаполнение
          title:
            draft.title.trim() ||
            (themeForMerchant(draft.fiscal?.merchant ?? merchant?.name)?.titleKey
              ? t(themeForMerchant(draft.fiscal?.merchant ?? merchant?.name)!.titleKey)
              : draft.bill
                ? t('members.forWhatPlaceholder')
                : t('members.defaultTitle')),
          mode: draft.mode,
          merchantId: draft.merchantId,
          billId: (draft.bill as (typeof draft.bill & { billId?: string }) | null)?.billId,
          members: draft.members.map((m) => ({
            contactId: m.contactId,
            amount: shares[m.contactId] ?? 0,
            debt: !!m.debt,
            itemIds: draft.mode === 'items' ? m.itemIds : undefined,
          })),
        },
        home.db?.contacts ?? [],
      );
      await qc.invalidateQueries({ queryKey: qk.bootstrap });
      if (split.status === 'closed') nav.replace('SplitClosed', { id: split.id });
      else nav.replace('Share', { id: split.id });
      draft.reset();
    } catch (e) {
      // ошибка создания не должна умирать молча
      toast(e instanceof Error && e.message ? e.message : t('errors.generic'));
    } finally {
      creating.current = false;
      setBusy(false);
    }
  };

  return (
    <Screen style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardDismissMode="interactive" contentContainerStyle={{ paddingBottom: insets.bottom + 210 }}>
        <ScreenHeader onBack={() => nav.goBack()} />

        <Text style={[styles.title, { color: colors.ink }]}>{t('members.title')}</Text>

        <View style={styles.totalRow}>
          <Text style={[styles.total, { color: colors.ink }]} numberOfLines={1} adjustsFontSizeToFit>
            {money(draft.total)}
          </Text>
          <Text style={[styles.currency, { color: colors.faint2 }]}>UZS</Text>
        </View>

        <View style={[styles.forWhat, { borderBottomColor: colors.lime }]}>
          <Text style={[styles.forWhatLabel, { color: colors.muted }]}>{t('members.forWhat')}</Text>
          <TextInput
            value={draft.title}
            onChangeText={draft.setTitle}
            placeholder={t('members.forWhatPlaceholder')}
            placeholderTextColor={colors.faint}
            cursorColor={colors.lime}
            style={[styles.forWhatInput, { color: colors.ink }]}
          />
        </View>

        {draft.mode === 'equal' ? (
          <Text style={[styles.perPerson, { color: colors.faint }]}>
            {t('members.perPerson', { amount: money(myShare) })}
          </Text>
        ) : validationMessage ? (
          <Text style={[styles.perPerson, { color: colors.danger }]}>{validationMessage}</Text>
        ) : null}

        <View style={styles.modeRow}>
          {modes.map((m) => {
            const active = draft.mode === m.value;
            return (
              <PressableScale
                key={m.value}
                style={[styles.mode, { backgroundColor: active ? colors.lime : colors.sand }]}
                onPress={() => draft.setMode(m.value)}
              >
                <Text style={[active ? styles.modeTextActive : styles.modeText, { color: active ? colors.onLime : colors.slate }]}>
                  {t(m.label)}
                </Text>
              </PressableScale>
            );
          })}
        </View>

        {/* участники */}
        <View style={styles.list}>
          {draft.members.map((m, i) => (
            <Animated.View
              key={m.contactId}
              entering={
                reduceMotion()
                  ? undefined
                  : justJoined.has(m.contactId)
                    ? JOIN
                    : FadeInDown.delay(Math.min(i, 8) * 40)
              }
              layout={LinearTransition.springify()}
            >
              <View style={styles.memberRow}>
                <PressableScale small disabled={m.contactId === ME} onPress={() => draft.toggleMember(m.contactId)}>
                  <Avatar
                    name={nameOf(m.contactId)}
                    letter={home.contactById(m.contactId)?.initials}
                    contactId={m.contactId}
                    color={colorOf(m.contactId)}
                    size={48}
                    dim={m.debt}
                  />
                </PressableScale>
                <View style={styles.memberBody}>
                  <Text style={[styles.memberName, { color: colors.ink }]} numberOfLines={1}>
                    {nameOf(m.contactId)}
                    {m.contactId === ME ? t('members.youSuffix') : ''}
                  </Text>
                  <Text style={[styles.memberSub, { color: colors.faint }]} numberOfLines={1}>
                    {subOf(m.contactId, m.debt)}
                  </Text>
                </View>
                <PressableScale small onPress={() => onAmountTap(m.contactId)}>
                  {m.debt ? (
                    <View style={[styles.debtChip, { backgroundColor: colors.ink }]}>
                      <Text style={[styles.debtChipText, { color: colors.lime }]}>{t('members.debtToggle')}</Text>
                    </View>
                  ) : (
                    <Text
                      style={[
                        styles.memberAmount,
                        { color: colors.ink },
                        draft.mode === 'manual' && { backgroundColor: colors.sand, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
                      ]}
                    >
                      {money(shares[m.contactId] ?? 0)}
                    </Text>
                  )}
                </PressableScale>
              </View>
            </Animated.View>
          ))}
        </View>

        {/* позиции чека (режим «По позициям») */}
        {draft.mode === 'items' && draft.bill ? (
          <View style={styles.items}>
            {draft.bill.items.map((item) => (
              <View key={item.id} style={[styles.item, { borderBottomColor: colors.sand2 }]}>
                <View style={styles.itemHead}>
                  <Text style={[styles.itemTitle, { color: colors.ink }]} numberOfLines={1}>
                    {item.title}
                    {item.qty > 1 ? ` ×${item.qty}` : ''}
                  </Text>
                  <Text style={[styles.itemAmount, { color: colors.ink }]}>{money(item.amount)}</Text>
                </View>
                <View style={styles.itemChips}>
                  {draft.members.map((m) => {
                    const on = (m.itemIds ?? []).includes(item.id);
                    return (
                      <PressableScale
                        key={m.contactId}
                        small
                        style={[styles.itemChip, { backgroundColor: on ? colors.ink : colors.sand }]}
                        onPress={() => draft.toggleItem(m.contactId, item.id)}
                      >
                        <Avatar
                          name={nameOf(m.contactId)}
                          letter={home.contactById(m.contactId)?.initials}
                          contactId={m.contactId}
                          color={colorOf(m.contactId)}
                          size={24}
                        />
                        <Text style={[styles.itemChipText, { color: on ? colors.paper : colors.muted }]}>
                          {m.contactId === ME ? t('members.youShort') : nameOf(m.contactId)}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* добавить */}
        <View style={styles.addHead}>
          <Text style={[styles.addLabel, { color: colors.faint2 }]}>{t('members.addContacts')}</Text>
          <PressableScale onPress={() => setContactsOpen(true)}>
            <Text style={[styles.allContacts, { color: colors.muted }]}>{t('members.allContacts')}</Text>
          </PressableScale>
        </View>

        <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={68}
          decelerationRate="fast"
          snapToAlignment="start"
          style={styles.quickScroll}
          contentContainerStyle={styles.quickRow}
        >
          {notAdded.map((c) => (
            <PressableScale key={c.id} style={styles.quick} onPress={() => draft.toggleMember(c.id)}>
              <View>
                <Avatar name={c.name} letter={c.initials} contactId={c.id} color={c.color} size={52} />
                <View style={[styles.plusBadge, { borderColor: colors.paper, backgroundColor: colors.lime }]}>
                  <Text style={[styles.plusBadgeText, { color: colors.onLime }]}>+</Text>
                </View>
              </View>
              <Text style={[styles.quickName, { color: colors.ink }]} numberOfLines={1}>{c.name}</Text>
            </PressableScale>
          ))}
          <PressableScale style={styles.quick} onPress={() => setContactsOpen(true)}>
            <View style={[styles.quickCircle, { backgroundColor: colors.sand }]}>
              <SearchIcon size={20} color="#A3A199" />
            </View>
            <Text style={[styles.quickName, { color: colors.faint2 }]}>{t('members.findLabel')}</Text>
          </PressableScale>
          <PressableScale style={styles.quick} onPress={() => setPhoneOpen(true)}>
            <View style={[styles.quickCircle, { backgroundColor: colors.sand }]}>
              <Text style={[styles.quickPlus, { color: colors.faint2 }]}>+</Text>
            </View>
            <Text style={[styles.quickName, { color: colors.faint2 }]}>{t('members.numberLabel')}</Text>
          </PressableScale>
        </ScrollView>
        </View>
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: kb > 0 ? keyboardLift(kb, insets.bottom) + 12 : insets.bottom + 10 }]}>
        {/* контент уходит под кнопку: сверху мягкий градиент, ниже — плотный
            фон страницы, чтобы список не обрывался «ножом» */}
        <Svg style={styles.ctaFade} width="100%" height={28} pointerEvents="none">
          <Defs>
            <LinearGradient id="ctaFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.paper} stopOpacity={0} />
              <Stop offset="1" stopColor={colors.paper} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <SvgRect x={0} y={0} width="100%" height={28} fill="url(#ctaFade)" />
        </Svg>
        <View style={[styles.ctaFill, { backgroundColor: colors.paper }]} pointerEvents="none" />
        <PressableScale
          disabled={!isValid || busy}
          style={[styles.ctaBtn, { backgroundColor: colors.lime }, (!isValid || busy) && styles.disabled]}
          onPress={() => setPinOpen(true)}
        >
          <Text style={[styles.ctaText, { color: colors.onLime }]}>{t('members.ctaSplit', { amount: money(payNow) })}</Text>
        </PressableScale>
        <Text style={[styles.ctaSub, { color: colors.muted }]}>
          {(() => {
            const debtor = draft.members.find((m) => m.debt);
            if (!debtor) return t('members.ctaSub', { mine: money(myShare) });
            return t('members.ctaSubDebt', {
              mine: money(myShare),
              name: nameOf(debtor.contactId),
              amount: money(shares[debtor.contactId] ?? 0),
            });
          })()}
        </Text>
        {pendingCashback > 0 ? (
          <View style={styles.cashbackRow}>
            <View style={[styles.cashbackChip, { backgroundColor: colors.lime }]}>
              <Text style={[styles.cashbackChipText, { color: colors.onLime }]}>
                {t('members.cashbackChip', { amount: money(pendingCashback) })}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* редактирование доли (режим «Вручную») */}
      <BottomSheet open={editing !== null} onClose={commitEdit}>
        <Text style={[styles.sheetTitle, { color: colors.ink }]}>{editing ? nameOf(editing) : ''}</Text>
        <TextInput
          value={editRaw ? money(Number(editRaw)) : ''}
          onChangeText={(v) => setEditRaw(v.replace(/\D/g, ''))}
          keyboardType="number-pad"
          autoFocus
          placeholder="0"
          placeholderTextColor={colors.faint}
          cursorColor={colors.lime}
          style={[styles.editInput, { color: colors.ink }]}
        />
        <Text style={[styles.editCurrency, { color: colors.faint2 }]}>UZS</Text>
        <PressableScale style={[styles.sheetBtn, { backgroundColor: colors.ink }]} onPress={commitEdit}>
          <Text style={[styles.sheetBtnText, { color: colors.paper }]}>{t('common.done')}</Text>
        </PressableScale>
      </BottomSheet>

      {/* все контакты */}
      <BottomSheet open={contactsOpen} onClose={() => setContactsOpen(false)}>
        <Text style={[styles.sheetTitle, { color: colors.ink }]}>{t('members.contactsTitle')}</Text>
        <View style={[styles.searchField, { backgroundColor: colors.sand }]}>
          <SearchIcon size={16} color="#A3A199" />
          <TextInput
            value={contactSearch}
            onChangeText={setContactSearch}
            placeholder={t('members.contactsSearch')}
            placeholderTextColor={colors.faint}
            autoCapitalize="none"
            autoComplete="off"
            cursorColor={colors.lime}
            style={[styles.searchInput, { color: colors.ink }]}
          />
        </View>
        <ScrollView style={styles.sheetList} keyboardShouldPersistTaps="handled">
          {contactSearch.trim().length >= 2 ? (
            searching ? (
              <Text style={[styles.sheetInfo, { color: colors.muted }]}>{t('members.searching')}</Text>
            ) : userResults.length ? (
              <>
                <Text style={[styles.sheetSection, { color: colors.faint2 }]}>{t('members.zapUsers')}</Text>
                {userResults.map((u) => (
                  <View key={u.id} style={[styles.sheetRow, { borderBottomColor: colors.sand2 }]}>
                    <Avatar name={u.name} letter={u.initials} contactId={u.id} color={u.color} size={40} />
                    <View style={styles.sheetRowBody}>
                      <Text style={[styles.sheetName, { color: colors.ink }]} numberOfLines={1}>{u.name}</Text>
                      <Text style={[styles.sheetHandle, { color: colors.muted }]}>{u.handle}</Text>
                    </View>
                    <PressableScale small style={[styles.sheetAdd, { backgroundColor: colors.lime }]} onPress={() => void addFoundUser(u)}>
                      <Text style={[styles.sheetAddTextStrong, { color: colors.onLime }]}>{t('members.addAction')}</Text>
                    </PressableScale>
                  </View>
                ))}
              </>
            ) : !filteredContacts.length ? (
              <Text style={[styles.sheetInfo, { color: colors.muted }]}>{t('members.nothingFound')}</Text>
            ) : null
          ) : null}
          {filteredContacts.map((c) => {
            const added = chosen.has(c.id);
            return (
              <View key={c.id} style={[styles.sheetRow, { borderBottomColor: colors.sand2 }]}>
                <Avatar name={c.name} letter={c.initials} contactId={c.id} color={c.color} size={40} />
                <View style={styles.sheetRowBody}>
                  <Text style={[styles.sheetName, { color: colors.ink }]} numberOfLines={1}>{c.name}</Text>
                  <Text style={[styles.sheetHandle, { color: colors.muted }]}>{c.handle ?? ''}</Text>
                </View>
                <PressableScale
                  small
                  style={[styles.sheetAdd, { backgroundColor: added ? colors.sand : colors.ink }]}
                  onPress={() => draft.toggleMember(c.id)}
                >
                  <Text style={[styles.sheetAddText, { color: added ? colors.muted : colors.paper }]}>
                    {added ? t('members.remove') : t('members.addAction')}
                  </Text>
                </PressableScale>
              </View>
            );
          })}
        </ScrollView>
      </BottomSheet>

      {/* «+ Номер» */}
      <BottomSheet open={phoneOpen} onClose={() => setPhoneOpen(false)}>
        <Text style={[styles.sheetTitle, { color: colors.ink }]}>{t('members.addByNumberTitle')}</Text>
        <View style={[styles.phoneField, { borderBottomColor: colors.lime }]}>
          <Text style={[styles.phonePrefix, { color: colors.muted }]}>+998</Text>
          <TextInput
            value={phoneMask(phoneDigits)}
            onChangeText={(v) => setPhoneDigits(v.replace(/\D/g, '').slice(0, 9))}
            keyboardType="number-pad"
            placeholder="90 123 45 67"
            placeholderTextColor={colors.faint}
            cursorColor={colors.lime}
            style={[styles.phoneInput, { color: colors.ink }]}
            autoFocus
          />
        </View>
        <View style={[styles.nameField, { borderBottomColor: colors.sand2 }]}>
          <TextInput
            value={phoneName}
            onChangeText={setPhoneName}
            placeholder={t('members.namePlaceholder')}
            placeholderTextColor={colors.faint}
            autoComplete="name"
            cursorColor={colors.lime}
            style={[styles.nameInput, { color: colors.ink }]}
            onSubmitEditing={() => void addByPhone()}
          />
        </View>
        <PressableScale
          disabled={phoneDigits.length !== 9 || phoneName.trim().length < 2}
          style={[
            styles.sheetBtn,
            { backgroundColor: colors.ink },
            (phoneDigits.length !== 9 || phoneName.trim().length < 2) && styles.disabled,
          ]}
          onPress={() => void addByPhone()}
        >
          <Text style={[styles.sheetBtnText, { color: colors.paper }]}>{t('members.addAction')}</Text>
        </PressableScale>
      </BottomSheet>

      <PinSheet
        open={pinOpen}
        hint={
          merchant
            ? t('members.pinHintMerchant', { amount: money(payNow), merchant: merchant.name })
            : t('members.pinHint', { amount: money(payNow) })
        }
        onClose={() => setPinOpen(false)}
        onConfirm={() => {
          setPinOpen(false);
          void submit();
        }}
      />
      {/* создание сплита занимает секунды — показываем ZAP, а не пустой экран */}
      <ZapOverlay open={busy} steps={CREATE_STEPS} stickers={CREATE_STICKERS} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: SCREEN_PAD_X },
  title: { fontFamily: font.extrabold, fontSize: 27, letterSpacing: -0.3, marginTop: 26 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 14 },
  total: { fontFamily: font.extrabold, fontSize: 40, letterSpacing: -1.2, lineHeight: 42 },
  currency: { fontFamily: font.monoBold, fontSize: 11 },
  forWhat: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 2, paddingBottom: 10, marginTop: 14 },
  forWhatLabel: { fontFamily: font.extrabold, fontSize: 15.5 },
  forWhatInput: { flex: 1, fontFamily: font.bold, fontSize: 16, padding: 0 },
  perPerson: { fontFamily: font.semibold, fontSize: 12.5, marginTop: 8 },
  modeRow: { flexDirection: 'row', gap: 8, marginTop: 22 },
  mode: { height: 40, paddingHorizontal: 18, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  modeText: { fontFamily: font.bold, fontSize: 13.5 },
  modeTextActive: { fontFamily: font.extrabold, fontSize: 13.5 },
  list: { marginTop: 28, gap: 12 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  memberBody: { flex: 1, gap: 2, minWidth: 0 },
  memberName: { fontFamily: font.bold, fontSize: 16 },
  memberSub: { fontFamily: font.semibold, fontSize: 12.5 },
  memberAmount: { fontFamily: font.extrabold, fontSize: 16 },
  debtChip: { height: 30, borderRadius: 999, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  debtChipText: { fontFamily: font.monoBold, fontSize: 10, letterSpacing: 0.8 },
  items: { marginTop: 20, gap: 10 },
  item: { borderBottomWidth: 1, paddingBottom: 10 },
  itemHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  itemTitle: { flex: 1, fontFamily: font.semibold, fontSize: 14 },
  itemAmount: { fontFamily: font.monoBold, fontSize: 12.5 },
  itemChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  itemChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingVertical: 4, paddingLeft: 4, paddingRight: 10 },
  itemChipText: { fontFamily: font.bold, fontSize: 12 },
  addHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 24 },
  addLabel: { fontFamily: font.monoBold, fontSize: 10, letterSpacing: 1.6 },
  allContacts: { fontFamily: font.bold, fontSize: 13 },
  quickScroll: { marginHorizontal: -24 },
  quickRow: { gap: 12, paddingTop: 14, paddingHorizontal: 24 },
  quick: { alignItems: 'center', gap: 6, width: 56 },
  quickName: { fontFamily: font.bold, fontSize: 11.5, maxWidth: 64 },
  quickCircle: { width: 52, height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  quickPlus: { fontFamily: font.semibold, fontSize: 22 },
  plusBadge: { position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 999, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  plusBadgeText: { fontFamily: font.bold, fontSize: 12, lineHeight: 14 },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, paddingTop: 28 },
  ctaFade: { position: 'absolute', left: 0, right: 0, top: 0 },
  ctaFill: { position: 'absolute', left: 0, right: 0, top: 28, bottom: 0 },
  ctaBtn: { height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: font.extrabold, fontSize: 16 },
  ctaSub: { fontFamily: font.semibold, fontSize: 12, textAlign: 'center', marginTop: 12 },
  cashbackRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 6 },
  cashbackChip: { height: 24, borderRadius: 999, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  cashbackChipText: { fontFamily: font.extrabold, fontSize: 11 },
  disabled: { opacity: 0.4 },
  sheetTitle: { fontFamily: font.extrabold, fontSize: 15, textAlign: 'center', marginBottom: 12 },
  editInput: { fontFamily: font.extrabold, fontSize: 36, textAlign: 'center', marginVertical: 20, padding: 0 },
  editCurrency: { fontFamily: font.monoBold, fontSize: 10, letterSpacing: 1.6, textAlign: 'center' },
  sheetBtn: { height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 16, marginBottom: 16 },
  sheetBtnText: { fontFamily: font.bold, fontSize: 15 },
  searchField: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, borderRadius: 999, paddingHorizontal: 16, marginBottom: 8 },
  searchInput: { flex: 1, fontFamily: font.semibold, fontSize: 16, padding: 0 },
  sheetList: { maxHeight: 420 },
  sheetInfo: { fontFamily: font.semibold, fontSize: 12.5, textAlign: 'center', paddingVertical: 12 },
  sheetSection: { fontFamily: font.monoBold, fontSize: 10, letterSpacing: 1.4, paddingTop: 12 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  sheetRowBody: { flex: 1, minWidth: 0 },
  sheetName: { fontFamily: font.bold, fontSize: 14 },
  sheetHandle: { fontFamily: font.mono, fontSize: 11, marginTop: 1 },
  sheetAdd: { height: 32, borderRadius: 999, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  sheetAddText: { fontFamily: font.bold, fontSize: 12 },
  sheetAddTextStrong: { fontFamily: font.extrabold, fontSize: 12 },
  phoneField: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 2, paddingBottom: 12, marginTop: 4 },
  phonePrefix: { fontFamily: font.bold, fontSize: 22 },
  phoneInput: { flex: 1, fontFamily: font.extrabold, fontSize: 22, padding: 0 },
  nameField: { borderBottomWidth: 2, paddingBottom: 12, marginTop: 12 },
  nameInput: { fontFamily: font.bold, fontSize: 17, padding: 0 },
});
