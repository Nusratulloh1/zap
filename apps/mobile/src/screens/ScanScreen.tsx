// Сканер — порт ScanPage.vue (дизайн 3d) на react-native-vision-camera:
// живая камера, MLKit-сканер QR, режим «фото» (снимок → Gemini OCR),
// фонарик, лаймовая рамка. Без доступа к камере — карточка с ручным вводом.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar, ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { trigger } from 'react-native-haptic-feedback';
import { PressableScale } from '@/components/PressableScale';
import { toast } from '@/components/ToastHost';
import Svg, { Defs, LinearGradient, Stop, Rect as SvgRect } from 'react-native-svg';
import { CloseIcon, BoltIcon } from '@/components/icons';
import { PartnerChips } from '@/components/PartnerChips';
import { resolveQr, fiscalOcr } from '@/api/actions';
import { useDraft } from '@/store/draft';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

export function ScanScreen() {
  const { t } = useTranslation();
  const { fixed } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const focused = useIsFocused();
  const draft = useDraft();

  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [mode, setMode] = useState<'scan' | 'photo'>('scan');
  const [torch, setTorch] = useState(false);
  const camera = useRef<Camera>(null);
  const stopped = useRef(false);
  const [ocrBusy, setOcrBusy] = useState(false);

  useEffect(() => {
    if (!hasPermission) void requestPermission();
  }, [hasPermission, requestPermission]);

  // лазерная полоска в рамке — бегает вверх-вниз, пока идёт скан
  const laser = useSharedValue(0);
  useEffect(() => {
    laser.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [laser]);
  const laserStyle = useAnimatedStyle(() => ({ transform: [{ translateY: laser.value * 200 }] }));

  /** Классификация QR: сплит / счёт / фискальный чек / неизвестное. */
  const routePayload = useCallback(
    async (payload: string) => {
      const m = payload.match(/\/s\/([\w-]+)/i);
      if (m) {
        nav.replace('Participant', { code: m[1] });
        return;
      }
      try {
        const res = await resolveQr(payload);
        if (res.type === 'split') {
          nav.replace('Participant', { code: res.code });
          return;
        }
        if (res.type === 'bill') {
          draft.startForBill(res.bill, res.bill.merchantId);
          toast.success(t('scan.qrDetected'));
          nav.replace('Bill');
          return;
        }
        if (res.type === 'fiscal') {
          // узбекский QR не несёт суммы — экран чека в состоянии загрузки
          draft.startFiscal(res.instant.totalAmount ?? 0, res.jobId, payload);
          nav.replace('Bill');
          return;
        }
      } catch {
        /* сеть упала — ведём как unknown */
      }
      if (/^https?:\/\//i.test(payload.trim())) {
        // неизвестный чек (Rahmat и пр.) → фотографируем и распознаём с фото
        toast(t('scan.receiptUnknown'));
        stopped.current = false;
        setMode('photo');
      } else {
        toast(t('scan.qrUnknown'));
        nav.replace('Tabs', { screen: 'Amount' });
      }
    },
    [draft, nav, t],
  );

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      if (stopped.current || mode !== 'scan') return;
      const value = codes[0]?.value;
      if (!value) return;
      stopped.current = true;
      trigger('impactMedium', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
      setTimeout(() => void routePayload(value), 250);
    },
  });

  /** Снимок кадра → Gemini OCR → проверка позиций / сумма / честная ошибка. */
  const capturePhoto = async () => {
    if (!camera.current || ocrBusy) return;
    setOcrBusy(true);
    try {
      const photo = await camera.current.takePhoto({ flash: torch ? 'on' : 'off' });
      const res = await fiscalOcr('file://' + photo.path);
      const receipt = res.receipt;
      if (receipt && (receipt.items?.length || res.itemsRecognized)) {
        draft.startFiscal(receipt.total);
        draft.applyFiscalItems({ merchant: receipt.merchant, total: receipt.total, items: receipt.items }, true);
        toast.success(t('scan.photoOk'));
        nav.replace('ReviewItems');
      } else if (receipt && receipt.total > 0) {
        draft.startFiscal(receipt.total);
        draft.fiscalFailed();
        toast(t('scan.photoNoItems'));
        nav.replace('Members');
      } else {
        toast(t('scan.photoFailed'));
      }
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : t('scan.photoFailedShort'));
    } finally {
      setOcrBusy(false);
    }
  };

  const manualEntry = () => nav.replace('Tabs', { screen: 'Amount' });


  const cameraOk = hasPermission && device != null;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      {cameraOk ? (
        <Camera
          ref={camera}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          device={device}
          isActive={focused && !stopped.current}
          torch={torch ? 'on' : 'off'}
          photo={mode === 'photo'}
          codeScanner={mode === 'scan' ? codeScanner : undefined}
        />
      ) : null}
      {/* скримы-градиенты: подписи читаются, но кадр не обрезается полосами */}
      <Svg style={styles.scrimTop} height={150} width="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id="scanTop" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000000" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <SvgRect x={0} y={0} width="100%" height={150} fill="url(#scanTop)" />
      </Svg>
      <Svg style={styles.scrimBottom} height={230} width="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id="scanBottom" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000000" stopOpacity={0} />
            <Stop offset="0.5" stopColor="#000000" stopOpacity={0.35} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0.8} />
          </LinearGradient>
        </Defs>
        <SvgRect x={0} y={0} width="100%" height={230} fill="url(#scanBottom)" />
      </Svg>

      {/* верх: × · режимы · фонарик */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <PressableScale small style={styles.roundBtn} onPress={() => nav.goBack()}>
          <CloseIcon size={17} color="#FFFFFF" />
        </PressableScale>

        <View style={styles.modeSwitch}>
          {(['scan', 'photo'] as const).map((m) => (
            <PressableScale
              key={m}
              style={[styles.modeBtn, mode === m && { backgroundColor: fixed.lime }]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.modeText, { color: mode === m ? '#111110' : '#FFFFFF' }]}>
                {m === 'scan' ? t('scan.tabScan') : t('scan.tabPhoto')}
              </Text>
            </PressableScale>
          ))}
        </View>

        <PressableScale small style={styles.roundBtn} onPress={() => setTorch((v) => !v)}>
          <BoltIcon size={17} color="#FFFFFF" />
        </PressableScale>
      </View>

      {/* центр: рамка сканера / карточка «нет камеры» */}
      <View style={styles.centerZone}>
        {cameraOk && mode === 'scan' ? (
          <View style={styles.frame}>
            {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
              <View key={c} style={[styles.corner, cornerPos(c), { borderColor: fixed.lime }]} />
            ))}
            <Animated.View style={[styles.laser, { backgroundColor: 'rgba(221,255,51,0.6)' }, laserStyle]} />
          </View>
        ) : !cameraOk ? (
          <View style={styles.deniedCard}>
            <Text style={styles.deniedTitle}>{t('scan.noCamera')}</Text>
            <Text style={styles.deniedHint}>{t('scan.browserHint')}</Text>
            <Text style={styles.deniedOr}>{t('scan.orPhotoOrManual')}</Text>
            <View style={styles.deniedChips}>
              <PartnerChips />
            </View>
            <PressableScale
              style={[styles.deniedCta, { backgroundColor: fixed.lime }]}
              onPress={() => void Linking.openSettings()}
            >
              <Text style={styles.deniedCtaDark}>{t('scan.photographReceipt')}</Text>
            </PressableScale>
            <PressableScale style={[styles.deniedCta, styles.deniedGhost, styles.deniedGhostBorder]} onPress={manualEntry}>
              <Text style={styles.deniedCtaLight}>{t('scan.manual')}</Text>
            </PressableScale>
          </View>
        ) : null}
      </View>

      {/* низ: подпись · затвор (фото) · ручной ввод */}
      <View style={[styles.bottomZone, { paddingBottom: insets.bottom + 18 }]}>
        <Text style={styles.caption}>
          {!cameraOk ? t('scan.allowCamera') : mode === 'scan' ? t('scan.aimAtQr') : t('scan.photoTitle')}
        </Text>
        {cameraOk && mode === 'scan' ? <PartnerChips /> : null}
        {cameraOk && mode === 'photo' ? (
          <PressableScale
            disabled={ocrBusy}
            style={[styles.shutter, ocrBusy && styles.disabled]}
            onPress={() => void capturePhoto()}
          >
            {ocrBusy ? (
              <ActivityIndicator color={fixed.lime} />
            ) : (
              <View style={[styles.shutterInner, { backgroundColor: fixed.lime }]} />
            )}
          </PressableScale>
        ) : null}
        <PressableScale style={styles.bottomBtn} onPress={manualEntry}>
          <Text style={styles.bottomText}>{t('scan.manual')}</Text>
        </PressableScale>
      </View>
    </View>
  );
}

