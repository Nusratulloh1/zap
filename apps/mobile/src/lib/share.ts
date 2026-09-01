// Поделиться сплитом — системный share sheet, а не заглушка.
//
// Раньше кнопка «Поделиться» показывала тост «Карточка скоро будет ⚡»:
// красивая share-карточка (картинкой) действительно ещё не сделана, но
// отдавать пользователю тост вместо действия нельзя — ссылка на сплит и
// так работает и решает ровно ту задачу, ради которой жмут кнопку.
//
// Когда появится генерация картинки, здесь добавится ещё и `url` на неё;
// текст и ссылка останутся теми же.
import { Share } from 'react-native';
import { translate } from '@/i18n';

/** Публичная страница сплита: по ней друг платит без установки приложения. */
export const SPLIT_ORIGIN = 'https://zapapp.uz';

export function splitUrl(code: string): string {
  return `${SPLIT_ORIGIN}/s/${code}`;
}

/**
 * Открыть системный «Поделиться» со ссылкой на сплит.
 * Возвращает true, если пользователь довёл действие до конца.
 */
export async function shareSplit(code: string, title: string): Promise<boolean> {
  const url = splitUrl(code);
  const message = translate('live.shareMessage', { title, url });
  // Android кладёт ссылку в message; iOS показывает url отдельным вложением
  const res = await Share.share({ message, url, title });
  return res.action === Share.sharedAction;
}
