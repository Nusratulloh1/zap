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
