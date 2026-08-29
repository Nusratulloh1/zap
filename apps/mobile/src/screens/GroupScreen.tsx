// Группа — порт GroupPage.vue (дизайн 5f): стек аватаров + название,
// «Новый сплит» / «Позвать», кэшбэк группы, участники (напомнить должнику),
// сплиты группы, меню «⋯» (переименовать / удалить).
import React, { useMemo, useState } from 'react';
import { Platform, Clipboard, Image, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
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
import { translate } from '@/i18n';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

const partnerLogos = [
  require('../../assets/brand/partners/safia.png'),
  require('../../assets/brand/partners/texnomart.png'),
  require('../../assets/brand/partners/idea.png'),
];

export function GroupScreen() {
  const { t } = useTranslation();
  const { colors, fixed, name: themeName } = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const qc = useQueryClient();
  const home = useHomeData();
  const draft = useDraft();
  const id = route.params?.id as string;

  const group = home.db?.groups.find((g) => g.id === id);
  const groupSplits = useMemo(() => home.splits.filter((s) => s.groupId === id), [home.splits, id]);
  const openDebts = useMemo(
    () => (home.db?.debts ?? []).filter((d) => d.direction === 'owedToMe' && d.status === 'open'),
    [home.db?.debts],
  );

  const [menuSheet, setMenuSheet] = useState(false);
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
    nav.navigate('Tabs');
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
        <View style={styles.headRow}>
          <View style={styles.stack}>
            {group.memberIds.slice(0, 3).map((cid, i) => (
              <Avatar key={cid} name={nameOf(cid)} contactId={cid} color={colorOf(cid)} size={46} ring={colors.paper} style={i > 0 ? styles.stacked : undefined} />
            ))}
          </View>
          <View style={styles.headBody}>
            <Text style={[styles.title, { color: colors.ink }]}>{group.name}</Text>
            <Text style={[styles.sub, { color: colors.faint }]}>
              {t('group.sinceWith', { people: peopleCount(group.memberIds.length), date: dayMonth(new Date(group.createdAt)) })}
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

        <View style={[styles.section, { borderTopColor: colors.sand2 }]}>
          <Text style={[styles.mono, { color: colors.faint2 }]}>{t('group.cashback')}</Text>
          <View style={styles.cashbackRow}>
            <Text style={[styles.cashback, { color: colors.ink }]}>{money(group.cashback)}</Text>
            <Text style={[styles.currency, { color: colors.faint2 }]}>UZS</Text>
          </View>
          <View style={styles.logosRow}>
            {partnerLogos.map((l, i) => (
              <Image key={i} source={l} style={[styles.partnerLogo, i > 0 && styles.logoOverlap]} />
            ))}
            <Text style={[styles.merchants, { color: colors.muted }]}>
              {translate('group.merchantsCount', { n: group.merchantsCount })}
            </Text>
          </View>
        </View>

        <View style={[styles.section, { borderTopColor: colors.sand2 }]}>
          <Text style={[styles.mono, { color: colors.faint2 }]}>{t('group.members')}</Text>
          {group.memberIds.map((cid) => (
            <View key={cid} style={styles.memberRow}>
              <Avatar name={nameOf(cid)} contactId={cid} color={colorOf(cid)} size={40} />
              <View style={styles.memberBody}>
                <Text style={[styles.memberName, { color: colors.ink }]} numberOfLines={1}>
                  {nameOf(cid)}
                  {cid === 'me' ? t('group.youSuffix') : ''}
                </Text>
                <Text style={[styles.memberSub, { color: colors.faint }]} numberOfLines={1}>
                  {cid === 'me' ? translate('group.allClosed', { n: groupSplits.length }) : memberSub(cid)}
                </Text>
              </View>
              {cid === group.ownerId ? (
                <View style={[styles.ownerChip, { backgroundColor: colors.sand }]}>
                  <Text style={[styles.ownerText, { color: colors.muted }]}>{t('group.owner')}</Text>
                </View>
              ) : debtOf(cid) > 0 ? (
                <PressableScale
                  disabled={reminded.has(cid)}
                  style={[styles.remindChip, { backgroundColor: themeName === 'dark' ? 'rgba(255,255,255,0.08)' : colors.ink }, reminded.has(cid) && styles.disabled]}
                  onPress={() => void remind(cid)}
                >
                  <Text style={[styles.remindText, { color: fixed.lime }]}>
                    {reminded.has(cid) ? t('group.reminded') : t('group.remind')}
                  </Text>
                </PressableScale>
              ) : null}
            </View>
          ))}
        </View>

        <View style={[styles.section, { borderTopColor: colors.sand2 }]}>
          <View style={styles.splitsHead}>
            <Text style={[styles.mono, { color: colors.faint2 }]}>{t('group.splits')}</Text>
            <PressableScale onPress={() => nav.navigate('Tabs', { screen: 'History' })}>
              <Text style={[styles.seeAll, { color: colors.muted }]}>{t('home.seeAll')}</Text>
            </PressableScale>
          </View>
          {groupSplits.map((s) => {
            const merchant = home.db?.merchants.find((m) => m.id === s.merchantId);
            return (
              <PressableScale key={s.id} haptic={false} style={styles.splitRow} onPress={() => nav.navigate('SplitLive', { id: s.id })}>
                <View style={[styles.splitIcon, { backgroundColor: colors.ink }]}>
                  <Text style={[styles.splitLetter, { color: colors.cream }]}>{merchant?.letter ?? 'S'}</Text>
                </View>
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
          {!groupSplits.length ? <Text style={[styles.empty, { color: colors.muted }]}>{t('history.empty')}</Text> : null}
        </View>
      </ScrollView>

      {/* меню группы */}
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
  root: { paddingHorizontal: 24 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 22 },
  stack: { flexDirection: 'row' },
  stacked: { marginLeft: -14 },
  headBody: { flex: 1, gap: 2 },
  title: { fontFamily: font.extrabold, fontSize: 22, letterSpacing: -0.2 },
  sub: { fontFamily: font.semibold, fontSize: 12.5 },
  ctaRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  headCta: { flex: 1, height: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  headCtaDark: { fontFamily: font.extrabold, fontSize: 15, color: '#111110' },
  headCtaLight: { fontFamily: font.bold, fontSize: 15 },
  section: { borderTopWidth: 1, paddingTop: 18, marginTop: 22 },
  mono: { fontFamily: font.monoBold, fontSize: 10, letterSpacing: 1.6 },
  cashbackRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 10 },
  cashback: { fontFamily: font.extrabold, fontSize: 36, letterSpacing: -0.8, lineHeight: 40 },
  currency: { fontFamily: font.monoBold, fontSize: 10.5 },
  logosRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  partnerLogo: { height: 28, width: 28, borderRadius: 9 },
  partnerLogoWide: { height: 28, width: 56, borderRadius: 9, marginLeft: -10 },
  logoOverlap: { marginLeft: -10 },
  merchants: { fontFamily: font.semibold, fontSize: 12.5, marginLeft: 12 },
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
