// 📸 Photo Moment (vision §C15) — снимок компании к закрытому счёту.
//
// «Сделали фотографию компании. Она сохраняется рядом с: 640 000 сум /
// 4 friends / Bellissimo. Через год: One year ago ⚡». Поэтому экран
// намеренно голый: кадр, кнопка спуска, переключение камеры. Ни фильтров,
// ни редактора — момент, а не фотоприложение.
import React, { useRef, useState } from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { Camera, useCameraDevice, useCameraFormat, useCameraPermission } from 'react-native-vision-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { PressableScale } from '@/components/PressableScale';
import { CloseIcon } from '@/components/icons';
import { toast } from '@/components/ToastHost';
import { attachSplitPhoto } from '@/api/actions';
import { qk } from '@/api/data';
import { cue } from '@/lib/feedback';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/tokens';

export function PhotoMomentScreen() {
  const { t } = useTranslation();
  const { fixed } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const qc = useQueryClient();
  const focused = useIsFocused();
  const id = route.params?.id as string;

  const [front, setFront] = useState(false);
  const device = useCameraDevice(front ? 'front' : 'back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const camera = useRef<Camera>(null);
  const [busy, setBusy] = useState(false);

  // Тот же предел, что и у съёмки чека: полноразмерный кадр телефона (~7 МБ)
  // не проходит client_max_body_size на проде и обрывается на середине —
  // в приложении это выглядит как «нет сети», а не как «файл великоват».
  const format = useCameraFormat(device, [{ photoResolution: { width: 1920, height: 1080 } }]);

  React.useEffect(() => {
    if (!hasPermission) void requestPermission();
  }, [hasPermission, requestPermission]);

  const shoot = async () => {
    if (!camera.current || busy) return;
    setBusy(true);
    try {
      const photo = await camera.current.takePhoto({ flash: 'off' });
      await attachSplitPhoto(id, 'file://' + photo.path);
      // фото приезжает в сплите из /bootstrap — обновляем его, а не локальный стейт
      await qc.invalidateQueries({ queryKey: qk.bootstrap });
      cue('share');
      toast.success(t('photoMoment.saved'));
      nav.goBack();
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : t('photoMoment.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      {device && hasPermission && focused ? (
        <Camera ref={camera} style={StyleSheet.absoluteFill} device={device} format={format} isActive photo />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.noCam]}>
          <Text style={styles.noCamText}>{t('photoMoment.allowCamera')}</Text>
        </View>
      )}

      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <PressableScale style={styles.iconBtn} onPress={() => nav.goBack()}>
          <CloseIcon size={18} color="#FFFFFF" />
        </PressableScale>
        <Text style={styles.title}>{t('photoMoment.title')}</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
        <PressableScale style={styles.flip} onPress={() => setFront((v) => !v)} haptic>
          <Text style={styles.flipText}>{t('photoMoment.flip')}</Text>
        </PressableScale>
        <PressableScale
          style={[styles.shutter, { borderColor: fixed.lime, opacity: busy ? 0.5 : 1 }]}
          onPress={shoot}
          haptic
        >
          <View style={[styles.shutterCore, { backgroundColor: fixed.lime }]} />
        </PressableScale>
        <View style={styles.flip} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  noCam: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  noCamText: { fontFamily: font.semibold, fontSize: 15, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  title: { fontFamily: font.extrabold, fontSize: 16, color: '#FFFFFF' },
  bottom: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
  },
  flip: { width: 64 },
  flipText: { fontFamily: font.bold, fontSize: 13, color: '#FFFFFF' },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 999,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterCore: { width: 58, height: 58, borderRadius: 999 },
});
