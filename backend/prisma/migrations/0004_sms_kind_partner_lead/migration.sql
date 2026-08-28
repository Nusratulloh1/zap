-- Новый вид SMS: уведомление менеджеру о заявке партнёра с лендинга
ALTER TYPE "SmsKind" ADD VALUE IF NOT EXISTS 'partner_lead';
