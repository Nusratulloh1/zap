// «С кем делим» — порт web/src/pages/MembersPage.vue.
// Три режима: поровну (пересчёт), вручную (валидация суммы), по позициям.
// «В долг» — организатор платит за участника сейчас, тот остаётся должен.
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { PressableScale } from '@/components/PressableScale';
import { Avatar } from '@/components/Avatar';
import { BottomSheet } from '@/components/BottomSheet';
import { PinSheet } from '@/components/PinSheet';
import { useHomeData } from '@/store/bootstrap';
import { useDraft, payNowOf, mismatchOf } from '@/store/draft';
import { createSplit } from '@/api/splits';
import { qk } from '@/api/data';
import { money } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';
import type { SplitMode } from '@zap/shared/types';

const ME = 'me';
const MODES: { value: SplitMode; label: string }[] = [
  { value: 'equal', label: 'members.modeEqual' },
  { value: 'manual', label: 'members.modeManual' },
  { value: 'items', label: 'members.modeItems' },
];

export function MembersScreen() {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const qc = useQueryClient();
  const home = useHomeData();

  const draft = useDraft();
  const [contactsOpen, setContactsOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const modes = useMemo(() => MODES.filter((m) => m.value !== 'items' || draft.bill), [draft.bill]);

  const payNow = payNowOf(draft.members);
  const mismatch = mismatchOf(draft.total, draft.members);
  const canSubmit = draft.total > 0 && (draft.mode !== 'manual' || mismatch === 0);

  const nameOf = (id: string) => (id === ME ? t('home.me') : (home.contactById(id)?.name ?? '?'));
  const chosen = new Set(draft.members.map((m) => m.contactId));
  const rest = (home.db?.contacts ?? []).filter((c) => !chosen.has(c.id));

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const split = await createSplit(
        {
        total: draft.total,
        title: draft.title || t('members.defaultTitle'),
        mode: draft.mode,
        merchantId: draft.merchantId,
        members: draft.members.map((m) => ({
          contactId: m.contactId,
          amount: m.amount,
          debt: !!m.debt,
        })),
        },
        home.db?.contacts ?? [],
      );
      await qc.invalidateQueries({ queryKey: qk.bootstrap });
      draft.reset();
      nav.replace('Share', { id: split.id });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 150 }}>
        <PressableScale small style={[styles.back, { backgroundColor: colors.sand }]} onPress={() => nav.goBack()}>
          <Text style={[styles.backGlyph, { color: colors.ink }]}>←</Text>
        </PressableScale>

        <Text style={[styles.title, { color: colors.ink }]}>{t('members.title')}</Text>

        <View style={styles.totalRow}>
          <Text style={[styles.total, { color: colors.ink }]}>{money(draft.total)}</Text>
          <Text style={[styles.currency, { color: colors.faint }]}>{t('common.currency')}</Text>
        </View>

        <View style={[styles.forWhat, { borderBottomColor: fixed.lime }]}>
          <Text style={[styles.forWhatLabel, { color: colors.muted }]}>{t('members.forWhat')}</Text>
          <TextInput
            value={draft.title}
            onChangeText={draft.setTitle}
            placeholder={t('members.forWhatPlaceholder')}
            placeholderTextColor={colors.faint}
            style={[styles.forWhatInput, { color: colors.ink }]}
          />
        </View>

        <Text style={[styles.perPerson, { color: colors.muted }]}>
          {t('members.perPerson', { amount: money(Math.round(draft.total / Math.max(1, draft.members.length))) })}
        </Text>

        <View style={styles.modeRow}>
          {modes.map((m) => {
            const active = draft.mode === m.value;
            return (
              <PressableScale
                key={m.value}
                style={[styles.mode, { backgroundColor: active ? fixed.lime : colors.sand }]}
                onPress={() => draft.setMode(m.value)}
              >
                <Text style={[styles.modeText, { color: active ? '#111110' : colors.slate }]}>{t(m.label)}</Text>
              </PressableScale>
            );
          })}
        </View>

        <View style={styles.list}>
          {draft.members.map((m, i) => (
            <Animated.View key={m.contactId} entering={FadeInDown.delay(i * 40)} layout={LinearTransition.springify()}>
              <View style={styles.memberRow}>
                <Avatar
                  name={nameOf(m.contactId)}
                  letter={home.contactById(m.contactId)?.initials}
                  color={m.contactId === ME ? '#111110' : (home.contactById(m.contactId)?.color ?? '#3E3C35')}
                  size={44}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.memberName, { color: colors.ink }]}>
                    {nameOf(m.contactId)}
                    {m.contactId === ME ? t('members.youSuffix') : ''}
                  </Text>
                  <PressableScale onPress={() => draft.toggleDebt(m.contactId)} disabled={m.contactId === ME}>
                    <Text style={[styles.memberSub, { color: m.debt ? colors.ember : colors.faint }]}>
                      {m.contactId === ME
                        ? t('members.youPayNow')
                        : m.debt
                          ? t('members.debtNote')
                          : t('members.debtToggle')}
                    </Text>
                  </PressableScale>
                </View>

                {draft.mode === 'manual' && m.contactId !== ME ? (
                  <TextInput
                    value={String(m.amount || '')}
                    onChangeText={(v) => draft.setMemberAmount(m.contactId, Number(v.replace(/\D/g, '') || 0))}
                    keyboardType="number-pad"
                    style={[styles.amountInput, { color: colors.ink, backgroundColor: colors.sand }]}
                  />
                ) : (
                  <Text style={[styles.memberAmount, { color: colors.ink }]}>{money(m.amount)}</Text>
                )}

                {m.contactId !== ME ? (
                  <PressableScale small onPress={() => draft.toggleMember(m.contactId)}>
                    <Text style={[styles.remove, { color: colors.faint }]}>✕</Text>
                  </PressableScale>
                ) : null}
              </View>
            </Animated.View>
          ))}
        </View>

        {draft.mode === 'manual' && mismatch !== 0 ? (
          <Text style={[styles.mismatch, { color: colors.danger }]}>
            {mismatch > 0
              ? t('members.sumOver', { amount: money(Math.abs(mismatch)) })
              : t('members.sumMismatch', { amount: money(Math.abs(mismatch)) })}
          </Text>
        ) : null}

        <View style={styles.addHead}>
          <Text style={[styles.addLabel, { color: colors.faint2 }]}>{t('members.addAction')}</Text>
          <PressableScale onPress={() => setContactsOpen(true)}>
            <Text style={[styles.allContacts, { color: colors.muted }]}>{t('members.allContacts')} ›</Text>
          </PressableScale>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
          {rest.slice(0, 8).map((c) => (
            <PressableScale key={c.id} style={styles.quick} onPress={() => draft.toggleMember(c.id)}>
              <Avatar name={c.name} letter={c.initials} color={c.color} size={54} />
              <Text style={[styles.quickName, { color: colors.muted }]} numberOfLines={1}>{c.name}</Text>
            </PressableScale>
          ))}
        </ScrollView>
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: insets.bottom + 16, backgroundColor: colors.cream }]}>
        <PressableScale
          disabled={!canSubmit || busy}
          style={[styles.ctaBtn, { backgroundColor: fixed.lime }, (!canSubmit || busy) && styles.disabled]}
          onPress={() => setPinOpen(true)}
        >
          <Text style={styles.ctaText}>{t('members.ctaSplit', { amount: money(payNow) })}</Text>
        </PressableScale>
        <Text style={[styles.ctaSub, { color: colors.muted }]}>
          {t('members.ctaSub', { mine: money(draft.members.find((m) => m.contactId === ME)?.amount ?? 0) })}
        </Text>
      </View>

      <BottomSheet open={contactsOpen} onClose={() => setContactsOpen(false)}>
        <Text style={[styles.sheetTitle, { color: colors.ink }]}>{t('members.contactsTitle')}</Text>
        <ScrollView style={styles.sheetList}>
          {rest.map((c) => (
            <PressableScale
              key={c.id}
              style={styles.sheetRow}
              onPress={() => {
                draft.toggleMember(c.id);
                setContactsOpen(false);
              }}
            >
              <Avatar name={c.name} letter={c.initials} color={c.color} size={40} />
              <Text style={[styles.sheetName, { color: colors.ink }]}>{c.name}</Text>
              {c.handle ? <Text style={[styles.sheetHandle, { color: colors.faint }]}>{c.handle}</Text> : null}
            </PressableScale>
          ))}
        </ScrollView>
      </BottomSheet>

      <PinSheet
        open={pinOpen}
        hint={t('members.pinHint', { amount: money(payNow) })}
        onClose={() => setPinOpen(false)}
        onConfirm={() => {
          setPinOpen(false);
          void submit();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 20 },
  back: { width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  backGlyph: { fontSize: 20, fontFamily: font.bold },
  title: { fontFamily: font.extrabold, fontSize: 27, letterSpacing: -0.8, marginTop: 18 },
  totalRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 10 },
  total: { fontFamily: font.extrabold, fontSize: 44, letterSpacing: -1.6 },
  currency: { fontFamily: font.monoBold, fontSize: 12, marginBottom: 9 },
  forWhat: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 2, paddingBottom: 8, marginTop: 14 },
  forWhatLabel: { fontFamily: font.semibold, fontSize: 15 },
  forWhatInput: { flex: 1, fontFamily: font.bold, fontSize: 16, padding: 0 },
  perPerson: { fontFamily: font.semibold, fontSize: 13, marginTop: 10 },
  modeRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  mode: { height: 40, paddingHorizontal: 18, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  modeText: { fontFamily: font.bold, fontSize: 13.5 },
  list: { marginTop: 18, gap: 4 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  memberName: { fontFamily: font.bold, fontSize: 15 },
  memberSub: { fontFamily: font.semibold, fontSize: 12.5, marginTop: 2 },
  memberAmount: { fontFamily: font.extrabold, fontSize: 15 },
  amountInput: { width: 104, height: 40, borderRadius: 12, paddingHorizontal: 10, fontFamily: font.bold, fontSize: 15, textAlign: 'right' },
  remove: { fontSize: 15, paddingHorizontal: 4 },
  mismatch: { fontFamily: font.semibold, fontSize: 13, marginTop: 8 },
  addHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22 },
  addLabel: { fontFamily: font.monoBold, fontSize: 10, letterSpacing: 1.6 },
  allContacts: { fontFamily: font.bold, fontSize: 13 },
  quickRow: { gap: 14, paddingTop: 12, paddingRight: 20 },
  quick: { alignItems: 'center', gap: 6, width: 60 },
  quickName: { fontFamily: font.semibold, fontSize: 11.5 },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12 },
  ctaBtn: { height: 58, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: font.extrabold, fontSize: 16, color: '#111110' },
  ctaSub: { fontFamily: font.semibold, fontSize: 12.5, textAlign: 'center', marginTop: 8 },
  disabled: { opacity: 0.4 },
  sheetTitle: { fontFamily: font.extrabold, fontSize: 16, textAlign: 'center', marginBottom: 12 },
  sheetList: { maxHeight: 420 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  sheetName: { flex: 1, fontFamily: font.bold, fontSize: 15 },
  sheetHandle: { fontFamily: font.semibold, fontSize: 12.5 },
});