function cornerPos(c: 'tl' | 'tr' | 'bl' | 'br') {
  const w = 5;
  switch (c) {
    case 'tl': return { top: 0, left: 0, borderTopWidth: w, borderLeftWidth: w, borderTopLeftRadius: 22 };
    case 'tr': return { top: 0, right: 0, borderTopWidth: w, borderRightWidth: w, borderTopRightRadius: 22 };
    case 'bl': return { bottom: 0, left: 0, borderBottomWidth: w, borderLeftWidth: w, borderBottomLeftRadius: 22 };
    default: return { bottom: 0, right: 0, borderBottomWidth: w, borderRightWidth: w, borderBottomRightRadius: 22 };
  }
}

const styles = StyleSheet.create({
  scrimTop: { position: 'absolute', left: 0, right: 0, top: 0 },
  scrimBottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  root: { flex: 1, backgroundColor: '#151513' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 2,
  },
  roundBtn: {
    width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  roundGlyph: { color: '#FFFFFF', fontSize: 15, fontFamily: font.bold },
  modeSwitch: {
    flexDirection: 'row',
    width: 220,
    padding: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  modeBtn: { flex: 1, height: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  modeText: { fontFamily: font.bold, fontSize: 13 },
  centerZone: { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  frame: { width: 232, height: 232 },
  corner: { position: 'absolute', width: 54, height: 54 },
  laser: { position: 'absolute', left: 22, right: 22, top: 12, height: 3, borderRadius: 999 },
  deniedCard: {
    alignSelf: 'stretch', backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 28, padding: 24, gap: 10,
  },
  deniedTitle: { fontFamily: font.extrabold, fontSize: 17, color: '#FFFFFF', textAlign: 'center' },
  deniedHint: { fontFamily: font.semibold, fontSize: 12.5, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 17 },
  deniedOr: { fontFamily: font.semibold, fontSize: 13.5, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 18, marginTop: 10 },
  deniedChips: { marginTop: 16 },
  deniedCta: { height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  deniedGhostBorder: { height: 46, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  deniedGhost: { backgroundColor: 'rgba(255,255,255,0.12)' },
  deniedCtaDark: { fontFamily: font.extrabold, fontSize: 15, color: '#111110' },
  deniedCtaLight: { fontFamily: font.bold, fontSize: 15, color: '#FFFFFF' },
  bottomZone: { alignItems: 'center', gap: 14, zIndex: 2 },
  caption: {
    fontFamily: font.semibold,
    fontSize: 15,
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  shutter: {
    width: 72, height: 72, borderRadius: 999, borderWidth: 5, borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: { width: 52, height: 52, borderRadius: 999 },
  bottomBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  bottomText: {
    fontFamily: font.bold,
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.75)',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  disabled: { opacity: 0.4 },
});
