# Демо-доступ для ревью Apple

Отказ по Guideline 2.1(a): ревьюер не смог войти в приложение. Вход в ZAP! —
по SMS-коду на узбекский номер, а до Apple такая SMS не дойдёт. Поэтому нужен
демо-аккаунт, который логинится без реальной SMS.

## Учётные данные

| Поле | Значение |
|---|---|
| Телефон | `+998 90 000 00 91` (в поле ввода: `90 000 00 91`) |
| SMS-код | `424242` |
| PIN | `4242` |

Механика уже была в проде: номера из `TEST_PHONES` не отправляют SMS, а код
для них берётся из `TEST_OTP_CODE`. Всё остальное — лимиты, JWT, PIN, оплата —
работает как у обычного пользователя, так что ревьюер видит настоящее
приложение, а не заглушку.

Что было доделано под ревью: аккаунту задано имя (**Aziz Karimov**, `@zapdemo`)
и **известный PIN**. Раньше имя было пустым, а PIN стоял неизвестный — то есть
даже с правильным кодом ревьюер упирался бы в экран ввода PIN.

В аккаунте: 19 разделённых счетов, 63 записи истории, группа, контакты,
кэшбэк и привязанная карта — то самое «content that demonstrates the features»,
которого требует Apple.

Оплата в MVP — внутренний леджер (`InternalWalletProvider`), реальные деньги не
списываются. Ревьюер может пройти полный сценарий: создать сплит, разделить,
оплатить, закрыть.

## Что вписать в App Store Connect

TestFlight → Test Information → Beta App Review Information → включить
«Sign-in required»:

- **User Name:** `+998900000091`
- **Password:** `424242`

В поле **Notes** (или Review Notes для App Store) — текст ниже.

```
Sign-in is by phone number + SMS code. This is a demo account that does not
send a real SMS: the code is fixed.

1. On the phone screen the +998 prefix is fixed. Enter: 90 000 00 91
2. Enter the SMS code: 424242
3. Enter the PIN: 4242

The account is pre-filled with 19 split bills, payment history, a group of
friends and cashback, so all screens are populated.

Payments use an internal ledger in this build — no real money is charged, so
you can complete the full flow: scan or pick a venue, split a bill, pay,
and close it.

Camera permission is used for the QR scanner and for photographing a receipt.
If you prefer not to grant it, you can still create a split manually:
Home → SPLIT → pick friends → enter the amount.
```

## Если понадобится второй аккаунт

В `TEST_PHONES` на сервере лежат ещё `998900000092` и `998900000093` с тем же
кодом `424242`. У них нет ни имени, ни PIN, ни данных — при необходимости их
нужно готовить так же.

## Ответ Apple на отказ 2.1(a)

Текст ниже — то, что отправляется в App Store Connect ответом на сообщение
ревьюера, ПОСЛЕ того как заполнены поля Beta App Review Information.

```
Hello,

Thank you for the review. We have added demo account credentials in the Beta
App Review Information section of App Store Connect.

Sign-in uses a phone number and an SMS code. This is a demo account, so no
real SMS is sent — the code is fixed and always works.

How to sign in:

1. On the first screen the +998 country prefix is fixed. Enter the number:
   90 000 00 91
2. Tap Continue and enter the SMS code: 424242
3. Enter the PIN: 4242

The account is pre-populated with 19 split bills, payment history, a group of
friends, cashback and a saved card, so every screen shows real content.

Payments in this build use an internal ledger — no real money is charged.
You can therefore complete the full flow end to end: create a split, choose
participants, pay your share and close the bill.

Camera access is requested for the QR scanner and for photographing a paper
receipt. Granting it is optional: a bill can also be created manually from
Home → SPLIT → choose friends → enter the amount.

Please let us know if you need anything else.

Best regards,
ZAP! team
```
