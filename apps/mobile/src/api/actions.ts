// Остальные ручки приложения — формы запросов один в один с web/src/api/real.ts,
// чтобы поведение клиентов не разъезжалось.
import { http } from './client';
import { translate } from '@/i18n';
import type { Bill, Card, Contact } from '@zap/shared/types';

// ---------- долги ----------

export async function remindDebt(debtId: string): Promise<void> {
  await http(`/debts/${debtId}/remind`, { method: 'POST' });
}

export async function remindAllDebts(): Promise<void> {
  await http('/debts/remind-all', { method: 'POST' });
}

export async function repayDebt(debtId: string): Promise<void> {
  await http(`/debts/${debtId}/mark-returned`, { method: 'POST' });
}

// ---------- кэшбэк ----------

export async function spendCashbackNext(): Promise<number> {
  const res = await http<{ pendingCashback: number }>('/cashback/spend', { method: 'POST' });
  return res.pendingCashback;
}

export async function withdrawCashback(cardId: string, amount: number): Promise<void> {
  await http('/cashback/withdraw', {
    method: 'POST',
    pt: true,
    headers: { 'Idempotency-Key': `wd-${Date.now().toString(36)}` },
    body: JSON.stringify({ cardId, amount }),
  });
}

// ---------- группы ----------

export async function renameGroup(groupId: string, name: string): Promise<void> {
  await http(`/groups/${groupId}`, { method: 'PATCH', body: JSON.stringify({ name }) });
}

export async function deleteGroup(groupId: string): Promise<void> {
  await http(`/groups/${groupId}`, { method: 'DELETE' });
}

// ---------- карты / настройки / профиль ----------

export async function addCard(network: Card['network'], last4: string): Promise<Card> {
  return http<Card>('/cards', { method: 'POST', body: JSON.stringify({ brand: network, last4 }) });
}

export async function setPrimaryCard(cardId: string): Promise<void> {
  await http(`/cards/${cardId}/primary`, { method: 'POST' });
}

export async function toggleDebtNotifications(value: boolean): Promise<void> {
  await http('/settings', { method: 'PATCH', body: JSON.stringify({ debtNotifications: value }) });
}

export async function changePin(oldPin: string, newPin: string): Promise<boolean> {
  try {
    await http('/auth/pin/change', { method: 'POST', body: JSON.stringify({ oldPin, newPin }) });
    return true;
  } catch {
    return false;
  }
}

// ---------- оплата целиком / соло ----------

export async function payAlone(amount: number, merchantId?: string, title?: string): Promise<void> {
  await http('/payments/pay', {
    method: 'POST',
    pt: true,
    headers: { 'Idempotency-Key': `pay-${Date.now().toString(36)}` },
    body: JSON.stringify({ amount, title, merchantId }),
  });
}

// ---------- демо-чек ----------

export async function fetchFeaturedBill(): Promise<Bill | null> {
  // featuredBill лежит внутри /bootstrap — отдельной ручки нет
  const db = await http<{ featuredBill: Bill | null }>('/bootstrap');
  return db.featuredBill ?? null;
}

// ---------- QR / фискальные чеки ----------

export interface FiscalReceiptView {
  merchant?: string;
  total: number;
  source: string;
  items: { id: string; name: string; qty: number; unitPrice: number; amount: number }[];
}

export type QrResolved =
  | { type: 'split'; code: string }
  | { type: 'bill'; bill: Bill }
  | { type: 'fiscal'; instant: { totalAmount?: number; datetime?: string }; jobId?: string }
  | { type: 'unknown' };

export async function resolveQr(payload: string): Promise<QrResolved> {
  return http<QrResolved>('/qr/resolve?payload=' + encodeURIComponent(payload));
}

export async function fiscalStatus(jobId: string) {
  return http<{ status: 'pending' | 'ready' | 'failed'; receipt?: FiscalReceiptView }>('/qr/fiscal/' + jobId);
}

/** Фото чека → Gemini OCR. multipart, поле «image» — как в вебе. */
/** Дольше ждать нет смысла: пользователь уже решил, что приложение зависло. */
const OCR_TIMEOUT_MS = 45_000;

export async function fiscalOcr(uri: string): Promise<{ receipt?: FiscalReceiptView; itemsRecognized?: boolean }> {
  const form = new FormData();
  // RN FormData принимает {uri, type, name} — это его файловый формат
  form.append('image', { uri, type: 'image/jpeg', name: 'receipt.jpg' } as unknown as Blob);
  // Content-Type намеренно не задаём: см. http() — boundary ставит рантайм.
  //
  // Ограничение по времени обязательно: распознавание идёт на стороне модели,
  // и при плохой связи запрос может не завершиться никогда. Без него экран
  // превращения оставался бы в состоянии «читаем чек» бесконечно.
  return Promise.race([
    http<{ receipt?: FiscalReceiptView; itemsRecognized?: boolean }>('/qr/fiscal/ocr', {
      method: 'POST',
      body: form,
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(translate('scan.photoFailedShort'))), OCR_TIMEOUT_MS),
    ),
  ]);
}

// ---------- публичный вид сплита (/s/:code) ----------

export interface PublicView {
  code: string;
  title: string;
  status: string;
  totalAmount: number;
  paidTotal: number;
  paidCount: number;
  memberCount: number;
  merchant: { name: string; letter: string; color: string } | null;
  bill: { orderNo: string; total: number } | null;
  creatorName: string;
  cashbackX2: boolean;
  yourCashback: number | null;
  members: { id: string; name: string; initial: string; status: string; amount?: number; isYou?: boolean }[];
  yourShare: number | null;
  yourStatus: string | null;
}

export async function fetchPublicSplit(code: string, phone?: string): Promise<PublicView> {
  const q = phone ? `?phone=${encodeURIComponent(phone)}` : '';
  return http<PublicView>(`/s/${encodeURIComponent(code)}${q}`, { auth: false });
}

export async function markOpened(code: string, phone: string): Promise<void> {
  await http(`/s/${encodeURIComponent(code)}/open`, {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ phone }),
  }).catch(() => undefined);
}

/** Оплата доли участником: без code → сервер шлёт OTP; с code → списание. */
export async function payPublic(
  code: string,
  phone: string,
  amount: number,
  otp?: string,
): Promise<{ otpRequired?: boolean } & Partial<PublicView>> {
  return http(`/s/${encodeURIComponent(code)}/pay`, {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ phone, amount, code: otp }),
  });
}

// ---------- поиск и контакты (MembersPage) ----------

/** результат поиска пользователей ZAP! по @username / имени */
export interface UserSearchResult {
  id: string;
  name: string;
  handle: string;
  phone: string;
  initials: string;
  color: string;
}

export function searchUsers(query: string): Promise<UserSearchResult[]> {
  return http(`/users/search?q=${encodeURIComponent(query)}`);
}

/** Новый контакт по номеру; bootstrap инвалидирует вызывающий экран. */
export function addContact(phoneDigits: string, fullName?: string): Promise<Contact> {
  return http('/contacts', {
    method: 'POST',
    body: JSON.stringify({ phone: phoneDigits, name: fullName?.trim() || undefined }),
  });
}
