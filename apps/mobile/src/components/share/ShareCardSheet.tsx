// Показ карточки «ZAP COMPLETE» перед отправкой.
//
// Человек должен увидеть, ЧТО он выкладывает, — иначе он не выложит.
// Поэтому сначала предпросмотр во весь экран, и только потом системный шеринг.
//
// Карточка всегда рисуется в своей логической раскладке (CARD_W × CARD_H) и
// лишь визуально ужимается под экран через scale: снимок должен уходить в
// исходном формате 9:16, независимо от того, какой телефон у пользователя.
import React, { useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '@/components/PressableScale';
import { toast } from '@/components/ToastHost';
import { CARD_H, CARD_W, CAPTURE_SCALE, ShareCard, type ShareMember } from '@/components/share/ShareCard';
import { cue, reduceMotion } from '@/lib/feedback';
import { canCaptureCard, shareCardImage } from '@/lib/shareCard';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';
import type { ImageSourcePropType } from 'react-native';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  total: number;
  members: ShareMember[];
  code: string;
  merchantLogo?: ImageSourcePropType;
}

export function ShareCardSheet({ open, onClose, title, total, members, code, merchantLogo }: Props) {
  const { t } = useTranslation();
  const { colors, fixed } = useTheme();
  const { width, height } = useWindowDimensions();
  // ссылка на реальный нативный узел — её и снимает view-shot
  const cardRef = useRef<ComponentRef<typeof View>>(null);
  const [busy, setBusy] = useState(false);

  // вписываем карточку в экран, оставляя место под кнопки
  const scale = Math.min((width - 48) / CARD_W, (height - 210) / CARD_H);

  const send = async () => {
    if (busy) return;
    setBusy(true);
    try {
      cue('share');
      await shareCardImage({
        cardRef,
        width: CARD_W * CAPTURE_SCALE,
        height: CARD_H * CAPTURE_SCALE,
        code,
        title,
      });
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : t('live.shareFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={open} animationType="fade" transparent onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: colors.cream }]}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />

        <Animated.View
          entering={reduceMotion() ? undefined : FadeIn.duration(220)}
          style={[styles.stage, { width: CARD_W * scale, height: CARD_H * scale }]}
        >
          {/* карточка живёт в своём размере; на экран её ужимает только scale */}
          <View style={[styles.cardWrap, { transform: [{ scale }] }]} collapsable={false}>
            <View ref={cardRef} collapsable={false}>
              <ShareCard
                title={title}
                total={total}
                members={members}
                code={code}
                merchantLogo={merchantLogo}
              />
            </View>
          </View>
        </Animated.View>

        <Animated.View
          entering={reduceMotion() ? undefined : FadeInDown.delay(120).duration(260)}
          style={styles.actions}
        >
          <PressableScale
            primary
            disabled={busy}
            style={[styles.cta, { backgroundColor: fixed.ink }, busy && styles.dim]}
            onPress={() => void send()}
          >
            <Text style={[styles.ctaText, { color: fixed.lime }]}>{t('shareCard.share')}</Text>
          </PressableScale>

          <PressableScale style={styles.ghost} onPress={onClose}>
            <Text style={[styles.ghostText, { color: colors.muted }]}>{t('common.close')}</Text>
          </PressableScale>

          {!canCaptureCard() ? (
            // честно предупреждаем: без нативного модуля уйдёт ссылка, не картинка
            <Text style={[styles.note, { color: colors.faint2 }]}>{t('shareCard.linkOnly')}</Text>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  stage: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 22 },
  // обёртка нужна, чтобы scale не влиял на размер, который займёт stage
  cardWrap: { position: 'absolute', width: CARD_W, height: CARD_H },
  actions: { marginTop: 20, alignItems: 'center', gap: 6, width: '100%', paddingHorizontal: 24 },
  cta: { height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  ctaText: { fontFamily: font.extrabold, fontSize: 16 },
  dim: { opacity: 0.5 },
  ghost: { height: 46, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontFamily: font.bold, fontSize: 15 },
  note: { fontFamily: font.semibold, fontSize: 12, textAlign: 'center' },
});
