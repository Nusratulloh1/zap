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
import { SectionLabel } from '@/components/SectionLabel';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PingButton } from '@/components/PingButton';
import { PressableScale } from '@/components/PressableScale';
import { Avatar } from '@/components/Avatar';
import { BottomSheet } from '@/components/BottomSheet';
import { toast } from '@/components/ToastHost';
import { renameGroup, deleteGroup, remindDebt, fetchFeaturedBill } from '@/api/actions';
import { qk } from '@/api/data';
import { useHomeData } from '@/store/bootstrap';
import { useDraft } from '@/store/draft';
import { money, humanDateLc, peopleCount, dayMonth } from '@/lib/format';
import { crewStats } from '@/lib/crewStats';
import { STICKER } from '@/components/EmptyState';
import { isDarkSkin, useSkin } from '@/lib/screenSkin';
import { SkinSheet } from '@/components/SkinSheet';
import { VenueIcon } from '@/components/VenueIcon';
import { SquadCircle } from '@/components/SquadCircle';
import { CrewEmojiSheet } from '@/components/CrewEmojiSheet';
import { useCrewColor, useCrewEmoji } from '@/lib/crewEmoji';
import { titlesFor, type TitleKey } from '@/lib/funStats';
import { useTheme } from '@/theme/ThemeProvider';
import { SCREEN_PAD_X, font } from '@/theme/tokens';

// те же знаки, что на слайде кэшбэка в онбординге

