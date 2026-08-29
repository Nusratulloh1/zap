// Каунт-ап суммы, как CountUp.vue: цифры бегут к значению с ease-out.
// rAF на JS достаточно — обновляется текст, вёрстка не трогается.
import React, { useEffect, useRef, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { money } from '@/lib/format';

interface Props {
  value: number;
  duration?: number;
  prefix?: string;
  style?: StyleProp<TextStyle>;
}

export function CountUp({ value, duration = 800, prefix = '', style }: Props) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    const t0 = Date.now();
    let raf: number;
    const tick = () => {
      const k = Math.min(1, (Date.now() - t0) / duration);
      const e = 1 - Math.pow(1 - k, 3); // easeOutCubic
      setShown(Math.round(start + (value - start) * e));
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <Text style={style} numberOfLines={1} adjustsFontSizeToFit>
      {prefix}
      {money(shown)}
    </Text>
  );
}
