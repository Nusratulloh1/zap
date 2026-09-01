// Фирменный лоадер деления счёта (vision §C17: «даже loading должен быть ZAP,
// не ○ ○ ○»).
//
// Источник — docs/product/ZAP-Split-the-Bill-Transparent-1024.gif.mp4, разложен
// на 20 кадров (tools/gen-split-loader.py). Играем именно кадрами, а не видео:
// в mp4 альфа-канала нет (там yuv420p, прозрачность потерялась при конвертации),
// а плеер потребовал бы новой нативной зависимости — на RN 0.87 это уже дважды
// выходило боком. Чёрный фон вырезан в альфу при генерации.
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { reduceMotion } from '@/lib/feedback';

// require() не принимает переменную — список нужен статически
const FRAMES = [
  require('../../assets/anim/split/f01.png'),
  require('../../assets/anim/split/f02.png'),
  require('../../assets/anim/split/f03.png'),
  require('../../assets/anim/split/f04.png'),
  require('../../assets/anim/split/f05.png'),
  require('../../assets/anim/split/f06.png'),
  require('../../assets/anim/split/f07.png'),
  require('../../assets/anim/split/f08.png'),
  require('../../assets/anim/split/f09.png'),
  require('../../assets/anim/split/f10.png'),
  require('../../assets/anim/split/f11.png'),
  require('../../assets/anim/split/f12.png'),
  require('../../assets/anim/split/f13.png'),
  require('../../assets/anim/split/f14.png'),
  require('../../assets/anim/split/f15.png'),
  require('../../assets/anim/split/f16.png'),
  require('../../assets/anim/split/f17.png'),
  require('../../assets/anim/split/f18.png'),
  require('../../assets/anim/split/f19.png'),
  require('../../assets/anim/split/f20.png'),
];

/** Частота исходника — 50/3 кадра в секунду. */
const FRAME_MS = 60;

interface Props {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function SplitLoader({ size = 172, style }: Props) {
  // при reduced motion показываем один осмысленный кадр, а не мигание
  const still = reduceMotion();
  const [i, setI] = useState(still ? 12 : 0);

  useEffect(() => {
    if (still) return;
    const id = setInterval(() => setI((p) => (p + 1) % FRAMES.length), FRAME_MS);
    return () => clearInterval(id);
  }, [still]);

  return (
    <View style={[{ width: size, height: size }, style]}>
      {/*
        Держим ВСЕ кадры смонтированными и переключаем видимость: если менять
        source у одного Image, первый цикл идёт с рывками — кадры декодируются
        по мере показа. Так они декодированы заранее.
      */}
      {FRAMES.map((src, idx) => (
        <Image
          key={idx}
          source={src}
          resizeMode="contain"
          style={[StyleSheet.absoluteFill, { opacity: idx === i ? 1 : 0 }]}
        />
      ))}
    </View>
  );
}