/** Какой стикер показывать за каждый титул (наборы совпадают по смыслу). */
const TITLE_STICKER: Record<TitleKey, keyof typeof STICKER> = {
  fastestFinger: 'paidDone',
  lastPayer: 'receiptHero',
  reliableOne: 'fistBump',
  bigSpender: 'wallet',
  pizzaCFO: 'themeFood',
  coffeeAddict: 'themeCoffee',
};

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
  const openDebts = useMemo(
    () => (home.db?.debts ?? []).filter((d) => d.direction === 'owedToMe' && d.status === 'open'),
    [home.db?.debts],
  );

  const [menuSheet, setMenuSheet] = useState(false);
  const [emojiSheet, setEmojiSheet] = useState(false);
  const crewEmoji = useCrewEmoji(home.db, id);
  const crewColor = useCrewColor(home.db, id);
  const skin = useSkin();
  /*
    Заголовки секций на цветном фоне: на светлом — тёмно-оливковый из макета,
    на тёмном фон съедает его, поэтому берём песочный.
  */
  const onDark = isDarkSkin(skin ?? fixed.lime);
  const sectionColor = onDark ? colors.sand : colors.deep;

  /*
    Ачивки человека показываем стикерами вокруг аватара — как в макете, где у
    каждого свои наклейки. Титулы считаются из тех же данных, что в профиле.
  */
  const achievementsOf = (cid: string) =>
    titlesFor(home.db, cid, id)
      .slice(0, 3)
      .map((x) => STICKER[TITLE_STICKER[x.key]]);
  const [skinSheet, setSkinSheet] = useState(false);
  /** должники внутри компании — по открытым долгам её участников */
  /* должники внутри компании: считаем прямо из открытых долгов, чтобы не
     тянуть в зависимости функцию, объявленную ниже по файлу */
  const debtors = useMemo(() => {
    const acc = new Map<string, number>();
    for (const d of openDebts) {
      if (!memberIds.includes(d.contactId)) continue;
      acc.set(d.contactId, (acc.get(d.contactId) ?? 0) + d.amount);
    }
    return [...acc.entries()]
      .map(([cid, amount]) => ({ cid, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [memberIds, openDebts]);

  const [renameSheet, setRenameSheet] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reminded, setReminded] = useState<Set<string>>(new Set());

  const nameOf = (cid: string) =>
    cid === 'me' ? (home.db?.user?.name ?? t('members.youShort')) : (home.contactById(cid)?.name ?? '?');
  const colorOf = (cid: string) => (cid === 'me' ? '#121212' : (home.contactById(cid)?.color ?? '#8A887E'));
  const debtOf = (cid: string) => openDebts.filter((d) => d.contactId === cid).reduce((s, d) => s + d.amount, 0);


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
    <Screen style={styles.root} background={skin ?? fixed.lime} darkBar={false}>
      {/* шапка spec/01: назад — знак и название по центру — «🎨» */}
      <View style={styles.head}>
        <PressableScale style={[styles.round, { backgroundColor: colors.paper }]} onPress={() => nav.goBack()}>
          <Text style={[styles.roundGlyph, { color: colors.ink }]}>←</Text>
        </PressableScale>
        <View style={styles.headCenterRow}>
          {/* знак меняется тапом по нему, название — открывает меню компании */}
          <View style={styles.headTitleRow}>
            <PressableScale haptic onPress={() => setEmojiSheet(true)}>
              <VenueIcon name={group.name} glyph={crewEmoji} color={crewColor} size={26} />
            </PressableScale>
            <PressableScale haptic={false} onPress={() => setMenuSheet(true)} style={styles.titleTap}>
              <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>{group.name}</Text>
              <Text style={[styles.titleChevron, { color: colors.muted }]}>⌄</Text>
            </PressableScale>
          </View>
          <Text style={[styles.headSub, { color: colors.muted }]} numberOfLines={1}>
            {memberIds.map((cid) => home.nameOfContact(cid).split(' ')[0]).join(' · ')}
          </Text>
        </View>
        <PressableScale style={[styles.round, { backgroundColor: colors.paper }]} onPress={() => setSkinSheet(true)}>
          <Text style={styles.roundGlyph}>🎨</Text>
        </PressableScale>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>

        {/* круг отряда: владелец сверху, участники по углам, «+» в центре */}
        <SquadCircle
          frame={colors.paper}
          onInvite={() => void invite()}
          owner={{
            contactId: group.ownerId,
            name: nameOf(group.ownerId),
            color: colorOf(group.ownerId),
            initials: home.contactById(group.ownerId)?.initials,
            stickers: achievementsOf(group.ownerId),
          }}
          members={memberIds
            .filter((cid) => cid !== group.ownerId)
            .map((cid) => ({
              contactId: cid,
              name: nameOf(cid),
              color: colorOf(cid),
              initials: home.contactById(cid)?.initials,
              owes: debtOf(cid) > 0,
              stickers: achievementsOf(cid),
              onPing: () => void remind(cid),
            }))}
        />

        <PressableScale style={[styles.newZap, { backgroundColor: colors.paper }]} onPress={newSplit}>
          <Text style={[styles.newZapText, { color: colors.ink }]}>{t('group.newSplit')}</Text>
        </PressableScale>

        {/* кэшбэк компании — строка-карточка, подробности на экране кэшбэка */}
        <PressableScale
          style={[styles.cashRow, { backgroundColor: colors.paper }]}
          onPress={() => nav.navigate('Cashback')}
        >
          <Image source={STICKER.wallet} style={styles.cashArt} resizeMode="contain" />
          <View style={styles.cashBody}>
            <SectionLabel color={colors.faint2}>{t('group.cashback')}</SectionLabel>
            <View style={styles.cashAmountRow}>
              <Text style={[styles.cashValue, { color: colors.ink }]}>{money(group.cashback)}</Text>
              <Text style={[styles.cashCur, { color: colors.faint2 }]}>{t('common.currency')}</Text>
            </View>
          </View>
          <Text style={[styles.chevron, { color: colors.faint2 }]}>›</Text>
        </PressableScale>

        {/* долги внутри компании — карточками, как в макете */}
        {debtors.length ? (
          <>
            <SectionLabel onDark={onDark} style={styles.sectionMono}>{t('debts.title')}</SectionLabel>
            {debtors.map((d) => (
              <View key={d.cid} style={[styles.debtCard, { backgroundColor: colors.paper }]}>
                <Avatar contactId={d.cid} name={nameOf(d.cid)} color={colorOf(d.cid)} size={44} />
                <View style={styles.debtBody}>
                  <Text style={[styles.debtWho, { color: colors.faint2 }]} numberOfLines={1}>
                    {t('group.owesYou', { name: nameOf(d.cid) })}
                  </Text>
                  <Text style={[styles.debtAmount, { color: colors.ink }]} numberOfLines={1}>
                    {money(d.amount)}
                    <Text style={[styles.debtCur, { color: colors.faint2 }]}> {t('common.currency')}</Text>
                  </Text>
                </View>
                <PingButton pinged={reminded.has(d.cid)} onPress={() => void remind(d.cid)} />
              </View>
            ))}
          </>
        ) : null}

        {/* история компании: сколько ужинов и кофе вместе, кто должен, кто платил */}
        <CrewStatsBlock
          sectionColor={sectionColor}
          stats={stats}
          nameOf={(cid) => home.contactById(cid)?.name ?? ''}
          initialsOf={(cid) => home.contactById(cid)?.initials}
          colorOf={(cid) => home.contactById(cid)?.color ?? '#8A887E'}
        />

        <View style={styles.section}>
          <View style={styles.splitsHead}>
            <SectionLabel onDark={onDark}>{t('group.lastZaps')}</SectionLabel>
            <PressableScale onPress={() => nav.popTo('Tabs', { screen: 'History' })}>
              <Text style={[styles.seeAll, { color: sectionColor }]}>{t('home.seeAll')}</Text>
            </PressableScale>
          </View>
          {groupSplits.map((s) => {
            const merchant = home.db?.merchants.find((m) => m.id === s.merchantId);
            return (
              <PressableScale
                key={s.id}
                haptic={false}
                style={[styles.splitRow, { backgroundColor: colors.paper }]}
                onPress={() => nav.navigate('SplitLive', { id: s.id })}
              >
                <VenueIcon name={merchant?.name ?? s.title} size={38} />
                <View style={styles.memberBody}>
                  <Text style={[styles.splitTitle, { color: colors.ink }]} numberOfLines={1}>
                    {merchant?.name ?? s.title}
                  </Text>
                  <Text style={[styles.splitSub, { color: colors.muted }]} numberOfLines={1}>
                    {t('live.paidOfCount', {
                      paid: s.members.filter((m) => m.status === 'paid' || m.status === 'debt').length,
                      total: s.members.length,
                    })}
                    {' · '}
                    {humanDateLc(s.createdAt)}
                  </Text>
                </View>
                <View style={styles.splitRight}>
                  <Text style={[styles.splitAmount, { color: colors.ink }]} numberOfLines={1}>{money(s.total)}</Text>
                  <Text style={[styles.splitState, { color: colors.muted }]}>
                    {s.status === 'closed' ? t('home.closedBadge').toLowerCase() : t('home.activeBadge').toLowerCase()}
                  </Text>
                </View>
              </PressableScale>
            );
          })}
          {!groupSplits.length ? (
            <EmptyState sticker="oneBill" title={t('empty.historyTitle')} hint={t('empty.historyHint')} />
          ) : null}
        </View>
      </ScrollView>

      {/* меню группы */}
      <SkinSheet open={skinSheet} onClose={() => setSkinSheet(false)} />

      <CrewEmojiSheet
        open={emojiSheet}
        groupId={id}
        current={crewEmoji}
        currentColor={crewColor}
        onClose={() => setEmojiSheet(false)}
      />

      <BottomSheet open={menuSheet} onClose={() => setMenuSheet(false)}>
        {/* меню компании: открывается тапом по названию */}
        <Text style={[styles.menuTitle, { color: colors.ink }]} numberOfLines={1}>{group.name}</Text>
        <Text style={[styles.menuSub, { color: colors.muted }]} numberOfLines={1}>
          {t('group.sinceWith', { people: peopleCount(memberIds.length), date: dayMonth(new Date(group.createdAt)) })}
        </Text>

        <PressableScale
          haptic={false}
          style={[styles.menuRow, { borderBottomColor: colors.sand2 }]}
          onPress={() => {
            setMenuSheet(false);
            setTimeout(() => setEmojiSheet(true), 260);
          }}
        >
          <View style={[styles.menuIcon, { backgroundColor: colors.sand }]}><Text style={styles.menuGlyph}>{crewEmoji}</Text></View>
          <Text style={[styles.menuText, { color: colors.ink }]}>{t('group.pickEmoji')}</Text>
        </PressableScale>
        <PressableScale
          haptic={false}
          style={[styles.menuRow, { borderBottomColor: colors.sand2 }]}
          onPress={() => {
            setMenuSheet(false);
            setRenameValue(group.name);
            setTimeout(() => setRenameSheet(true), 260);
          }}
        >
          <View style={[styles.menuIcon, { backgroundColor: colors.sand }]}><Text style={styles.menuGlyph}>✎</Text></View>
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
          <View style={[styles.menuIcon, { backgroundColor: colors.sand }]}><Text style={styles.menuGlyph}>🗑</Text></View>
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
  contribRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54 },
  contribBody: { flex: 1, minWidth: 0 },
  contribAmount: { fontFamily: font.extrabold, fontSize: 15 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 20 },
  round: { width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  roundGlyph: { fontSize: 18 },
  headCenterRow: { flex: 1, minWidth: 0, alignItems: 'center' },
  splitTitle: { fontFamily: font.bold, fontSize: 13 },
  splitSub: { fontFamily: font.semibold, fontSize: 10, marginTop: 2 },
  splitRight: { alignItems: 'flex-end' },
  splitState: { fontFamily: font.semibold, fontSize: 9, marginTop: 1 },
  headTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headSub: { fontFamily: font.semibold, fontSize: 11, marginTop: 2 },
  newZap: { height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginTop: 26 },
  newZapText: { fontFamily: font.bold, fontSize: 15 },
  cashRow: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, marginTop: 18 },
  cashArt: { width: 56, height: 60 },
  cashBody: { flex: 1, minWidth: 0 },
  cashAmountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  cashValue: { fontFamily: font.extrabold, fontSize: 28 },
  cashCur: { fontFamily: font.semibold, fontSize: 12 },
  chevron: { fontFamily: font.semibold, fontSize: 18 },
  sectionMono: { marginTop: 22, marginBottom: 12 },
  debtCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 14, marginBottom: 8 },
  debtBody: { flex: 1, minWidth: 0 },
  debtWho: { fontFamily: font.semibold, fontSize: 11 },
  debtAmount: { fontFamily: font.extrabold, fontSize: 22, letterSpacing: -0.3, marginTop: 3 },
  debtCur: { fontFamily: font.semibold, fontSize: 11 },
  remindBtn: { borderRadius: 14, paddingVertical: 9, paddingHorizontal: 14 },
  remindBtnText: { fontFamily: font.bold, fontSize: 11 },
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
  headCtaDark: { fontFamily: font.extrabold, fontSize: 15, color: '#121212' },
  headCtaLight: { fontFamily: font.bold, fontSize: 15 },
  section: { marginTop: 22 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58 },
  memberBody: { flex: 1, gap: 1 },
  memberName: { fontFamily: font.bold, fontSize: 15 },
  memberSub: { fontFamily: font.semibold, fontSize: 12 },
  ownerChip: { height: 28, paddingHorizontal: 12, borderRadius: 999, justifyContent: 'center' },
  ownerText: { fontFamily: font.bold, fontSize: 11.5 },
  remindChip: { height: 30, paddingHorizontal: 12, borderRadius: 999, justifyContent: 'center' },
  remindText: { fontFamily: font.bold, fontSize: 12 },
  disabled: { opacity: 0.5 },
  splitsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  seeAll: { fontFamily: font.semibold, fontSize: 11 },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  splitIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  splitLetter: { fontFamily: font.extrabold, fontSize: 15 },
  splitAmount: { fontFamily: font.extrabold, fontSize: 14 },
  empty: { fontFamily: font.semibold, fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  menuRowLast: { borderBottomWidth: 0 },
  menuTitle: { fontFamily: font.extrabold, fontSize: 19, letterSpacing: -0.2 },
  menuSub: { fontFamily: font.semibold, fontSize: 12.5, marginTop: 3, marginBottom: 10 },
  menuIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuGlyph: { fontSize: 16 },
  titleTap: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
  titleChevron: { fontFamily: font.semibold, fontSize: 12, marginTop: -2 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderBottomWidth: 1 },
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
