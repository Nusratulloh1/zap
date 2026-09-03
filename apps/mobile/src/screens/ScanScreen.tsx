// Сканер — порт ScanPage.vue (дизайн 3d) на react-native-vision-camera:
// живая камера, MLKit-сканер QR, режим «фото» (снимок → Gemini OCR),
// фонарик, лаймовая рамка. Без доступа к камере — карточка с ручным вводом.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, StatusBar, StyleSheet, Text, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import Animated, { Easing, useAnimatedRef, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { trigger } from 'react-native-haptic-feedback';
import { PressableScale } from '@/components/PressableScale';
import { QrToReceipt } from '@/components/bill/QrToReceipt';
import { PhotoToReceipt, type PhotoPhase } from '@/components/bill/PhotoToReceipt';
import { EASE_ZAP, QR_TIMELINE } from '@/lib/motion';
import { cue } from '@/lib/feedback';
import { toast } from '@/components/ToastHost';
import Svg, { Defs, LinearGradient, Stop, Rect as SvgRect } from 'react-native-svg';
import { CloseIcon, BoltIcon } from '@/components/icons';
import { PartnerChips } from '@/components/PartnerChips';
import { fetchFeaturedBill, fiscalOcr, resolveQr } from '@/api/actions';
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

  /**
   * Формат под распознавание, а не под галерею.
   *
   * Камера по умолчанию снимает в максимальном разрешении: у телефона это
   * ~7 МБ JPEG. Такой файл nginx на проде отвергает (client_max_body_size),
   * причём обрывает соединение на середине загрузки — fetch падает с
   * «Network request failed», и в приложении это выглядело как «нет сети».
   * 1920x1080 хватает, чтобы прочитать строки чека, и весит ~0.4 МБ.
   */
  const format = useCameraFormat(device, [{ photoResolution: { width: 1920, height: 1080 } }]);
  const stopped = useRef(false);
  const [ocrBusy, setOcrBusy] = useState(false);


  // приложение на переднем плане (см. isActive у Camera)
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setAppActive(st === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!hasPermission) void requestPermission();
  }, [hasPermission, requestPermission]);

  // лазерная полоска в рамке — бегает вверх-вниз, пока идёт скан
  const laser = useSharedValue(0);
  useEffect(() => {
    laser.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [laser]);
  const laserStyle = useAnimatedStyle(() => ({ transform: [{ translateY: laser.value * 200 }] }));

  // --- QR → счёт (vision, часть A) -----------------------------------------
  // Код распознан: углы схлопываются к нему, дальше эстафету принимает
  // QrToReceipt. Куда идти после превращения, решает routePayload — он
  // кладёт сюда переход, а сам ждёт конца анимации.
  const frameRef = useAnimatedRef<View>();
  const [magic, setMagic] = useState(false);
  const goAfterMagic = useRef<(() => void) | null>(null);
  // снимок чека и стадия его превращения (см. PhotoToReceipt)
  const [shot, setShot] = useState<string | null>(null);
  const [shotPhase, setShotPhase] = useState<PhotoPhase>('reading');
  // сумма из кода, если она уже известна — её показывает выезжающий чек
  const [magicAmount, setMagicAmount] = useState<number | undefined>(undefined);

  /** Идёт превращение (QR или снимок) — интерфейс сканера уходит с дороги. */
  const transforming = magic || !!shot;
  const collapse = useSharedValue(0);

  /** Статичная рамка гаснет: дальше кадр держат углы из оверлея. */
  const idleStyle = useAnimatedStyle(() => ({ opacity: 1 - collapse.value }));

  /**
   * Запустить превращение.
   *
   * qrRect — где код реально оказался в кадре (vision-camera отдаёт его в dp
   * относительно превью, а превью занимает весь экран). Если детектор рамку
   * не дал, оверлей возьмёт геометрию видоискателя.
   */
  const runMagic = useCallback(
    (go: () => void) => {
      goAfterMagic.current = go;
      collapse.value = withTiming(1, { duration: QR_TIMELINE.corners.dur, easing: EASE_ZAP });
      setMagic(true);
    },
    [collapse],
  );

  /**
   * Уйти на главную из сканера. Именно navigate, а не replace: сканер —
   * модальный «захват», и replace посадил бы корневой Tabs в его слот,
   * после чего главная навсегда осталась бы модалкой. navigate возвращает
   * к уже существующему Tabs ниже по стеку и закрывает захват.
   */
  const toHome = useCallback(() => nav.popTo('Tabs', { screen: 'Amount' }), [nav]);

  /** Классификация QR: сплит / счёт / фискальный чек / неизвестное. */
  const routePayload = useCallback(
    async (payload: string) => {
      const m = payload.match(/\/s\/([\w-]+)/i);
      if (m) {
        const code = m[1];
        cue('scan');
        runMagic(() => nav.replace('Participant', { code }));
        return;
      }
      try {
        const res = await resolveQr(payload);
        if (res.type === 'split') {
          const code = res.code;
          cue('scan');
          runMagic(() => nav.replace('Participant', { code }));
          return;
        }
        if (res.type === 'bill') {
          draft.startForBill(res.bill, res.bill.merchantId);
          cue('scan');
          setMagicAmount(res.bill.total);
          runMagic(() => nav.replace('Bill'));
          return;
        }
        if (res.type === 'fiscal') {
          // узбекский QR не несёт суммы — экран чека в состоянии загрузки
          draft.startFiscal(res.instant.totalAmount ?? 0, res.jobId, payload);
          cue('scan');
          setMagicAmount(res.instant.totalAmount || undefined);
          runMagic(() => nav.replace('Bill'));
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
        toHome();
      }
    },
    [draft, nav, t, toHome, runMagic],
  );

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      if (stopped.current || mode !== 'scan') return;
      const value = codes[0]?.value;
      if (!value) return;
      // детектор отдаёт положение кода в кадре — по нему схлопнутся углы
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
      const uri = 'file://' + photo.path;
      // снимок сразу уходит в оверлей: пока идёт OCR, человек видит, как его
      // чек «читают», а не кружок поверх камеры
      setShot(uri);
      setShotPhase('reading');

      const res = await fiscalOcr(uri);
      const receipt = res.receipt;

      if (receipt && (receipt.items?.length || res.itemsRecognized)) {
        draft.startFiscal(receipt.total);
        draft.applyFiscalItems({ merchant: receipt.merchant, total: receipt.total, items: receipt.items }, true);
        cue('scan');
        goAfterMagic.current = () => nav.replace('ReviewItems');
        setShotPhase('done');
      } else if (receipt && receipt.total > 0) {
        draft.startFiscal(receipt.total);
        draft.fiscalFailed();
        cue('scan');
        goAfterMagic.current = () => nav.replace('Members');
        setShotPhase('done');
      } else {
        toast(t('scan.photoFailed'));
        setShotPhase('failed');
      }
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : t('scan.photoFailedShort'));
      setShotPhase('failed');
    } finally {
      setOcrBusy(false);
    }
  };

  /**
   * Демо-чек: проиграть превращение целиком, не охотясь за настоящим QR.
   *
   * Так магию можно оценивать сколько угодно раз подряд, а не по одному разу
   * на каждый найденный чек.
   */
  const demoBill = async () => {
    if (magic) return;
    try {
      const bill = await fetchFeaturedBill();
      if (!bill) {
        toast(t('scan.qrUnknown'));
        return;
      }
      draft.startForBill(bill, bill.merchantId);
      cue('scan');
      setMagicAmount(bill.total);
      // превращение стартует из видоискателя, задавать координаты не нужно
      runMagic(() => nav.replace('Bill'));
    } catch {
      toast(t('errors.generic'));
    }
  };

  const manualEntry = toHome;

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
          format={format}
          // Превью живёт, пока экран на виду И приложение на переднем плане.
          //
          // Здесь было `focused && !stopped.current`: в момент запуска магии
          // экран перерисовывался с isActive=false, камера останавливалась,
          // кадр чернел — и «бумага разворачивалась из QR» происходило поверх
          // пустоты. От повторных срабатываний защищает сам колбэк сканера,
          // поэтому распознавание на isActive больше не влияет.
          //
          // AppState обязателен: при уходе в фон система забирает камеру, а
          // сама сессия обратно не поднимается — без этого флага возврат в
          // приложение оставлял белое превью.
          isActive={focused && appActive}
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

      {/* верх: × · режимы · фонарик — на время превращения убираем */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }, transforming && styles.hidden]}>
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
              <Text style={[styles.modeText, { color: mode === m ? '#121212' : '#FFFFFF' }]}>
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
          <Animated.View ref={frameRef} style={styles.frame}>
            {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
              <Animated.View key={c} style={[styles.corner, cornerPos(c), { borderColor: fixed.lime }, idleStyle]} />
            ))}
            {/* рабочая «лазерная» полоска гаснет, как только начинается превращение */}
            <Animated.View style={[styles.laser, { backgroundColor: 'rgba(221,255,51,0.6)' }, laserStyle, idleStyle]} />
          </Animated.View>
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

      {/*
        Низ: подпись · затвор · ручной ввод.

        Во время превращения прячем целиком: иначе подпись сканера и кнопки
        проступали поверх затемнения и налезали на подпись оверлея — экран
        читался как две наложенные друг на друга страницы.
      */}
      <View style={[styles.bottomZone, { paddingBottom: insets.bottom + 18 }, transforming && styles.hidden]}>
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
            {/* обратную связь во время съёмки даёт оверлей превращения,
                поэтому здесь кнопке достаточно погаснуть */}
            <View style={[styles.shutterInner, { backgroundColor: fixed.lime }]} />
          </PressableScale>
        ) : null}
        <View style={styles.bottomRow}>
          <PressableScale style={styles.bottomBtn} onPress={() => void demoBill()}>
            <Text style={styles.bottomText}>{t('scan.demo')}</Text>
          </PressableScale>
          <PressableScale style={styles.bottomBtn} onPress={manualEntry}>
            <Text style={styles.bottomText}>{t('scan.manual')}</Text>
          </PressableScale>
        </View>
      </View>
      {/* код превращается в чек, а не «loading → страница» */}
      <QrToReceipt
        run={magic}
        frameRef={frameRef}
        amount={magicAmount}
        onHandoff={() => goAfterMagic.current?.()}
      />
      {/* снимок чека читается на глазах, а не под спиннером */}
      <PhotoToReceipt
        photoUri={shot}
        phase={shotPhase}
        onHandoff={() => goAfterMagic.current?.()}
        onDismiss={() => setShot(null)}
      />
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
  deniedCtaDark: { fontFamily: font.extrabold, fontSize: 15, color: '#121212' },
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
  hidden: { opacity: 0 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
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
