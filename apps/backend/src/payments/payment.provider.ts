// Единый интерфейс платёжного провайдера. MVP — внутренний леджер;
// адаптеры Payme/Click реализуют этот же контракт позже.
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER')

export interface PaymentResult {
  ok: boolean
  txId: string
  error?: string
}

export interface PaymentProvider {
  charge(userId: string, amountUzs: number, ref: string): Promise<PaymentResult>
  payout(userId: string, cardId: string, amountUzs: number, ref: string): Promise<PaymentResult>
}
