// Лента жизни на главной (vision, часть C §2) — макет «A»: один человек —
// одна карточка.
//
// Требующее действия — белая карточка с лаймовым кантом: лицо, имя, крупная
// сумма и кнопка действия прямо в карточке («⚡ Напомнить» бьёт по долгам в
// один тап, «Оплатить» открывает счёт). Информационное — лёгкая строка без
// коробки: «✓ Umumiy hisob · bugun yopildi». Так глаз мгновенно отличает
// «здесь нужны деньги» от «просто новость».
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/Avatar';
import { PressableScale } from '@/components/PressableScale';
import type { ActivityItem } from '@/lib/activity';
import { reduceMotion } from '@/lib/feedback';
import { money } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

interface Props {
  items: ActivityItem[];
  colorOf: (contactId: string) => string;
  initialsOf: (contactId: string) => string | undefined;
  nameOf: (contactId: string) => string;
  /** тап по карточке/строке — навигация */
  onPress: (item: ActivityItem) => void;
  /** кнопка внутри карточки: напомнить / оплатить */
  onAction: (item: ActivityItem) => void;
}

export function ActivityFeed({ items, colorOf, initialsOf, nameOf, onPress, onAction }: Props) {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();

  if (!items.length) return null;

  const cards = items.filter((it) => it.actionable);
  const notes = items.filter((it) => !it.actionable);

  return (
    <View style={styles.root}>
      {cards.map((it, i) => (
        <Animated.View
          key={it.id}
          entering={reduceMotion() ? undefined : FadeInDown.delay(Math.min(i, 3) * 60).duration(280)}
        >
          <PressableScale
            style={[styles.card, { backgroundColor: colors.paper }]}
            onPress={() => onPress(it)}
            accessibilityRole="button"
          >
            <View style={[styles.accent, { backgroundColor: fixed.lime }]} />

            <View style={styles.cardTop}>
              {it.contactId ? (
                <Avatar
                  name={nameOf(it.contactId)}
                  letter={initialsOf(it.contactId)}
                  contactId={it.contactId}
                  color={colorOf(it.contactId)}
                  size={46}
                />
              ) : (
                <View style={[styles.glyphBox, { backgroundColor: colors.sand }]}>
                  <Text style={styles.glyphBig}>{it.glyph}</Text>
                </View>
              )}

              <View style={styles.body}>
                <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>
                  {it.title}
                </Text>
                {it.amount !== undefined ? (
                  <Text style={[styles.amount, { color: colors.ink }]} numberOfLines={1}>
                    {money(it.amount)}
                  </Text>
                ) : null}
              </View>

              {/* действие в один тап, не открывая карточку */}
              <PressableScale
                small
                style={[styles.pill, { backgroundColor: fixed.ink }]}
                onPress={() => onAction(it)}
                accessibilityRole="button"
              >
                <Text style={[styles.pillText, { color: fixed.lime }]}>
                  {it.kind === 'waitingForYou' ? `⚡ ${t('activity.remind')}` : t('activity.pay')}
                </Text>
              </PressableScale>
            </View>

            {/* подпись во всю ширину: в узкой колонке она обрезалась на полуслове */}
            <Text style={[styles.caption, { color: colors.muted }]} numberOfLines={1}>
              {t(it.captionKey, it.captionParams)}
            </Text>
          </PressableScale>
        </Animated.View>
      ))}

      {notes.length ? (
        <View style={styles.notes}>
          {notes.map((it, i) => (
            <Animated.View
              key={it.id}
              entering={
                reduceMotion() ? undefined : FadeInDown.delay((cards.length + Math.min(i, 3)) * 60).duration(280)
              }
            >
              <PressableScale style={styles.note} onPress={() => onPress(it)} accessibilityRole="button">
                {it.contactId ? (
                  <Avatar
                    name={nameOf(it.contactId)}
                    letter={initialsOf(it.contactId)}
                    contactId={it.contactId}
                    color={colorOf(it.contactId)}
                    size={24}
                  />
                ) : (
                  <Text style={[styles.noteGlyph, { color: '#6EA03C' }]}>{it.glyph}</Text>
                )}
                <Text style={styles.noteText} numberOfLines={1}>
                  <Text style={[styles.noteTitle, { color: colors.ink }]}>{it.title}</Text>
                  <Text style={{ color: colors.muted }}>
                    {'  ·  '}
                    {t(it.captionKey, it.captionParams)}
                  </Text>
                </Text>
              </PressableScale>
            </Animated.View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12, marginTop: 18, marginBottom: 6 },
  card: {
    gap: 8,
    paddingLeft: 18,
    paddingRight: 14,
    paddingVertical: 14,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#1E1C10',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  glyphBox: { width: 46, height: 46, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  glyphBig: { fontSize: 20 },
  body: { flex: 1, minWidth: 0, gap: 1 },
  name: { fontFamily: font.extrabold, fontSize: 16, letterSpacing: -0.2 },
  amount: { fontFamily: font.monoBold, fontSize: 23, letterSpacing: -0.8, marginTop: 1 },
  caption: { fontFamily: font.semibold, fontSize: 12.5, paddingLeft: 59 },
  pill: { height: 38, paddingHorizontal: 15, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontFamily: font.bold, fontSize: 13 },

  notes: { gap: 13, marginTop: 10, marginBottom: 8, paddingHorizontal: 6 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  noteGlyph: { fontFamily: font.extrabold, fontSize: 15, width: 24, textAlign: 'center' },
  noteText: { flex: 1, fontFamily: font.semibold, fontSize: 13.5 },
  noteTitle: { fontFamily: font.bold },
});
