// ⚡ ZAP Moments — милестоуны компании (vision §B6) и редкие случайные
// моменты после оплаты (§C10).
//
// Считаем из уже загруженного /bootstrap, как и crewStats: у компании десятки
// сплитов, отдельный endpoint был бы лишним деплоем и лишней рассинхронизацией.
//
// Два разных механизма, их важно не путать:
//   • Милестоун — событие «навсегда» (первый ZAP, десятый, миллион). Он
//     детерминирован, показывается ОДИН раз и запоминается в storage.
//   • Random moment — сюрприз. Видение прямо предупреждает: «Редкость здесь
//     важна. Если такое появляется всегда — перестаёт приносить удовольствие».
//     Поэтому и вероятность, и пауза между показами.
import type { Db, Split } from '@zap/shared/types';
import { storage } from '@/theme/ThemeProvider';

export type MomentKind =
  // §B6 — милестоуны
  | 'firstZap'
  | 'fiveBills'
  | 'tenZaps'
  | 'million'
  | 'fridayCrew'
  // §C10 — редкие случайные
  | 'cleanZap'
  | 'legendary'
  | 'nobodyLeft';

export interface Moment {
  kind: MomentKind;
  glyph: string;
  /** Милестоун показываем один раз; random — редкий сюрприз без запоминания. */
  milestone: boolean;
  /** подстановки в перевод moments.<kind>.title / .sub */
  vars?: Record<string, string | number>;
}

const SEEN_KEY = 'zap:moments-seen';
const LAST_RANDOM_KEY = 'zap:moment-last';
const LAST_RANDOM_SPLIT_KEY = 'zap:moment-last-split';

/** Порог «миллион вместе» из §B6. */
const MILLION = 1_000_000;
/** CLEAN ZAP — счёт закрыт быстрее этого. */
const CLEAN_MS = 120_000;
/** Насколько часто вообще выпадает случайный момент. */
const RANDOM_CHANCE = 0.25;
/** И не чаще раза в трое суток, иначе «редкость» перестаёт быть редкостью. */
const RANDOM_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

function seenSet(): Set<string> {
  try {
    const raw = storage.getString(SEEN_KEY);
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/** Запомнить показанный милестоун. Вызывать из эффекта, не из рендера. */
export function markMomentSeen(kind: MomentKind) {
  const s = seenSet();
  s.add(kind);
  storage.set(SEEN_KEY, JSON.stringify([...s]));
}

/** Отметить, что случайный момент показан — чтобы выдержать паузу. */
export function markRandomShown(splitId: string, at = Date.now()) {
  storage.set(LAST_RANDOM_KEY, String(at));
  storage.set(LAST_RANDOM_SPLIT_KEY, splitId);
}

/**
 * Стабильное псевдослучайное 0..1 из id сплита.
 *
 * Именно из id, а не Math.random(): экран закрытого счёта можно открыть
 * повторно, и «сюрприз» не должен мигать то появляясь, то исчезая.
 */
function seeded(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** «Подпись» компании — состав без меня, отсортированный (как в suggestCrew). */
function signature(s: Split): string {
  return s.members
    .filter((m) => !m.isYou)
    .map((m) => m.contactId)
    .sort()
    .join('|');
}

const allPaid = (s: Split) => s.members.every((m) => m.status === 'paid' || m.status === 'debt');

/**
 * Момент для только что закрытого сплита, либо null.
 *
 * Чистая функция без побочных эффектов — её можно звать в рендере. Запись в
 * storage делают markMomentSeen / markRandomShown.
 */
export function momentFor(db: Db | undefined, split: Split | undefined): Moment | null {
  if (!db || !split || split.status !== 'closed') return null;
  // сольный счёт — не «момент компании»
  if (split.members.length < 2) return null;

  const closed = db.splits.filter((s) => s.status === 'closed' && s.members.length > 1);
  const at = split.closedAt ?? split.createdAt;
  // всё, что случилось не позже этого сплита: милестоун должен зависеть от
  // момента события, а не от того, сколько сплитов появилось потом
  const upto = closed.filter((s) => (s.closedAt ?? s.createdAt) <= at);
  const seen = seenSet();

  const milestone = (kind: MomentKind, glyph: string, vars?: Moment['vars']): Moment | null =>
    seen.has(kind) ? null : { kind, glyph, milestone: true, vars };

  // ——— §B6, от самого редкого к частому ———

  if (upto.length === 1) {
    const m = milestone('firstZap', '⚡');
    if (m) return m;
  }

  const totalUpto = upto.reduce((sum, s) => sum + s.total, 0);
  if (totalUpto >= MILLION && totalUpto - split.total < MILLION) {
    const m = milestone('million', '💸');
    if (m) return m;
  }

  if (upto.length === 10) {
    const m = milestone('tenZaps', '⚡');
    if (m) return m;
  }

  // Friday Crew — три пятничных ужина одним составом
  const sig = signature(split);
  if (sig) {
    const sameCrew = upto.filter((s) => signature(s) === sig);
    const fridays = sameCrew.filter((s) => new Date(s.closedAt ?? s.createdAt).getDay() === 5);
    if (fridays.length === 3) {
      const m = milestone('fridayCrew', '🍕');
      if (m) return m;
    }
    if (sameCrew.length === 5) {
      const m = milestone('fiveBills', '🍕', { n: 5 });
      if (m) return m;
    }
  }

  // ——— §C10, только если милестоуна не было ———

  // Пауза между сюрпризами — но не для того счёта, которому сюрприз уже
  // выпал: экран закрытого счёта открывают повторно, и момент, исчезнувший
  // со второго захода, выглядел бы как баг, а не как редкость.
  const last = Number(storage.getString(LAST_RANDOM_KEY) ?? 0);
  const lastSplit = storage.getString(LAST_RANDOM_SPLIT_KEY);
  if (lastSplit !== split.id && Date.now() - last < RANDOM_COOLDOWN_MS) return null;
  if (seeded(split.id) > RANDOM_CHANCE) return null;
  if (!allPaid(split)) return null;

  const secs = split.closedAt ? Math.round((split.closedAt - split.createdAt) / 1000) : null;

  if (secs !== null && secs * 1000 <= CLEAN_MS && split.members.length >= 3) {
    return { kind: 'cleanZap', glyph: '⚡', milestone: false, vars: { n: split.members.length, sec: secs } };
  }
  if (split.total >= MILLION) {
    return { kind: 'legendary', glyph: '🔥', milestone: false };
  }
  if (split.members.length >= 4) {
    return { kind: 'nobodyLeft', glyph: '👀', milestone: false, vars: { n: split.members.length } };
  }
  return null;
}
