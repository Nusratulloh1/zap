// Своё фото как аватар: фронталка → квадратный предпросмотр → «Использовать».
//
// Снимок нигде не загружается и не сохраняется в файлы: квадратный кадр
// снимается view-shot'ом в base64 (512px, ~100 КБ) и кладётся в MMKV.
// Так не нужны ни бэкенд, ни файловая система, ни новая нативная зависимость,
// а фото переживает переустановку JS-бандла.
import React, { useEffect, useRef, useState } from 'react';
import { Image, StatusBar, StyleSheet, Text, View } from 'react-native';
import { Camera, useCameraDevice, useCameraFormat, useCameraPermission } from 'react-native-vision-camera';

/*
  view-shot подключается через require, как в lib/shareCard.ts: у пакета
  сломанные исходные типы под RN 0.87, статический импорт валит tsc.
*/
type CaptureFn = (ref: unknown, opts: Record<string, unknown>) => Promise<string>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const captureRef = (require('react-native-view-shot') as { captureRef: CaptureFn }).captureRef;
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '@/components/PressableScale';
import { CloseIcon } from '@/components/icons';
import { toast } from '@/components/ToastHost';
import { setMyAvatarPhoto } from '@/lib/myAvatar';
import { cue } from '@/lib/feedback';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

export function AvatarCameraScreen() {
  const { t } = useTranslation();
  const { fixed } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const focused = useIsFocused();

  const [front, setFront] = useState(true);
  const device = useCameraDevice(front ? 'front' : 'back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const camera = useRef<Camera>(null);
  const shotRef = useRef<React.ComponentRef<typeof View>>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // аватару хватает 1280 — быстрее съёмка и меньше кадр в памяти
  const format = useCameraFormat(device, [{ photoResolution: { width: 1280, height: 960 } }]);

  useEffect(() => {
    if (!hasPermission) void requestPermission();
  }, [hasPermission, requestPermission]);

  const take = async () => {
    if (!camera.current || busy) return;
    setBusy(true);
    try {
      const photo = await camera.current.takePhoto({ flash: 'off' });
      setShot('file://' + photo.path);
    } catch {
      toast(t('profile.photoFailed'));
    } finally {
      setBusy(false);
    }
  };

  const use = async () => {
    if (!shotRef.current || busy) return;
    setBusy(true);
    try {
      const b64 = await captureRef(shotRef, {
        format: 'jpg',
        quality: 0.85,
        result: 'base64',
        width: 512,
        height: 512,
      });
      setMyAvatarPhoto(`data:image/jpeg;base64,${b64}`);
      cue('share');
      nav.goBack();
    } catch {
      toast(t('profile.photoFailed'));
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {shot ? (
        /* предпросмотр: квадрат — ровно то, что станет аватаром */
        <View style={styles.previewWrap}>
          <View ref={shotRef} collapsable={false} style={styles.square}>
            <Image source={{ uri: shot }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          </View>
          <View style={[styles.actions, { paddingBottom: insets.bottom + 24 }]}>
            <PressableScale style={[styles.action, styles.actionGhost]} onPress={() => setShot(null)}>
              <Text style={styles.actionGhostText}>{t('profile.photoRetake')}</Text>
            </PressableScale>
            <PressableScale style={[styles.action, { backgroundColor: fixed.lime }]} onPress={() => void use()}>
              <Text style={styles.actionText}>{t('profile.photoUse')}</Text>
            </PressableScale>
          </View>
        </View>
      ) : (
        <>
          {device && hasPermission && focused ? (
            <Camera ref={camera} style={StyleSheet.absoluteFill} device={device} format={format} isActive photo />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.noCam]}>
              <Text style={styles.noCamText}>{t('photoMoment.allowCamera')}</Text>
            </View>
          )}
          <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
            <PressableScale style={styles.flip} onPress={() => setFront((v) => !v)} haptic>
              <Text style={styles.flipText}>{t('photoMoment.flip')}</Text>
            </PressableScale>
            <PressableScale
              style={[styles.shutter, { borderColor: fixed.lime, opacity: busy ? 0.5 : 1 }]}
              onPress={() => void take()}
              haptic
            >
              <View style={[styles.shutterCore, { backgroundColor: fixed.lime }]} />
            </PressableScale>
            <View style={styles.flip} />
          </View>
        </>
      )}

      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <PressableScale style={styles.iconBtn} onPress={() => nav.goBack()}>
          <CloseIcon size={18} color="#FFFFFF" />
        </PressableScale>
        <Text style={styles.title}>{t('profile.photoTitle')}</Text>
        <View style={styles.iconBtn} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  noCam: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  noCamText: { fontFamily: font.semibold, fontSize: 15, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  iconBtn: { width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  title: { fontFamily: font.extrabold, fontSize: 16, color: '#FFFFFF' },
  bottom: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28 },
  flip: { width: 64 },
  flipText: { fontFamily: font.bold, fontSize: 13, color: '#FFFFFF' },
  shutter: { width: 76, height: 76, borderRadius: 999, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  shutterCore: { width: 58, height: 58, borderRadius: 999 },
  previewWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  square: { width: '86%', aspectRatio: 1, borderRadius: 24, overflow: 'hidden' },
  actions: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 12, paddingHorizontal: 24 },
  action: { flex: 1, height: 54, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  actionGhost: { backgroundColor: 'rgba(255,255,255,0.16)' },
  actionGhostText: { fontFamily: font.extrabold, fontSize: 15, color: '#FFFFFF' },
  actionText: { fontFamily: font.extrabold, fontSize: 15, color: '#121212' },
});
