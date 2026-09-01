// Снимок карточки «ZAP COMPLETE» и отправка её в шеринг.
//
// Захват узла в картинку требует нативной библиотеки (react-native-view-shot).
// Она подключается «мягко», как звук: если библиотеки нет или сборка её ещё
// не подхватила, карточка всё равно рисуется и показывается, а поделиться
// можно ссылкой. Продукт не ломается из-за отсутствия зависимости — ломается
// только «поделиться картинкой».
//
// Чтобы включить картинку:
//   npm i react-native-view-shot
//   (пересборка Android — см. docs/mobile/RUN.md)
// Кода менять не нужно: require ниже подхватит библиотеку сам.
import { Share } from 'react-native';
import type { RefObject } from 'react';
import { translate } from '@/i18n';
import { splitUrl } from '@/lib/share';

type CaptureOptions = { format: 'png' | 'jpg'; quality: number; width?: number; height?: number };
type CaptureFn = (ref: unknown, opts: CaptureOptions) => Promise<string>;

let captureRef: CaptureFn | null | undefined;

function capture(): CaptureFn | null {
  if (captureRef !== undefined) return captureRef;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-view-shot') as { captureRef?: CaptureFn };
    captureRef = mod?.captureRef ?? null;
  } catch {
    captureRef = null;
  }
  return captureRef;
}

/** Доступен ли снимок карточки в этой сборке. */
export function canCaptureCard(): boolean {
  return capture() !== null;
}

interface Args {
  /** узел карточки */
  cardRef: RefObject<unknown>;
  /** размер снимка в пикселях */
  width: number;
  height: number;
  /** код сплита — уходит ссылкой вместе с картинкой */
  code: string;
  title: string;
}

/**
 * Снять карточку и открыть системный «Поделиться».
 *
 * Если снимок недоступен, отправляем то же самое ссылкой — пользователь всё
 * равно получает результат, просто без картинки.
 */
export async function shareCardImage({ cardRef, width, height, code, title }: Args): Promise<boolean> {
  const url = splitUrl(code);
  const message = translate('shareCard.message', { title, url });

  const fn = capture();
  if (!fn || !cardRef.current) {
    const res = await Share.share({ message, url, title });
    return res.action === Share.sharedAction;
  }

  const uri = await fn(cardRef.current, { format: 'png', quality: 1, width, height });
  // Android кладёт ссылку в message, iOS показывает url отдельным вложением;
  // сама картинка передаётся как url в обоих случаях
  const res = await Share.share({ message, url: uri, title });
  return res.action === Share.sharedAction;
}
