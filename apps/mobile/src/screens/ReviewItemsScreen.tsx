// Проверка позиций фискального/OCR-чека — порт ReviewItemsPage.vue:
// правка названия и суммы, степпер количества, удаление, добавление,
// живой индикатор «сумма позиций vs итог чека».
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PressableScale } from '@/components/PressableScale';
import { BottomSheet } from '@/components/BottomSheet';
import { useDraft } from '@/store/draft';
import { money } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { SCREEN_PAD_X, font } from '@/theme/tokens';

interface EditItem {
  id: string;
  title: string;
  qty: number;
  amount: number;
}

let addSeq = 0;

export function ReviewItemsScreen() {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();

  const nav = useNavigation<any>();
  const draft = useDraft();

  // как в вебе: без фискального чека проверять нечего
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

  const [items, setItems] = useState<EditItem[]>(
    (draft.bill?.items ?? []).map((i) => ({ id: i.id, title: i.title, qty: i.qty, amount: i.amount })),
  );
  const isOcr = draft.fiscal?.ocr === true;
  const receiptTotal = draft.fiscal?.receiptTotal ?? draft.bill?.total ?? 0;
  const itemsSum = useMemo(() => items.reduce((s, i) => s + i.amount, 0), [items]);
  const diff = itemsSum - receiptTotal;

  const stepQty = (id: string, delta: number) => {
    setItems((list) =>
      list.map((item) => {
        if (item.id !== id) return item;
        if (delta < 0 && item.qty <= 1) return item;
        const perUnit = item.qty > 0 ? item.amount / item.qty : item.amount;
        const next = Math.max(1, item.qty + delta);
        return { ...item, qty: next, amount: Math.round(perUnit * next) };
      }),
    );
  };

  // правка позиции (имя + сумма) в шите
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');

  const openEdit = (item: EditItem) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditAmount(String(item.amount || ''));
  };

  const commitEdit = () => {
    setItems((list) =>
      list.map((item) =>
        item.id === editingId
          ? {
              ...item,
              title: editTitle.trim() || item.title,
              amount: Number(editAmount || '0') || item.amount,
            }
          : item,
      ),
    );
    setEditingId(null);
  };

  const addItem = () => {
    const it: EditItem = { id: `new_${++addSeq}_${Date.now().toString(36)}`, title: '', qty: 1, amount: 0 };
    setItems((list) => [...list, it]);
    openEdit(it);
  };

  const proceed = () => {
    draft.applyFiscalItems(
      {
        merchant: draft.fiscal?.merchant,
        total: itemsSum,
        items: items.filter((i) => i.title && i.amount > 0).map((i) => ({ id: i.id, name: i.title, qty: i.qty, amount: i.amount })),
      },
      isOcr,
    );
    nav.navigate('Members');
  };

  return (
    <Screen style={styles.root}>
      <ScreenHeader />

      <Text style={[styles.title, { color: colors.ink }]}>{t('review.title')}</Text>
      {isOcr ? (
        <View style={[styles.ocrNote, { backgroundColor: 'rgba(221,255,51,0.25)' }]}>
          <Text style={[styles.ocrText, { color: colors.ink }]}>📷 {t('review.fromPhoto')}</Text>
        </View>
      ) : (
        <Text style={[styles.sub, { color: colors.muted }]}>{t('review.fromReceipt')}</Text>
      )}

      <ScrollView showsVerticalScrollIndicator={false} style={styles.flex} contentContainerStyle={{ paddingBottom: 12 }}>
        {items.map((item, i) => (
          <Animated.View
            key={item.id}
            entering={FadeInDown.delay(Math.min(i, 8) * 30)}
            layout={LinearTransition.springify()}
            style={[styles.itemRow, { borderBottomColor: colors.sand2 }]}
          >
            <PressableScale haptic={false} style={styles.itemBody} onPress={() => openEdit(item)}>
              <Text style={[styles.itemTitle, { color: colors.ink }]} numberOfLines={1}>
                {item.title || t('review.untitled')}
              </Text>
              <Text style={[styles.itemSub, { color: colors.faint }]}>{money(item.amount)} UZS</Text>
            </PressableScale>
            <View style={styles.stepper}>
              <PressableScale small style={[styles.stepBtn, { backgroundColor: colors.sand }]} onPress={() => stepQty(item.id, -1)}>
                <Text style={[styles.stepGlyph, { color: colors.ink }]}>−</Text>
              </PressableScale>
              <Text style={[styles.qty, { color: colors.ink }]}>{item.qty}</Text>
              <PressableScale small style={[styles.stepBtn, { backgroundColor: colors.sand }]} onPress={() => stepQty(item.id, 1)}>
                <Text style={[styles.stepGlyph, { color: colors.ink }]}>+</Text>
              </PressableScale>
            </View>
            <PressableScale
              small
              accessibilityLabel={t('common.removeAria')}
              style={styles.removeBtn}
              onPress={() => setItems((list) => list.filter((x) => x.id !== item.id))}
            >
              <Text style={[styles.removeGlyph, { color: colors.muted }]}>✕</Text>
            </PressableScale>
          </Animated.View>
        ))}
        <PressableScale haptic={false} style={styles.addRow} onPress={addItem}>
          <View style={[styles.addIcon, { backgroundColor: colors.sand }]}>
            <Text style={[styles.addGlyph, { color: colors.ink }]}>+</Text>
          </View>
          <Text style={[styles.addText, { color: colors.muted }]}>{t('review.addItem')}</Text>
        </PressableScale>
      </ScrollView>

      <View style={{ paddingBottom: 10 }}>
        <View style={[styles.indicator, { backgroundColor: diff === 0 ? 'rgba(221,255,51,0.25)' : colors.shell }]}>
          <Text style={[styles.indicatorText, { color: diff === 0 ? colors.ink : colors.muted }]}>
            {diff === 0
              ? `✓ ${t('review.matches')}`
              : t('review.diff', { sign: diff > 0 ? '+' : '−', amount: money(Math.abs(diff)) })}
          </Text>
          <Text style={[styles.indicatorSum, { color: colors.ink }]}>{money(itemsSum)}</Text>
        </View>
        <PressableScale
          disabled={!items.length || itemsSum <= 0}
          style={[styles.cta, { backgroundColor: fixed.lime }, (!items.length || itemsSum <= 0) && styles.disabled]}
          onPress={proceed}
        >
          <Text style={styles.ctaDark}>{t('review.continueWith', { amount: money(itemsSum) })}</Text>
        </PressableScale>
      </View>

      {/* правка позиции */}
      <BottomSheet open={Boolean(editingId)} onClose={commitEdit}>
        <Text style={[styles.sheetTitle, { color: colors.ink }]}>{t('review.itemTitle')}</Text>
        <TextInput
          value={editTitle}
          onChangeText={setEditTitle}
          placeholder={t('review.namePlaceholder')}
          placeholderTextColor={colors.faint}
          style={[styles.editName, { color: colors.ink, borderBottomColor: fixed.lime }]}
          selectionColor={fixed.lime}
          autoFocus
        />
        <Text style={[styles.amountLabel, { color: colors.faint2 }]}>{t('review.amountLabel')}</Text>
        <TextInput
          value={editAmount}
          onChangeText={(v) => setEditAmount(v.replace(/\D/g, '').slice(0, 9))}
          keyboardType="number-pad"
          style={[styles.editAmount, { color: colors.ink }]}
          selectionColor={fixed.lime}
        />
        <PressableScale style={[styles.sheetCta, { backgroundColor: colors.ink }]} onPress={commitEdit}>
          <Text style={[styles.sheetCtaText, { color: colors.cream }]}>{t('common.done')}</Text>
        </PressableScale>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: SCREEN_PAD_X },
  flex: { flex: 1, marginTop: 14 },
  title: { fontFamily: font.extrabold, fontSize: 25, letterSpacing: -0.3, marginTop: 22 },
  ocrNote: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, marginTop: 12 },
  ocrText: { fontFamily: font.bold, fontSize: 12.5 },
  sub: { fontFamily: font.semibold, fontSize: 13, marginTop: 6 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, borderBottomWidth: 1 },
  itemBody: { flex: 1, paddingVertical: 8, gap: 1 },
  itemTitle: { fontFamily: font.bold, fontSize: 14.5 },
  itemSub: { fontFamily: font.semibold, fontSize: 11.5 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: { width: 32, height: 32, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  stepGlyph: { fontFamily: font.bold, fontSize: 15 },
  qty: { fontFamily: font.monoBold, fontSize: 12.5, minWidth: 30, textAlign: 'center' },
  removeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  removeGlyph: { fontSize: 13 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, marginTop: 12 },
  addIcon: { width: 28, height: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  addGlyph: { fontFamily: font.bold, fontSize: 14 },
  addText: { fontFamily: font.bold, fontSize: 13.5 },
  indicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14 },
  indicatorText: { fontFamily: font.bold, fontSize: 13, flexShrink: 1 },
  indicatorSum: { fontFamily: font.monoBold, fontSize: 14 },
  cta: { height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  ctaDark: { fontFamily: font.extrabold, fontSize: 16, color: '#121212' },
  disabled: { opacity: 0.4 },
  sheetTitle: { fontFamily: font.extrabold, fontSize: 15, textAlign: 'center' },
  editName: { borderBottomWidth: 2, paddingBottom: 10, fontFamily: font.bold, fontSize: 16, marginTop: 16 },
  amountLabel: { fontFamily: font.monoBold, fontSize: 10, letterSpacing: 1.6, textAlign: 'center', marginTop: 16 },
  editAmount: { fontFamily: font.extrabold, fontSize: 26, textAlign: 'center', padding: 0, marginTop: 4 },
  sheetCta: { height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  sheetCtaText: { fontFamily: font.bold, fontSize: 15 },
});
