// Иконки — те же SVG-пути, что и в вебе (HomePage/TabBar/ScanPage), через
// react-native-svg. Раньше стояли текстовые глифы — с дизайном не совпадали.
import React from 'react';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';

type P = { size?: number; color?: string; strokeWidth?: number };

/** Стрелка «назад» ← (кружки шапок). */
export function BackIcon({ size = 20, color = '#111110' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path d="M15.5 10H4.8M9.8 4.6 4.4 10l5.4 5.4" stroke={color} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Скан-рамка (шапка главной, пад суммы). */
export function ScanIcon({ size = 24, color = '#FFFFFF', strokeWidth = 2.4, center }: P & { center?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 8V5C3 3.9 3.9 3 5 3H8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M16 3H19C20.1 3 21 3.9 21 5V8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M21 16V19C21 20.1 20.1 21 19 21H16" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M8 21H5C3.9 21 3 20.1 3 19V16" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      {center ? <Rect x={7.8} y={7.8} width={8.4} height={8.4} rx={1.8} fill="#DDFF33" /> : null}
    </Svg>
  );
}

/** Лупа поиска. */
export function SearchIcon({ size = 18, color = '#5B594F' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Circle cx={8.5} cy={8.5} r={5.8} stroke={color} strokeWidth={2} />
      <Line x1={13} y1={13} x2={17} y2={17} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/** Дом (таб-бар). */
export function HomeIcon({ size = 22, color = '#FFFFFF' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 11.5L12 4.5L20 11.5V19.5H14.5V14.5H9.5V19.5H4V11.5Z" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
    </Svg>
  );
}

/** Часы (таб-бар «История»). */
export function ClockIcon({ size = 23, color = '#FFFFFF' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2.2} />
      <Path d="M12 7.5V12L15 14" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

/** Категория «Кэшбэк»: купюра (HomePage). */
export function CashIcon({ size = 24, color = '#FFFFFF' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={2.5} y={6.5} width={19} height={11} rx={2.5} stroke={color} strokeWidth={1.8} />
      <Circle cx={12} cy={12} r={2.8} stroke={color} strokeWidth={1.8} />
      <Line x1={5.8} y1={12} x2={5.8} y2={12.01} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Line x1={18.2} y1={12} x2={18.2} y2={12.01} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

/** Категория «Акции»: билет (HomePage). */
export function TicketIcon({ size = 24, color = '#FFFFFF' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 8C3 7.17 3.67 6.5 4.5 6.5H19.5C20.33 6.5 21 7.17 21 8V9.8C19.9 10.2 19.1 11.03 19.1 12C19.1 12.97 19.9 13.8 21 14.2V16C21 16.83 20.33 17.5 19.5 17.5H4.5C3.67 17.5 3 16.83 3 16V14.2C4.1 13.8 4.9 12.97 4.9 12C4.9 11.03 4.1 10.2 3 9.8V8Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Line x1={14.5} y1={8.8} x2={14.5} y2={15.2} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeDasharray="2 2.4" />
    </Svg>
  );
}

/** Молния (фонарик сканера). */
export function BoltIcon({ size = 17, color = '#FFFFFF' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M13 2L5 13H11L9 22L19 10H12.5L13 2Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}

/** Крестик закрытия. */
export function CloseIcon({ size = 17, color = '#FFFFFF' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <Path d="m4.5 4.5 9 9M13.5 4.5l-9 9" stroke={color} strokeWidth={2.1} strokeLinecap="round" />
    </Svg>
  );
}

/** Галочка. */
export function CheckIcon({ size = 14, color = '#111110', strokeWidth = 2.2 }: P) {
  return (
    <Svg width={size} height={(size * 11) / 14} viewBox="0 0 14 11" fill="none">
      <Path d="M1.4 5.6 5 9.2 12.6 1.6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Конверт — кнопка «Отправить SMS со ссылкой» (SharePage). */
export function MailIcon({ size = 19, color = '#111110' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Rect x={2} y={4} width={16} height={12} rx={3} stroke={color} strokeWidth={1.8} />
      <Path d="M2.5 6.5L10 11L17.5 6.5" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}

/** Солнце — переключатель темы (ThemeToggle). */
export function SunIcon({ size = 19, color = '#5B594F' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Circle cx={10} cy={10} r={2.6} stroke={color} strokeWidth={1.8} />
      <Path
        d="M10 2.5V5M10 15V17.5M2.5 10H5M15 10H17.5M4.7 4.7L6.4 6.4M13.6 13.6L15.3 15.3M15.3 4.7L13.6 6.4M6.4 13.6L4.7 15.3"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Луна — переключатель темы (ThemeToggle). */
export function MoonIcon({ size = 19, color = '#5B594F' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path d="M16.5 12.2A6.8 6.8 0 0 1 7.8 3.5a6.8 6.8 0 1 0 8.7 8.7Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
