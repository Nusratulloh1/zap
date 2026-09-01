// Единые кривые и длительности — те же, что в web/src/lib/motion.ts и
// styles/main.css. Раньше ease-zap копипастился по трём файлам, а остальные
// анимации шли на дефолтном inOut(quad) и «плыли» мимо веба.
import { Easing } from 'react-native-reanimated';

/** ease-zap: резкий старт, мягкая посадка — базовая кривая продукта */
export const EASE_ZAP = Easing.bezier(0.32, 0.72, 0, 1);
/** лёгкий перелёт (back.out(1.4)) — появление чипов, тостов */
export const EASE_POP = Easing.bezier(0.34, 1.4, 0.5, 1);
export const EASE_OUT_QUAD = Easing.out(Easing.quad);
export const EASE_IN_QUAD = Easing.in(Easing.quad);

/** длительности из веба (motion.ts DUR) */
export const DUR = {
  fast: 120,
  base: 200,
  slow: 280,
  page: 360,
} as const;

/** пружины: gentle ≈ back.out(1.4), snappy ≈ back.out(2.4) */
export const SPRING_GENTLE = { damping: 14, stiffness: 220, mass: 0.7 } as const;
export const SPRING_SNAPPY = { damping: 11, stiffness: 300, mass: 0.55 } as const;

/** шаг стаггера списков и его потолок (web: delay i*30ms) */
export const STAGGER_STEP = 30;
export const STAGGER_MAX = 8;
export const stagger = (i: number): number => Math.min(i, STAGGER_MAX) * STAGGER_STEP;

// ---------------------------------------------------------------------------
// Тайминги подписных анимаций ZAP (PRODUCT-VISION, часть A).
// Держим их здесь, а не в экранах: Split the Bill переиспользует заливку
// кольца из Friend Paid, а Everyone Paid — те же частицы, что и milestone'ы.
// ---------------------------------------------------------------------------

/** ⚡ Split the Bill — раскадровка из видения, суммарно 1150 мс. */
export const SPLIT_TIMELINE = {
  squeeze: { at: 0, dur: 150 },      // чек сжимается 1 → 0.96
  bolt: { at: 150, dur: 150 },       // лаймовая молния сверху вниз
  tear: { at: 300, dur: 250 },       // разрыв на куски
  fly: { at: 550, dur: 250 },        // куски летят к аватарам
  rings: { at: 800, dur: 200 },      // кольца участников загораются
  flash: { at: 1000, dur: 150 },     // ZAP! и возврат к обычному экрану
  total: 1150,
} as const;

/** 🎉 Everyone Paid — эмоциональный пик, ~1.3 с. */
export const EVERYONE_TIMELINE = {
  converge: { at: 0, dur: 420 },     // аватары сходятся к центру
  flash: { at: 380, dur: 220 },      // лаймовая вспышка
  headline: { at: 520, dur: 320 },   // ZAP! + «Все оплатили. Красиво.»
  particles: { at: 520, dur: 780 },  // 5–7 частиц разлетаются
  share: { at: 1000, dur: 300 },     // «Share this moment →»
  total: 1300,
} as const;

/**
 * 📷 QR Scan — «QR превращается в счёт» (vision, часть A и часть C §20).
 *
 * Смысл раскадровки: пользователь не должен увидеть QR → loading → страница.
 *
 * Такты идут ПОСЛЕДОВАТЕЛЬНО, а не внахлёст. Первая версия укладывалась в
 * 0.98 с и читалась как одна вспышка: главный такт («код становится бумагой»)
 * длился 320 мс и тут же перекрывался разворотом на весь экран, так что
 * глазу не за чем было следить. Теперь у каждого такта своё окно, а на
 * превращение отдано почти полсекунды — 1.35 с целиком, зато читаемо.
 */
export const QR_TIMELINE = {
  corners: { at: 0, dur: 260 },     // ⌜ ⌝ ⌞ ⌟ садятся на код
  sweep: { at: 220, dur: 200 },     // лаймовая линия идёт по коду
  flash: { at: 420, dur: 200 },     // код целиком лаймовый и ДЕРЖИТСЯ
  morph: { at: 620, dur: 460 },     // ключевой такт: код растёт в чек
  settle: { at: 1080, dur: 270 },   // чек занимает экран
  handoff: 1320,                    // уходим на экран счёта
  total: 1350,
} as const;

/**
 * 📸 Фото чека → счёт. Тот же приём, что у QR, но растянутый на ожидание.
 *
 * OCR идёт секунды, поэтому одной короткой раскадровкой не обойтись:
 * снимок сначала «садится» в карточку чека, потом по нему циклически ходит
 * лаймовая линия (продукт буквально читает чек), и только когда ответ пришёл —
 * вспышка и разворот на весь экран. Спиннер поверх камеры выглядел бы
 * заглушкой, а здесь ожидание — часть превращения.
 */
export const PHOTO_TIMELINE = {
  shutter: { at: 0, dur: 130 },     // белая вспышка затвора
  settle: { at: 90, dur: 340 },     // снимок садится в карточку чека
  scanLoop: 1400,                   // один проход лаймовой линии по карточке
  flash: { at: 0, dur: 120 },       // от начала фазы «готово»
  expand: { at: 90, dur: 300 },     // карточка дорастает до экрана
  handoff: 370,                     // от начала фазы «готово»
  fail: 420,                        // карточка вздрагивает и уходит
} as const;

/** ✅ Friend Paid — кольцо серое → лайм, ✓, подскок. Живёт и внутри Split. */
export const RING_FILL = { dur: 420, pop: { damping: 9, stiffness: 380, mass: 0.5 } } as const;

/** Частицы празднования: держим ≤ 40 узлов — это дешёвые View, не библиотека. */
export const PARTICLE_COUNT = 7;
