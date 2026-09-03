// Рваный край чека (spec/11): треугольная «пила» 12×8, как в макете, где она
// собрана из двух linear-gradient. В RN градиентами так не сделать — рисуем
// повторяющийся треугольник в SVG.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface Props {
  /** цвет бумаги чека */
  color: string;
  /** вниз — край снизу блока, вверх — сверху */
  side: 'top' | 'bottom';
  width: number;
}

const STEP = 12;
const H = 8;

export function TornEdge({ color, side, width }: Props) {
  const teeth = Math.ceil(width / STEP) + 1;
  let d = side === 'bottom' ? `M0 0 H${teeth * STEP} V0 ` : `M0 ${H} H${teeth * STEP} V${H} `;

  for (let i = teeth; i >= 0; i--) {
    const x = i * STEP;
    if (side === 'bottom') {
      d += `L${x} 0 L${x - STEP / 2} ${H} `;
    } else {
      d += `L${x} ${H} L${x - STEP / 2} 0 `;
    }
  }
  d += 'Z';

  return (
    <View style={[styles.root, { height: H }]} pointerEvents="none">
      <Svg width={teeth * STEP} height={H}>
        <Path d={d} fill={color} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
});
