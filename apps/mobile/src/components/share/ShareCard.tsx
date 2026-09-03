// Карточка «ZAP COMPLETE» — то, что человек кидает в сторис (vision, часть B §7).
//
// Раскладка «лаймовый блок»: верхняя треть — сплошной лайм с названием и
// суммой чернилами, ниже — чёрное поле с итогом, лицами и брендом.
//
// Почему так: карточка живёт в чужой ленте, среди чужих сторис. Сплошной
// лаймовый блок узнаётся с расстояния вытянутой руки, а сумма чернилами по
// лайму — самый контрастный элемент, который у нас есть. Предыдущие варианты
// (тёмный лист с подсветкой) в ленте терялись.
//
// Формат один — вертикаль 9:16 под Instagram Stories. Раскладка описана в
// CARD_W × CARD_H (dp), а снимается в 1080×1920: view-shot рендерит узел в
// битмап нужного размера, то есть текст остаётся чётким, это не апскейл.
import React from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/Avatar';
import { STICKER, type StickerKey } from '@/components/EmptyState';
import { money } from '@/lib/format';
import { receiptTitle } from '@/lib/merchant';
import { splitUrl } from '@/lib/share';
import { fixedPalette, font } from '@/theme/tokens';

/** Логическая раскладка карточки; снимок делается втрое крупнее. */
export const CARD_W = 360;
export const CARD_H = 640;
export const CAPTURE_SCALE = 3; // 1080 × 1920

/** Где лаймовый блок сменяется чёрным. */
const SPLIT_Y = 300;

/** Участник в том виде, в каком карточке он нужен. */
export interface ShareMember {
  contactId: string;
  name: string;
  initials?: string;
  color: string;
  paid: boolean;
}

interface Props {
  title: string;
  total: number;
  members: ShareMember[];
  /** код сплита — из него собирается ссылка внизу карточки */
  code: string;
  merchantLogo?: ImageSourcePropType;
  /** акцент в нижнем углу; по умолчанию — празднующий чек */
  sticker?: StickerKey;
}

const WORDMARK = require('../../../assets/brand/zap-wordmark-large.png');

/** Сколько лиц показываем; остальные сворачиваются в «+N». */
const FACES = 4;
const FACE = 54;

/**
 * Что писать в кружке, если имени нет.
 *
 * Avatar по умолчанию рисует «?», и на постере это читается как ошибка
 * вёрстки. Вместо знака вопроса ставим молнию: участник есть, имени пока нет.
 */
function faceLetter(m: ShareMember): string | undefined {
  const n = m.name.trim();
  if (!n || n === '?') return '⚡';
  return m.initials;
}

export function ShareCard({ title, total, members, code, merchantLogo, sticker = 'paidDone' }: Props) {
  const { t } = useTranslation();
  const shown = members.slice(0, FACES);
  const rest = members.length - shown.length;

  return (
    <View style={styles.root}>
      {/* ── лаймовый блок ── */}
      <View style={styles.lime}>
        <Text style={styles.kicker}>{t('shareCard.kicker')}</Text>

        <View style={styles.merchantRow}>
          {merchantLogo ? <Image source={merchantLogo} style={styles.logo} resizeMode="cover" /> : null}
          <Text style={styles.merchant} numberOfLines={2}>
            {receiptTitle(title)}
          </Text>
        </View>

        <View style={styles.totalWrap}>
          <Text style={styles.total} numberOfLines={1} adjustsFontSizeToFit>
            {money(total)}
          </Text>
          <Text style={styles.currency}>UZS</Text>
        </View>
      </View>

      {/* ── чёрное поле ── */}
      <View style={styles.dark}>
        <Text style={styles.payoff}>{t('shareCard.allPaid')}</Text>
        <Text style={styles.people}>{t('shareCard.friends', { n: members.length })}</Text>

        <View style={styles.faces}>
          {shown.map((m, i) => (
            <View key={m.contactId + i} style={i ? styles.faceStacked : undefined}>
              <Avatar
                name={m.name}
                letter={faceLetter(m)}
                contactId={m.contactId}
                color={m.color}
                size={FACE}
                solid
                ring={m.paid ? fixedPalette.lime : 'rgba(255,255,255,0.22)'}
                ringWidth={3}
              />
            </View>
          ))}
          {rest > 0 ? (
            <View style={[styles.more, styles.faceStacked]}>
              <Text style={styles.moreText}>+{rest}</Text>
            </View>
          ) : null}
        </View>

        {/* стикер-акцент в свободном правом углу, не поверх содержимого */}
        <Image source={STICKER[sticker]} style={styles.sticker} resizeMode="contain" />

        <View style={styles.footer}>
          <Image source={WORDMARK} style={styles.wordmark} resizeMode="contain" />
          <Text style={styles.handle}>{splitUrl(code).replace(/^https?:\/\//, '')}</Text>
        </View>
      </View>
    </View>
  );
}

const PAD = 30;

const styles = StyleSheet.create({
  root: { width: CARD_W, height: CARD_H, backgroundColor: fixedPalette.ink, overflow: 'hidden' },

  lime: {
    height: SPLIT_Y,
    backgroundColor: fixedPalette.lime,
    paddingHorizontal: PAD,
    paddingTop: 52,
  },
  kicker: { fontFamily: font.extrabold, fontSize: 13, letterSpacing: 2.6, color: fixedPalette.ink },
  merchantRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22 },
  logo: { width: 34, height: 34, borderRadius: 11 },
  merchant: { flex: 1, fontFamily: font.extrabold, fontSize: 24, lineHeight: 28, letterSpacing: -0.5, color: fixedPalette.ink },
  totalWrap: { marginTop: 'auto', paddingBottom: 26 },
  total: { fontFamily: font.monoBold, fontSize: 54, lineHeight: 58, letterSpacing: -2.4, color: fixedPalette.ink },
  // приглушённые чернила по лайму: «UZS» не должен спорить с суммой
  currency: { fontFamily: font.semibold, fontSize: 15, color: 'rgba(18,18,18,0.55)', marginTop: 4 },

  dark: { flex: 1, paddingHorizontal: PAD, paddingTop: 34, paddingBottom: 26 },
  payoff: { fontFamily: font.extrabold, fontSize: 19, letterSpacing: -0.3, color: '#FFFFFF' },
  people: { fontFamily: font.semibold, fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 10 },
  faces: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  faceStacked: { marginLeft: -12 },
  more: {
    width: FACE,
    height: FACE,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: { fontFamily: font.extrabold, fontSize: 15, color: '#FFFFFF' },

  sticker: { position: 'absolute', right: 18, bottom: 74, width: 116, height: 100 },

  footer: { marginTop: 'auto', gap: 6 },
  wordmark: { width: 80, height: 52, marginLeft: -3 },
  handle: { fontFamily: font.monoBold, fontSize: 11.5, letterSpacing: 1, color: 'rgba(255,255,255,0.42)' },
});
