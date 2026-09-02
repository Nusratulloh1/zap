// Группа — порт GroupPage.vue (дизайн 5f): стек аватаров + название,
// «Новый сплит» / «Позвать», кэшбэк группы, участники (напомнить должнику),
// сплиты группы, меню «⋯» (переименовать / удалить).
import React, { useMemo, useState } from 'react';
import { Platform, Clipboard, Image, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { CrewStatsBlock } from '@/components/CrewStatsBlock';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PressableScale } from '@/components/PressableScale';
import { Avatar } from '@/components/Avatar';
import { BottomSheet } from '@/components/BottomSheet';
import { toast } from '@/components/ToastHost';
import { renameGroup, deleteGroup, remindDebt, fetchFeaturedBill } from '@/api/actions';
import { qk } from '@/api/data';
import { useHomeData } from '@/store/bootstrap';
import { useDraft } from '@/store/draft';
import { money, peopleCount, dayMonth, humanDateLc } from '@/lib/format';
import { crewStats } from '@/lib/crewStats';
import { MerchantLogos } from '@/components/MerchantLogos';
import { STICKER } from '@/components/EmptyState';
import { FunStatCards } from '@/components/FunStatCards';
import { VenueIcon } from '@/components/VenueIcon';
import { CrewEmojiSheet } from '@/components/CrewEmojiSheet';
import { useCrewColor, useCrewEmoji } from '@/lib/crewEmoji';
import { funStats } from '@/lib/funStats';
import { translate } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { SCREEN_PAD_X, font } from '@/theme/tokens';

// те же знаки, что на слайде кэшбэка в онбординге

