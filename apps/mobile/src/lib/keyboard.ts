// Клавиатурные хелперы.
// 1) useKeyboardHeight — высота открытой клавиатуры (edge-to-edge в RN 0.87
//    не даёт adjustResize поднять контент, поэтому паддинг делаем сами).
// 2) refocus — возврат клавиатуры по тапу пользователя.
// 3) useKeyboardLock — держит клавиатуру открытой на PIN/SMS-экранах.
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    // iOS шлёт Will* ДО анимации — контент едет вместе с клавиатурой,
    // а не телепортируется после
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvt, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

interface Focusable {
  focus(): void;
  blur(): void;
}

/** Ручной возврат клавиатуры (тап по точкам/полю). */
export function refocus(ref: { current: Focusable | null }): void {
  const input = ref.current;
  if (!input) return;
  input.blur();
  setTimeout(() => input.focus(), 60);
}

/**
 * Высота клавиатуры за вычетом нижней safe-area: на iOS endCoordinates
 * включает home-indicator, а контент уже внутри SafeAreaView.
 */
export function keyboardLift(kb: number, safeBottom: number): number {
  if (kb <= 0) return 0;
  return Platform.OS === 'ios' ? Math.max(0, kb - safeBottom) : kb;
}

/**
 * Держит клавиатуру открытой, пока active=true.
 *
 * Возвращаем фокус ТОЛЬКО через focus(): blur() сам закрывает клавиатуру и
 * снова стреляет keyboardDidHide — получался бесконечный цикл открытия и
 * закрытия. Флаг restoring гасит собственное событие, а счётчик не даёт
 * бороться с пользователем, если он настойчиво закрывает клавиатуру.
 */
export function useKeyboardLock(ref: { current: Focusable | null }, active: boolean): void {
  const restoring = useRef(false);
  const attempts = useRef(0);

  useEffect(() => {
    if (!active) {
      attempts.current = 0;
      return;
    }
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      if (restoring.current || attempts.current >= 3) return;
      restoring.current = true;
      attempts.current += 1;
      setTimeout(() => {
        ref.current?.focus();
        setTimeout(() => (restoring.current = false), 300);
      }, 220);
    });
    const show = Keyboard.addListener('keyboardDidShow', () => {
      attempts.current = 0;
    });
    return () => {
      hide.remove();
      show.remove();
    };
  }, [ref, active]);
}
