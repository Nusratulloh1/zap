// Звук + тактильная отдача фирменных моментов (vision §10).
//
// Четыре коротких звука на весь продукт, 150–400 мс, каждый в паре с haptic:
//   split         — zzzt-pop, разрыв чека
//   paid          — pop, оплатил друг
//   everyonePaid  — zap-pop!, все закрыли счёт
//   reminder      — bzzt, «пингануть»
//
// Звук подключён «мягко»: если библиотека не залинкована или файла нет,
// проигрывание тихо пропускается — анимация никогда не ждёт аудио.
// Реальные ассеты кладутся в assets/sounds/ (см. TODO ниже).
import { AccessibilityInfo, Platform } from 'react-native';
import { trigger, HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { storage } from '@/theme/ThemeProvider';

export type Cue = 'scan' | 'split' | 'splitDone' | 'paid' | 'everyonePaid' | 'reminder' | 'share';

const MUTE_KEY = 'zap:sound-muted';

/** Пользователь выключил звуки продукта (тактильная отдача остаётся). */
export function soundMuted(): boolean {
  return storage.getString(MUTE_KEY) === 'on';
}

export function setSoundMuted(muted: boolean): void {
  storage.set(MUTE_KEY, muted ? 'on' : 'off');
}

// ---------------------------------------------------------------------------
// Reduced motion: системная настройка «уменьшить движение». При ней экраны
// показывают состояния без празднований — и празднующий звук тоже молчит.
// ---------------------------------------------------------------------------
let reduced = false;
void AccessibilityInfo.isReduceMotionEnabled().then((v) => (reduced = v));
AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => (reduced = v));

export function reduceMotion(): boolean {
  return reduced;
}

// ---------------------------------------------------------------------------
// Аудио. react-native-sound ищет файлы:
//   Android — android/app/src/main/res/raw/<имя>.mp3 (только [a-z0-9_]);
//   iOS     — файл должен лежать в бандле приложения (добавляется в Xcode).
//
// Реальный ассет пока один — «разрыв бумаги» (split) из docs/product.
// Остальные синтезированы под нужные моменты (scratchpad/mksounds.py) и
// подлежат замене, когда придут финальные звуки от дизайна.
// ---------------------------------------------------------------------------
const FILES: Record<Cue, string> = {
  scan: 'scan.mp3',
  split: 'split.mp3',
  // «сплит готов» — не разрыв бумаги, а фирменный разряд с аккордом
  splitDone: 'split_done.mp3',
  paid: 'paid.mp3',
  everyonePaid: 'everyone_paid.mp3',
  reminder: 'reminder.mp3',
  share: 'share.mp3',
};

type SoundInstance = { play: (cb?: () => void) => void; setVolume: (v: number) => void; release: () => void };
type SoundCtor = new (file: string, base: string, err?: (e: unknown) => void) => SoundInstance;

let SoundLib: (SoundCtor & { MAIN_BUNDLE: string; setCategory: (c: string) => void }) | null | undefined;
const cache = new Map<Cue, SoundInstance>();

function lib() {
  if (SoundLib !== undefined) return SoundLib;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-sound');
    SoundLib = (mod?.default ?? mod) ?? null;
    // Playback, а не Ambient: Ambient на iOS полностью глушится боковым
    // переключателем «без звука», и продуктовые звуки просто пропадали.
    SoundLib?.setCategory?.('Playback');
  } catch {
    // библиотека не установлена/не залинкована — работаем без звука
    SoundLib = null;
  }
  return SoundLib;
}

/** Громкость воспроизведения; отдельные звуки можно приглушить точечно. */
const VOLUME: Partial<Record<Cue, number>> = {};
const DEFAULT_VOLUME = 0.7;

function playSound(cue: Cue) {
  if (soundMuted()) return;
  const S = lib();
  if (!S) return;

  const cached = cache.get(cue);
  if (cached) {
    cached.play();
    return;
  }
  try {
    // Ссылку держим в let: колбэк react-native-sound может выстрелить
    // синхронно, и обращение к ещё не инициализированной const упало бы
    // с ReferenceError прямо внутри конструктора.
    let s: SoundInstance | null = null;
    s = new S(FILES[cue], S.MAIN_BUNDLE, (err) => {
      if (err || !s) {
        // раньше ошибка загрузки проглатывалась молча, и «звука нет»
        // выглядело как отсутствие вызова
        console.warn('[sound] load failed:', FILES[cue], err);
        return;
      }
      s.setVolume(VOLUME[cue] ?? DEFAULT_VOLUME);
      cache.set(cue, s);
      s.play();
    });
  } catch (e) {
    console.warn('[sound] ctor threw:', FILES[cue], e);
  }
}

const HAPTICS: Record<Cue, HapticFeedbackTypes> = {
  scan: HapticFeedbackTypes.impactLight,
  share: HapticFeedbackTypes.selection,
  split: HapticFeedbackTypes.impactMedium,
  splitDone: HapticFeedbackTypes.notificationSuccess,
  paid: HapticFeedbackTypes.impactLight,
  everyonePaid: HapticFeedbackTypes.notificationSuccess,
  reminder: Platform.OS === 'ios' ? HapticFeedbackTypes.selection : HapticFeedbackTypes.impactLight,
};

/**
 * Момент продукта: звук + тактильная отдача одним вызовом.
 * При reduced motion празднование (everyonePaid) звучать не должно —
 * остаётся только отдача.
 */
export function cue(name: Cue): void {
  const celebratory = name === 'everyonePaid' || name === 'split' || name === 'splitDone';
  if (!(reduced && celebratory)) playSound(name);
  trigger(HAPTICS[name], { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
}

/** Освободить проигрыватели (вызывается при выходе из аккаунта). */
export function releaseSounds(): void {
  for (const s of cache.values()) s.release();
  cache.clear();
}