export function GroupScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors, fixed } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const qc = useQueryClient();
  const home = useHomeData();
  const draft = useDraft();
  const id = route.params?.id as string;

  const group = home.db?.groups.find((g) => g.id === id);
  const stats = useMemo(() => crewStats(home.db, id), [home.db, id]);
  const fun = useMemo(() => funStats(home.db, id), [home.db, id]);
  /*
    memberIds приходит с бэкенда уже вместе со мной (contactId(m.phone) →
    'me' для своего телефона). Раньше я добавлял 'me' сверху — получались
    дубли ключей и два одинаковых лица. Здесь только страхуемся от повторов
    и ставим себя первым.
  */
  const memberIds = useMemo(() => {
    /*
      Состав берём из группы И из её сплитов. На сервере до фикса
      groups.service (см. коммит «отряд слотами») в группу попадал только
      создатель — «Aziz + Shoshiy» в списке сплитов, а в отряде один Aziz.
      Сплиты знают правду о том, кто ел вместе, поэтому дополняем ими.
    */
    const ids = [...new Set(group?.memberIds ?? [])];
    for (const sp of home.splits) {
      if (sp.groupId !== id) continue;
      for (const m of sp.members) {
        const cid = m.isYou ? 'me' : m.contactId;
        if (!ids.includes(cid)) ids.push(cid);
      }
    }
    if (!ids.includes('me')) ids.unshift('me');
    return ids.sort((a, b) => Number(b === 'me') - Number(a === 'me'));
  }, [group?.memberIds, home.splits, id]);

  const groupSplits = useMemo(() => home.splits.filter((s) => s.groupId === id), [home.splits, id]);
  // мерчанты, где компания реально была — по её же сплитам
  const groupMerchants = useMemo(() => {
    const ids = [...new Set(groupSplits.map((s) => s.merchantId).filter(Boolean))] as string[];
    return ids
      .map((mid) => home.db?.merchants.find((m) => m.id === mid))
      .filter((m): m is NonNullable<typeof m> => !!m);
  }, [groupSplits, home.db]);
  const openDebts = useMemo(
    () => (home.db?.debts ?? []).filter((d) => d.direction === 'owedToMe' && d.status === 'open'),
    [home.db?.debts],
  );

  const [menuSheet, setMenuSheet] = useState(false);
  const [emojiSheet, setEmojiSheet] = useState(false);
  const crewEmoji = useCrewEmoji(home.db, id);
  const crewColor = useCrewColor(home.db, id);
  const [renameSheet, setRenameSheet] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reminded, setReminded] = useState<Set<string>>(new Set());

  const nameOf = (cid: string) =>
    cid === 'me' ? (home.db?.user?.name ?? t('members.youShort')) : (home.contactById(cid)?.name ?? '?');
  const colorOf = (cid: string) => (cid === 'me' ? '#111110' : (home.contactById(cid)?.color ?? '#8A887E'));
  const debtOf = (cid: string) => openDebts.filter((d) => d.contactId === cid).reduce((s, d) => s + d.amount, 0);

  const memberSub = (cid: string) => {
    const debt = debtOf(cid);
    if (debt > 0) return t('group.owes', { amount: money(debt) });
    const n = groupSplits.filter((s) => s.members.some((m) => m.contactId === cid)).length;
    return translate('group.allClosed', { n });
  };

  const remind = async (cid: string) => {
    setReminded((s) => new Set([...s, cid]));
    const debt = openDebts.find((d) => d.contactId === cid);
    try {
      if (debt) await remindDebt(debt.id);
      toast.success(t('debts.remindedToast'));
    } catch (e) {
      toast(e instanceof Error ? e.message : t('debts.alreadyReminded'));
    }
    await qc.invalidateQueries({ queryKey: qk.bootstrap });
  };

  const newSplit = () => {
    void (async () => {
      const bill = home.db?.featuredBill ?? (await fetchFeaturedBill().catch(() => null));
      draft.startForGroup(bill ?? null, group?.memberIds ?? []);
      nav.navigate(bill ? 'Bill' : 'Members');
    })();
  };

  const invite = async () => {
    const url = `https://zapapp.uz/g/${id}`;
    try {
      await Share.share(
        Platform.OS === 'ios'
          ? { url, message: t('group.shareText') }
          : { title: group?.name, message: `${t('group.shareText')} ${url}` },
      );
    } catch {
      Clipboard.setString(url);
      toast.success(t('common.copied'));
    }
  };

  const applyRename = async () => {
    if (!renameValue.trim()) return;
    await renameGroup(id, renameValue.trim());
    await qc.invalidateQueries({ queryKey: qk.bootstrap });
    setRenameSheet(false);
    toast.success(t('group.renamed'));
  };

  const applyDelete = async () => {
    await deleteGroup(id);
    await qc.invalidateQueries({ queryKey: qk.bootstrap });
    setConfirmDelete(false);
    toast.success(t('group.deleted'));
    nav.popTo('Tabs');
  };

  if (!group) {
    return (
      <Screen style={styles.root}>
        <ScreenHeader />
      </Screen>
    );
  }

  return (
    <Screen style={styles.root}>
      <ScreenHeader right={{ glyph: '⋯', label: t('group.menuAria'), onPress: () => setMenuSheet(true) }} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
        <View style={styles.headRow}>
          {/* знак компании — тап меняет: «Select emoji for Crew» */}
          <PressableScale haptic onPress={() => setEmojiSheet(true)}>
            <VenueIcon name={group.name} glyph={crewEmoji} color={crewColor} size={52} />
          </PressableScale>
          <View style={styles.headBody}>
            <Text style={[styles.title, { color: colors.ink }]}>{group.name}</Text>
            <Text style={[styles.sub, { color: colors.faint }]}>
              {t('group.sinceWith', { people: peopleCount(memberIds.length), date: dayMonth(new Date(group.createdAt)) })}
            </Text>
          </View>
        </View>

        <View style={styles.ctaRow}>
          <PressableScale style={[styles.headCta, { backgroundColor: fixed.lime }]} onPress={newSplit}>
            <Text style={styles.headCtaDark}>{t('group.newSplit')}</Text>
          </PressableScale>
          <PressableScale style={[styles.headCta, { backgroundColor: colors.sand }]} onPress={() => void invite()}>
            <Text style={[styles.headCtaLight, { color: colors.ink }]}>{t('group.invite')}</Text>
          </PressableScale>
        </View>

        {/* ачивки компании — сразу под кнопками, компактной лентой */}
        <FunStatCards fun={fun} nameOf={nameOf} />

        {/*
          Кэшбэк компании — лаймовая карточка со стикером-кошельком: раньше
          это была строка цифр на белом и читалась как техническая сводка.
        */}
        <View style={[styles.cashCard, { backgroundColor: fixed.lime }]}>
          <Image source={STICKER.wallet} style={styles.cashArt} resizeMode="contain" />
          <Text style={styles.cashKicker}>{t('group.cashback')}</Text>
          <View style={styles.cashbackRow}>
            <Text style={styles.cashValue} numberOfLines={1} adjustsFontSizeToFit>{money(group.cashback)}</Text>
            <Text style={styles.cashCur}>UZS</Text>
          </View>
          <View style={styles.cashFoot}>
            <MerchantLogos merchants={groupMerchants} size={30} />
            <Text style={styles.cashMerchants}>
              {translate('group.merchantsCount', { n: groupMerchants.length || group.merchantsCount })}
            </Text>
          </View>
        </View>

        {/*
          Отряд — слоты как в лобби игры: рамка вокруг аватара, шеврон с
          ролью, снизу имя и строка состояния. Пустой слот с пунктиром зовёт
          добавить человека — компания из одного больше не выглядит поломкой.
        */}
        <View style={[styles.section, { borderTopColor: colors.sand2 }]}>
          <View style={styles.splitsHead}>
            <Text style={[styles.mono, { color: colors.faint2 }]}>{t('group.squad')}</Text>
            <Text style={[styles.squadCount, { color: colors.muted }]}>{memberIds.length}</Text>
          </View>
          <View style={styles.slots}>
            {memberIds.map((cid) => {
              const owner = cid === group.ownerId;
              const debt = debtOf(cid);
              return (
                <View key={cid} style={[styles.slot, { backgroundColor: colors.shell }]}>
                  <View style={[styles.slotFrame, { borderColor: owner ? fixed.lime : colors.sand2 }]}>
                    <Avatar contactId={cid} name={nameOf(cid)} color={colorOf(cid)} size={48} />
                  </View>
                  <View style={[styles.slotChevron, { backgroundColor: owner ? fixed.lime : colors.sand }]}>
                    <Text style={[styles.slotChevronText, { color: owner ? '#111110' : colors.muted }]} numberOfLines={1}>
                      {owner ? t('group.owner') : t('group.member')}
                    </Text>
                  </View>
                  <Text style={[styles.slotName, { color: colors.ink }]} numberOfLines={1}>
                    {nameOf(cid).split(' ')[0]}
                    {cid === 'me' ? t('group.youSuffix') : ''}
                  </Text>
                  <Text style={[styles.slotSub, { color: colors.faint }]} numberOfLines={1}>
                    {cid === 'me' ? translate('group.allClosed', { n: groupSplits.length }) : memberSub(cid)}
                  </Text>
                  {!owner && debt > 0 ? (
                    <PressableScale
                      disabled={reminded.has(cid)}
                      style={[styles.slotRemind, { backgroundColor: colors.ink }, reminded.has(cid) && styles.disabled]}
                      onPress={() => void remind(cid)}
                    >
                      <Text style={[styles.slotRemindText, { color: fixed.lime }]} numberOfLines={1}>
                        {reminded.has(cid) ? t('group.reminded') : t('group.remind')}
                      </Text>
                    </PressableScale>
                  ) : null}
                </View>
              );
            })}
            {/* свободный слот — приглашение */}
            <PressableScale style={[styles.slot, styles.slotEmpty, { borderColor: colors.sand2 }]} onPress={() => void invite()}>
              <View style={[styles.slotFrame, styles.slotPlusFrame, { borderColor: colors.sand2 }]}>
                <Text style={[styles.slotPlus, { color: colors.faint }]}>+</Text>
              </View>
              <Text style={[styles.slotName, { color: colors.muted }]} numberOfLines={1}>{t('group.invite')}</Text>
            </PressableScale>
          </View>
        </View>

        {/* история компании: сколько ужинов и кофе вместе, кто должен, кто платил */}
        <CrewStatsBlock
          stats={stats}
          nameOf={(cid) => home.contactById(cid)?.name ?? ''}
          initialsOf={(cid) => home.contactById(cid)?.initials}
          colorOf={(cid) => home.contactById(cid)?.color ?? '#8A887E'}
        />

        <View style={[styles.section, { borderTopColor: colors.sand2 }]}>
          <View style={styles.splitsHead}>
            <Text style={[styles.mono, { color: colors.faint2 }]}>{t('group.splits')}</Text>
            <PressableScale onPress={() => nav.popTo('Tabs', { screen: 'History' })}>
              <Text style={[styles.seeAll, { color: colors.muted }]}>{t('home.seeAll')}</Text>
            </PressableScale>
          </View>
          {groupSplits.map((s) => {
            const merchant = home.db?.merchants.find((m) => m.id === s.merchantId);
            return (
              <PressableScale key={s.id} haptic={false} style={styles.splitRow} onPress={() => nav.navigate('SplitLive', { id: s.id })}>
                <VenueIcon name={merchant?.name ?? s.title} size={44} />
                <View style={styles.memberBody}>
                  <Text style={[styles.memberName, { color: colors.ink }]} numberOfLines={1}>
                    {merchant?.name ?? s.title}
                    {s.bill ? ` · #${s.bill.orderNo}` : ''}
                  </Text>
                  <Text style={[styles.memberSub, { color: colors.faint }]} numberOfLines={1}>
                    {humanDateLc(s.createdAt)}
                    {s.cashback ? t('group.splitCashback', { amount: money(s.cashback) }) : ''}
                  </Text>
                </View>
                <Text style={[styles.splitAmount, { color: colors.ink }]} numberOfLines={1} adjustsFontSizeToFit>{money(s.total)}</Text>
              </PressableScale>
            );
          })}
          {!groupSplits.length ? (
            <EmptyState sticker="oneBill" title={t('empty.historyTitle')} hint={t('empty.historyHint')} />
          ) : null}
        </View>
      </ScrollView>

      {/* меню группы */}
      <CrewEmojiSheet
        open={emojiSheet}
        groupId={id}
        current={crewEmoji}
        currentColor={crewColor}
        onClose={() => setEmojiSheet(false)}
      />

      <BottomSheet open={menuSheet} onClose={() => setMenuSheet(false)}>
        <PressableScale
          haptic={false}
          style={[styles.menuRow, { borderBottomColor: colors.sand2 }]}
          onPress={() => {
            setMenuSheet(false);
            setRenameValue(group.name);
            setTimeout(() => setRenameSheet(true), 260);
          }}
        >
          <Text style={[styles.menuText, { color: colors.ink }]}>{t('group.renameTitle')}</Text>
        </PressableScale>
        <PressableScale
          haptic={false}
          style={styles.menuRow}
          onPress={() => {
            setMenuSheet(false);
            setTimeout(() => setConfirmDelete(true), 260);
          }}
        >
          <Text style={[styles.menuText, { color: colors.ember }]}>{t('group.delete')}</Text>
        </PressableScale>
      </BottomSheet>

      {/* переименование */}
      <BottomSheet open={renameSheet} onClose={() => setRenameSheet(false)}>
        <Text style={[styles.sheetTitle, { color: colors.ink }]}>{t('group.renameSheetTitle')}</Text>
        <TextInput
          value={renameValue}
          onChangeText={setRenameValue}
          style={[styles.renameInput, { color: colors.ink, borderBottomColor: fixed.lime }]}
          selectionColor={fixed.lime}
          autoFocus
        />
        <PressableScale style={[styles.sheetCta, { backgroundColor: colors.ink }]} onPress={() => void applyRename()}>
          <Text style={[styles.sheetCtaText, { color: colors.cream }]}>{t('group.save')}</Text>
        </PressableScale>
      </BottomSheet>

      {/* подтверждение удаления */}
      <BottomSheet open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <Text style={[styles.confirmTitle, { color: colors.ink }]}>{t('group.deleteConfirm')}</Text>
        <Text style={[styles.confirmNote, { color: colors.muted }]}>{t('group.deleteNote')}</Text>
        <View style={styles.confirmRow}>
          <PressableScale style={[styles.confirmBtn, { backgroundColor: colors.sand }]} onPress={() => setConfirmDelete(false)}>
            <Text style={[styles.confirmText, { color: colors.ink }]}>{t('common.cancel')}</Text>
          </PressableScale>
          <PressableScale style={[styles.confirmBtn, { backgroundColor: '#B4451F' }]} onPress={() => void applyDelete()}>
            <Text style={[styles.confirmText, styles.confirmDanger]}>{t('group.deleteAction')}</Text>
          </PressableScale>
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: SCREEN_PAD_X },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 22 },
  stack: { flexDirection: 'row' },
  stacked: { marginLeft: -14 },
  headBody: { flex: 1, gap: 2 },
  title: { fontFamily: font.extrabold, fontSize: 22, letterSpacing: -0.2 },
  sub: { fontFamily: font.semibold, fontSize: 12.5 },
  ctaRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cashCard: { borderRadius: 24, padding: 18, marginTop: 22, overflow: 'hidden' },
  cashArt: { position: 'absolute', right: 10, top: 8, width: 92, height: 78, transform: [{ rotate: '8deg' }] },
  cashKicker: { fontFamily: font.monoBold, fontSize: 9.5, letterSpacing: 1.5, color: 'rgba(17,17,16,0.55)' },
  cashValue: { fontFamily: font.extrabold, fontSize: 40, letterSpacing: -1.4, color: '#111110' },
  cashCur: { fontFamily: font.bold, fontSize: 12, color: 'rgba(17,17,16,0.5)', marginBottom: 7 },
  cashFoot: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  cashMerchants: { fontFamily: font.bold, fontSize: 12, color: 'rgba(17,17,16,0.6)' },
  squadCount: { fontFamily: font.extrabold, fontSize: 12 },
  // ровно три в ряд: при 31.5% + gap строка не помещалась и ломалась на два
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  slot: { width: '31%', borderRadius: 20, paddingVertical: 13, paddingHorizontal: 6, alignItems: 'center' },
  slotEmpty: { borderWidth: 2, borderStyle: 'dashed', justifyContent: 'center' },
  slotFrame: { padding: 3, borderRadius: 999, borderWidth: 2.5 },
  slotPlusFrame: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
  slotPlus: { fontFamily: font.extrabold, fontSize: 26, marginTop: -2 },
  slotChevron: { marginTop: -9, paddingHorizontal: 8, height: 18, borderRadius: 999, justifyContent: 'center' },
  slotChevronText: { fontFamily: font.monoBold, fontSize: 8.5, letterSpacing: 0.8, textTransform: 'uppercase' },
  slotName: { fontFamily: font.extrabold, fontSize: 12, marginTop: 7 },
  slotSub: { fontFamily: font.semibold, fontSize: 9.5, marginTop: 2, textAlign: 'center' },
  slotRemind: { marginTop: 8, height: 25, paddingHorizontal: 8, borderRadius: 999, justifyContent: 'center' },
  slotRemindText: { fontFamily: font.extrabold, fontSize: 10.5 },
  headCta: { flex: 1, height: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  headCtaDark: { fontFamily: font.extrabold, fontSize: 15, color: '#111110' },
  headCtaLight: { fontFamily: font.bold, fontSize: 15 },
  section: { borderTopWidth: 1, paddingTop: 18, marginTop: 22 },
  mono: { fontFamily: font.monoBold, fontSize: 10, letterSpacing: 1.6 },
  cashbackRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58 },
  memberBody: { flex: 1, gap: 1 },
  memberName: { fontFamily: font.bold, fontSize: 15 },
  memberSub: { fontFamily: font.semibold, fontSize: 12 },
  ownerChip: { height: 28, paddingHorizontal: 12, borderRadius: 999, justifyContent: 'center' },
  ownerText: { fontFamily: font.bold, fontSize: 11.5 },
  remindChip: { height: 30, paddingHorizontal: 12, borderRadius: 999, justifyContent: 'center' },
  remindText: { fontFamily: font.bold, fontSize: 12 },
  disabled: { opacity: 0.5 },
  splitsHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  seeAll: { fontFamily: font.bold, fontSize: 13 },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58 },
  splitIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  splitLetter: { fontFamily: font.extrabold, fontSize: 15 },
  splitAmount: { fontFamily: font.extrabold, fontSize: 15 },
  empty: { fontFamily: font.semibold, fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  menuRowLast: { borderBottomWidth: 0 },
  menuRow: { minHeight: 52, justifyContent: 'center', borderBottomWidth: 1 },
  menuText: { fontFamily: font.bold, fontSize: 15 },
  sheetTitle: { fontFamily: font.extrabold, fontSize: 15, textAlign: 'center' },
  renameInput: { borderBottomWidth: 2, paddingBottom: 8, fontFamily: font.bold, fontSize: 18, marginTop: 16 },
  sheetCta: { height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  sheetCtaText: { fontFamily: font.bold, fontSize: 15 },
  confirmTitle: { fontFamily: font.extrabold, fontSize: 17, textAlign: 'center', marginTop: 8 },
  confirmNote: { fontFamily: font.semibold, fontSize: 13, textAlign: 'center', marginTop: 4 },
  confirmRow: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 8 },
  confirmBtn: { flex: 1, height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  confirmText: { fontFamily: font.bold, fontSize: 15 },
  confirmDanger: { color: '#FFFFFF', fontFamily: font.extrabold },
});
