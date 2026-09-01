// Человеческое имя заведения вместо юридического.
//
// Фискальный чек отдаёт название так, как оно записано в реестре:
// «ООО "ALIMBAYEV TRADE"», «MCHJ «BELLISSIMO PIZZA»». В шапке чека это
// читается как выгрузка из базы и вдобавок съедает ширину — до самого
// названия дело не доходит, строка обрывается на организационной форме.
//
// Здесь снимаем форму собственности и кавычки, а КАПС переводим в обычный
// регистр. Бренд не переписываем: если после чистки ничего не осталось,
// возвращаем исходную строку.

/** Формы собственности: RU, UZ (лат/кир), EN. */
const LEGAL_FORMS = [
  'ООО', 'ОАО', 'ЗАО', 'ПАО', 'АО', 'ИП', 'ЧП', 'ГУП', 'МЧЖ', 'ХК', 'ЯТТ', 'КФ',
  'MCHJ', 'XK', 'QK', 'YATT', 'AJ', 'MCHJ', 'OOO', 'CHP', 'DUK',
  'LLC', 'LTD', 'INC', 'CO',
];

const QUOTES = /["'«»“”„‘’]/g;

/** Слово целиком состоит из заглавных (для кириллицы toUpperCase не врёт). */
function isShouted(word: string): boolean {
  return word.length > 1 && word === word.toUpperCase() && word !== word.toLowerCase();
}

/**
 * Аббревиатура (KFC, BMW) — не крик, а написание. Отличаем по отсутствию
 * гласных: в слове языка они есть, в аббревиатуре обычно нет.
 */
function isAcronym(word: string): boolean {
  return word.length <= 4 && !/[aeiouyауоыиэяюёе]/i.test(word);
}

function titleCase(word: string): string {
  if (isAcronym(word)) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Короткое отображаемое имя заведения.
 *
 * «ООО "ALIMBAYEV TRADE"» -> «Alimbayev Trade»
 * «MCHJ «EVOS»»           -> «Evos»
 * «Bellissimo»            -> «Bellissimo» (не трогаем)
 */
export function merchantDisplayName(raw: string | null | undefined): string {
  if (!raw) return '';
  const cleaned = raw.replace(QUOTES, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return raw.trim();

  const words = cleaned.split(' ');
  const forms = new Set(LEGAL_FORMS.map((f) => f.toUpperCase()));
  // форма собственности бывает и в начале, и в конце («Alimbayev Trade LLC»)
  while (words.length > 1 && forms.has(words[0]!.toUpperCase().replace(/\./g, ''))) words.shift();
  while (words.length > 1 && forms.has(words[words.length - 1]!.toUpperCase().replace(/\./g, ''))) words.pop();

  // от названия ничего не осталось (строка была только формой) — отдаём как есть
  if (!words.length || words.every((w) => forms.has(w.toUpperCase().replace(/\./g, '')))) {
    return cleaned;
  }

  // ВЕСЬ КАПС читается как крик; смешанный регистр — авторское написание бренда
  const shouted = words.every((w) => isShouted(w) || !/[a-zа-я]/i.test(w));
  const out = shouted ? words.map(titleCase).join(' ') : words.join(' ');
  return out.trim() || cleaned;
}

/**
 * Похоже ли на юридическое название, а не на имя вечера.
 *
 * Пользователь переименовывает сплит во что угодно («🍕 Boys Dinner»,
 * «ДАЧА»), и это его текст — трогать нельзя. Чистим только там, где видно
 * реестр: форма собственности или кавычки вокруг названия.
 */
export function looksLikeLegalName(raw: string | null | undefined): boolean {
  if (!raw) return false;
  if (QUOTES.test(raw)) {
    QUOTES.lastIndex = 0; // regex с /g хранит позицию между вызовами
    return true;
  }
  const forms = new Set(LEGAL_FORMS.map((f) => f.toUpperCase()));
  return raw
    .replace(QUOTES, ' ')
    .split(/\s+/)
    .some((w) => forms.has(w.toUpperCase().replace(/\./g, '')));
}

/** Заголовок чека: юридическое имя чистим, пользовательское оставляем как есть. */
export function receiptTitle(raw: string | null | undefined): string {
  if (!raw) return '';
  return looksLikeLegalName(raw) ? merchantDisplayName(raw) : raw;
}
