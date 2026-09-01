# ZAP! — Product Vision (от руководства)

> Этот документ — видение продукта от руководства ZAP!. Тексты приведены **дословно**, без изменений; добавлены только оглавление, разбивка на секции и сводная таблица приоритетов для навигации. Это источник истины для всей продуктовой и motion-работы над ZAP!. Claude Code и команда должны сверяться с ним при реализации фич.
>
> Источник: сообщения Islam Aka (Akfa IT), 29.08.2026.

---

## Оглавление

- [Часть A — Micro-animations в ключевых действиях](#часть-a--micro-animations-в-ключевых-действиях)
- [Часть B — 4 слоя продукта: Motion → Social → Personality → Viral](#часть-b--4-слоя-продукта)
  - [1. Motion Layer](#1-motion-layer--что-нужно-сделать-как-анимации)
  - [2. Group Screen](#2-главная-доработка-внутри-продукта--group-screen)
  - [3. Reactions](#3-reactions--обязательно-внутрь-продукта)
  - [4. Funny Reminders](#4-funny-reminders)
  - [5. Themes](#5-themes--менять-атмосферу-split)
  - [6. ZAP Moments](#6-zap-moments)
  - [7. Shareable Cards](#7-shareable-cards)
  - [8. ZAP Characters / Avatars](#8-zap-characters--avatars)
  - [9. Empty States](#9-empty-states)
  - [10. Sound Design](#10-sound-design)
  - [11. QR experience в ресторане](#11-qr-experience-в-ресторане)
  - [12. Onboarding](#12-onboarding)
  - [13. ZAP Language](#13-zap-language)
  - [Спринты](#что-конкретно-надо-создавать--3-спринта)
- [Часть C — Психологическая система возврата (retention)](#часть-c--психологическая-система-возврата)
- [Сводная таблица приоритетов](#сводная-таблица-приоритетов)

---

# Часть A — Micro-animations в ключевых действиях

Micro-animations в ключевых действиях. Разделил счёт → чек буквально разрывается на части. Друг оплатил → его аватар «залетает» в paid. Все оплатили → большой ZAP!, конфетти и короткая анимация. Это сильно важнее обычных статичных экранов.

## ⚡ Split the Bill — главная signature-анимация

Это должна быть анимация, которую человек начинает ассоциировать именно с ZAP.

До действия: один общий чек на экране.

Нажимает Разделить счёт

- 0–150 ms — Чек слегка сжимается: scale 1 → 0.96
- 150–300 ms — По центру сверху вниз проходит яркая lime-молния.
- 300–550 ms — Чек физически разрывается на 3–4 части.
- 550–800 ms — Каждый кусок летит к своему аватару: Islam — 85 000 / Aziz — 120 000 / Timur — 95 000
- 800–1000 ms — Аватары получают lime-ring.
- 1000–1150 ms — Короткий: ZAP! ⚡ и затем экран становится обычным.

Sound: zzzt-pop. Haptic: medium один раз.

## 📷 QR Scan

Камера видит QR. Четыре scanner corners ⌜ ⌝ быстро схлопываются к QR. Потом lime линия проходит ↓, QR на ~100ms становится полностью lime. ZAP! и карточка счёта словно выезжает из QR.

То есть пользователь чувствует не: QR → loading → page, а: QR → превращается в счёт. Это намного интереснее.

## 🎉 Everyone Paid

Самая эмоциональная анимация. Последний человек оплачивает. Все аватары ○ ○ ○ ○ быстро прилетают к центру → ⚡ ← короткая lime-вспышка. Потом: ZAP! Everyone's paid. И буквально 5–7 небольших particles ⚡ ✦ • ⚡ ✦. Всё занимает ~1.3 сек. После автоматически появляется: Share this moment →

## ✅ Friend Paid

До оплаты: Aziz / 85 000 сум / серый avatar ring. При оплате: серое кольцо быстро заполняется lime по окружности → ✓ → аватар слегка подпрыгивает. Рядом: Aziz zapped ⚡ на 300 ms. Очень важно: вместо обычного boring Paid.

## 👤 Friend Added

Нажал + Добавить друга. Аватар буквально залетает в компанию сбоку: scale 0 → 1.08 → 1, маленький поворот -8° → 0°, вокруг две lime spark. После: Aziz joined ⚡. Не отдельный popup — текст появляется рядом и растворяется.

## 👀 Reminder

Вот это можно сделать фирменной механикой. Пользователь нажимает: Напомнить Timur. Из его аватара вылетает маленькая ⚡ и летит к аватару Timur. Аватар Timur: shake left → right → center и появляется: Pinged 👀. Вместо скучного: Reminder sent.

Я бы даже кнопку не называл Напомнить. Сделать: ⚡ Zap him или локализованно: ⚡ Пингануть

---

# Часть B — 4 слоя продукта

Я бы разложил ZAP! не как набор случайных «прикольных фишек», а как 4 слоя продукта: Motion → Social → Personality → Viral. Тогда понятно, что надо рисовать, что анимировать, а что реально дорабатывать в продукте.

## 1. Motion Layer — что нужно сделать как анимации

Важно: GIF лучше использовать как референс, презентационный материал и маркетинг. В самом приложении лучше потом реализовывать через Rive / Lottie / native animation, иначе GIF будет тяжёлым и плохо адаптироваться.

| Фича | Что происходит | Что сначала создать | Где используется | Приоритет |
|---|---|---|---|---|
| ⚡ Split the Bill | Чек разрывается на части и летит друзьям | GIF + потом Rive/Lottie | Кнопка «Разделить» | 🔥 P0 |
| 📷 QR Scan | QR сканируется → превращается в счёт | GIF → Rive/native | После сканирования QR | 🔥 P0 |
| ✅ Friend Paid | Avatar ring становится lime + ✓ | Rive/native | Group Bill Screen | 🔥 P0 |
| 🎉 Everyone Paid | Все оплатили → ZAP! + particles | GIF + Rive | Закрытие счёта | 🔥 P0 |
| ⚡ Reminder | Молния летит к другу | GIF → Rive | Кнопка напоминания | P1 |
| 👤 Friend Joined | Новый аватар залетает в группу | Native animation | Добавление друга | P1 |
| 💸 Payment Sent | Деньги/receipt улетают | Rive | После оплаты | P1 |
| 🧾 Receipt Loading | Чек раскрывается при загрузке | Lottie | Loading state | P2 |
| 👀 Waiting for Friend | Персонаж/глазки ждут оплату | Lottie | Pending state | P2 |
| 🎊 Milestone | 5-й/10-й split | Rive | ZAP Moments | P2 |

Первые GIF, которые я бы реально сделал: 1. Split the Bill 2. QR Scan 3. Everyone Paid 4. Reminder 5. Friend Paid. Это будет твой ZAP Motion Pack.

## 2. Главная доработка внутри продукта — Group Screen

Сейчас именно этот экран должен стать сердцем ZAP.

Не просто: Total: 420,000 UZS

А визуально:

### Dinner at Bellissimo 🍕
420 000 UZS
3 / 4 paid

Вокруг центрального чека: Islam 105k ✓ / Aziz 105k ✓ / Timur 105k ⏳ / Sardor 105k ✓

Оплатившие — яркие lime. Не оплативший — серый. Когда человек платит, его карточка сразу оживает.

### Что добавить в этот экран

| Элемент | Что делает |
|---|---|
| Аватары | Делает split человеческим |
| Paid / Pending states | Мгновенно понятно, кто заплатил |
| Emoji reaction | Можно отреагировать на оплату |
| ⚡ Reminder | Напомнить другу |
| Progress | 3 of 4 paid |
| Receipt | Центральный объект всего UX |
| Merchant logo | Bellissimo / EVOS / Safia |
| Share | Поделиться результатом |
| Theme | Pizza / Coffee / Taxi / Trip |

Это уже не payment screen. Это мини-комната компании друзей.

## 3. Reactions — обязательно внутрь продукта

После того как человек оплатил: Aziz paid 85 000 UZS. Под ним маленькие реакции: ⚡ 😂 ❤️ 🫡 🤝. Один tap — реакция отправлена. Можно даже показывать: Islam ⚡ Aziz.

Очень небольшая функция технически, но она сильно меняет ощущение продукта. Не банк. Не Click. Не Payme. Social payment experience.

## 4. Funny Reminders

Это уже не дизайн, а продукт + тексты + push notifications.

Не писать: «Payment request pending.» Писать: «👀 Timur ещё не оплатил» или «⚡ Остался один человек» или «🍕 Пицца закончилась. Счёт ещё нет.» или «Timur, мы всё помним 👀». Для ZAP я бы сделал целую библиотеку.

### Внутри приложения
Кнопка: ⚡ Напомнить. После нажатия: молния летит к аватару. Pinged ⚡

### Push
«👀 Тебя ждут / В ZAP осталось оплатить 65 000 сум.» А не сухой банковский push.

## 5. Themes — менять атмосферу split

Не надо создавать разные приложения. Меняется только несколько элементов.

| Сценарий | Theme |
|---|---|
| 🍕 Restaurant | Pizza / food stickers |
| ☕ Coffee | Coffee / croissant |
| 🚕 Taxi | Car / road |
| ✈️ Trip | Plane / suitcase |
| 🎁 Gift | Box / ribbon |
| 🪩 Party | Disco / confetti |
| 🛒 Shopping | Bags / receipt |

Например человек сканирует QR в EVOS. ZAP автоматически знает merchant category. Экран получает лёгкую food-theme. Не весь UI становится зелёной пиццей. Просто: стикер + микро-анимация + небольшой фоновой элемент.

## 6. ZAP Moments

Вот здесь ZAP может стать реально sticky. Это небольшие достижения, но без превращения продукта в игру.

### First ZAP ⚡ — Your first bill together.
### 5 bills together 🍕 — You guys are becoming professionals.
### 10 ZAPs ⚡
### 1 000 000 UZS split together
### Friday Crew — 3 Friday dinners together.

После этого: Share Moment. И генерируется красивая карточка.

## 7. Shareable Cards

Очень важная штука для органического роста. После оплаты:

> ⚡ ZAP COMPLETE / Bellissimo / 4 friends / 680 000 UZS / Everyone paid.

Внизу: ZAP! Кнопка: Share → Telegram / Instagram Stories. Эта карточка должна автоматически генерироваться. Это уже продуктовая разработка, а не просто картинка.

## 8. ZAP Characters / Avatars

Не надо превращать всё в Duolingo. Но небольшая система персонажей будет полезной. Например: 🧾 Receipt character / ⚡ Lightning character / 💳 Card character. И несколько человеческих avatar styles. Использовать их: empty states / loading / onboarding / success screens / notifications. Не на каждом экране.

## 9. Empty States

Вот где твои стикеры особенно полезны.

### Нет друзей — Иллюстрация: один receipt character сидит один. > Здесь пока тихо 👀 / Добавь друзей.
### Нет чеков — Receipt в очках. > Первый ZAP ещё впереди ⚡
### Все оплачено — Персонаж празднует. > Всё закрыто. Красиво.

Тут не нужны GIF обязательно. Можно использовать те 4–5 high-quality assets, которые мы уже начали делать.

## 10. Sound Design

Это маленькая вещь, но очень влияет на ощущение бренда. Нужно максимум 4 фирменных звука:

| Событие | Sound |
|---|---|
| Split | zzap |
| Paid | pop |
| Everyone paid | zap-pop! |
| Reminder | короткий bzzt |

Очень короткие. 150–400ms. И обязательно с haptic.

## 11. QR experience в ресторане

То, что мы уже начали делать, нужно превратить в систему. Не один QR poster. А несколько вариантов: «Разделите счёт с друзьями ⚡» / «Hisobni do'stlaringiz bilan bo'ling!» / QR / «Сканируй → Раздели → Оплати». Плюс специальные версии: «Кто сегодня платит? 👀» / «Не переводи другу. Раздели сразу.» / «Один чек. Несколько друзей.» Это уже offline acquisition channel ZAP.

## 12. Onboarding

Очень важно не делать fintech onboarding. Нет.

- Экран 1: **Один чек. Несколько друзей.** Анимация одного receipt.
- Экран 2: **Раздели ⚡** Чек разрывается.
- Экран 3: **Каждый платит свою часть.** Аватары получают части.
- Экран 4: **Done.** ZAP!

Это буквально 10 секунд.

## 13. ZAP Language

Это надо прописать отдельно как UX Writing Guide.

- не «Transaction successful» → а «Оплачено ⚡»
- не «Payment request created» → а «Запрос отправлен»
- не «All participants have completed payment» → а «Все оплатили. Красиво. ⚡»
- не «Remind participant» → а «Напомнить 👀»

Это огромная часть молодежного ощущения.

### ZAP slang / vocabulary
Я бы даже создал собственные короткие термины: Zap it / Zapped / Zap request / Zap group / Fully Zapped ⚡. На русском/узбекском можно оставить брендовые английские слова там, где они звучат естественно. Это помогает продукту стать отдельной культурой, а не очередным payment app.

## Что конкретно надо создавать — 3 спринта

### SPRINT 1 — Make ZAP feel alive
5 GIF / motion prototypes (Split / QR Scan / Paid / Everyone Paid / Reminder). И внутри продукта: Group Screen redesign / Paid-Pending states / progress / avatar states / haptic / basic sounds.

### SPRINT 2 — Make ZAP social
Reactions / Funny reminders / Shareable cards / merchant themes / better avatars. После этого ZAP уже начинает сильно отличаться от обычного payment app.

### SPRINT 3 — Make ZAP memorable
ZAP Moments / milestones / characters / dynamic empty states / special restaurant QR campaigns / seasonal themes / animated onboarding.

### Если совсем приоритизировать
Я бы не тратил сейчас время на ещё 100 стикеров. Визуального материала уже достаточно. Следующие деньги и время лучше вложить в: **Motion → Group Screen → Reactions → Reminder → Share Card.** Вот эти пять вещей реально изменят сам продукт.

> **Мы не приложение для перевода денег. Мы делаем момент, когда компания делит деньги между собой, быстрым, социальным и приятным.**

---

# Часть C — Психологическая система возврата

Для ZAP! я бы строил не просто «молодёжный дизайн», а психологическую систему возврата: человек открывает приложение не потому, что ему надо перевести деньги, а потому что там есть его компания, история, эмоции и маленькое социальное действие.

| Психологический триггер | Что сделать в ZAP! | Почему работает |
|---|---|---|
| Social gravity | Постоянные группы друзей / ZAP Crews | Люди возвращаются туда, где уже находятся их друзья |
| Identity | Свой avatar, nickname, цвет, reaction style | Продукт становится «моим» |
| Progress | 3/4 оплатили, animated progress | Хочется завершить незакрытый цикл |
| Recognition | «Islam закрыл счёт ⚡» | Маленькое социальное признание |
| Memory | История совместных вечеров | Приложение хранит моменты, а не только транзакции |
| Surprise | Редкие неожиданные animations/messages | Создаёт delight без казино-механик |
| Status | Crew achievements | Даёт повод пользоваться снова |
| Reciprocity | Кто платил прошлый раз | Снимает социальную неловкость |
| Personalization | Themes по ресторану/компании | Каждый session немного отличается |
| Immediate feedback | Motion + haptic + sound | Каждое действие ощущается приятно |

## 1. Сделай ZAP Crew
Одна из самых сильных будущих функций. После нескольких совместных split: «Создать Crew? Friday Boys ⚡ 4 участника». В следующий раз компания не выбирает всех заново. Открывает Friday Boys. Внутри: общие чеки; кто сейчас должен оплатить; реакции; общая статистика; любимые места; последние ZAP Moments. Тогда ZAP превращается из инструмента в social object.

## 2. Сделай экран Home живым
Не надо открывать ZAP и видеть обычный fintech dashboard (Balance / Transactions / Payments) — это убивает позиционирование. Главный экран может говорить: **👋 Сегодня кто платит?** Ниже: Friday Crew / 4 friends / Последний ZAP: вчера 🍕. И большая кнопка: **⚡ SPLIT**. Далее карточки: «Aziz ждёт 65 000 сум 👀» / «Dinner вчера полностью закрыт ✓» / «Вы с Timur разделили 8 счетов». Home должен выглядеть как life activity, а не банк.

## 3. Сделай Live Bill
Когда компания сидит за столом, экран должен изменяться в realtime. Bellissimo 🍕 640 000 сум / ○ Islam 160k ✓ / ○ Aziz 160k ✓ / ○ Timur 160k paying… / ○ Ali 160k. Когда Timur оплачивает: Timur paid ⚡ и все участники одновременно это видят. «Мы все сейчас внутри одного события». Похожая психология делает multiplayer значительно интереснее single-player интерфейса.

## 4. Показывай лица намного больше
Fintech любит +998… / 85 000 UZS. ZAP должен любить 😎 Timur / 🤓 Aziz / 🧢 Islam. Человеческое лицо намного сильнее денег как визуальный объект. На group screen я бы сделал аватары крупными. Деньги вторичны.

## 5. Сделай Who's left?
После оплаты: **3/4 ⚡** — три аватара яркие, один (Timur 👀) серый. Никаких агрессивных red alert. Но мозг автоматически видит незакрытый цикл. Это мотивирует компанию закончить процесс.

## 6. Вместо streak сделай Crew History
Не 🔥 17-day streak — для приложения оплаты это искусственно. Лучше: YOUR CREW / 🍕 8 dinners / ☕️ 12 coffees / 🚕 4 rides / ⚡ 31 ZAPs. А потом: «50-й ZAP вместе ⚡» — настоящий milestone.

## 7. Who paid last time?
Очень полезная социальная функция. ZAP показывает contextual hint: «👀 В прошлый раз платил Aziz.» или «Islam закрыл последние 2 счёта.» Не для строгого бухгалтерского расчёта. А чтобы убрать вечное «Кто платит?» Это может стать killer feature.

## 8. Сделай ZAP Recap
В конце месяца: **Your August ⚡** / 12 ZAPs / 🍕 5 dinners / ☕️ 4 coffees / 🚕 3 rides / 2 840 000 сум разделено между друзьями / Your #1 ZAP Buddy Aziz 😎 / Favourite spot EVOS 🌯. И: Share. Молодёжь реально может шерить. По сути: Spotify Wrapped для совместных расходов.

## 9. Merchant personalities
Когда QR от конкретного ресторана, продукт может немного менять характер. EVOS 🌯 / Bellissimo 🍕 flying pizza / Safia 🍰. Не менять весь интерфейс. Достаточно 10–15% визуального слоя. «ZAP знает, где я нахожусь.»

## 10. Random ZAP Moments
Не каждый раз. Иногда после оплаты вместо стандартного success: **LEGENDARY SPLIT ⚡** или **100% PAID / Nobody disappeared 👀** или **CLEAN ZAP / 4/4 paid in 47 sec.** Редкость здесь важна. Если такое появляется всегда — перестаёт приносить удовольствие.

## 11. Funny statistics
Не только деньги. Fastest payer Aziz — 8 sec ⚡ / Always last Timur 👀 / Biggest dinner 1 850 000 сум 🍕 / Your ZAP buddy Sardor 🤝 12 dinners together. Не надо превращать всё в leaderboard. Это скорее социальные шутки.

## 12. Маленькие «титулы»
⚡ Fastest Finger / 🍕 Pizza CFO / 👀 Last Payer / 🤝 Reliable One / 💸 Big Spender / ☕ Coffee Addict. Но лучше делать их ироничными, а не как банковские badges.

## 13. Profile должен быть социальным
Не «Islam Karimov / +998… / Settings». А: **ISLAM ⚡** / @islam / 27 ZAPs / 👥 5 Crews / 🍕 Favourite split Dinner / ⚡ Fastest payment 6 sec. И коллекция 3–4 earned stickers. Профиль становится частью identity.

## 14. Пользовательские названия счетов
После QR автоматически: Bellissimo. Но пользователь может поставить: «🍕 Boys Dinner» или «Ali's birthday 🎂» или «Bad decisions #4 😂». Потом эти названия появляются в истории. Очень маленькая фича, но делает деньги воспоминаниями.

## 15. Photo Moment
После закрытия счёта: Add a photo 📸. Сделали фотографию компании. Она сохраняется рядом с: 640 000 сум / 4 friends / Bellissimo. Через год: **One year ago ⚡** и показывается этот момент. Здесь ZAP вообще перестаёт быть просто payment app.

## 16. Реакции прямо на деньги
Aziz 120 000 сум ✓. Islam reacted 😂 / Timur 🫡 / Sardor ⚡. Это гораздо лучше комментариев. Нулевой friction.

## 17. Фирменный курсор / loader
Даже loading должен быть ZAP. Не ○ ○ ○. А маленькая ⚡ которая перескакивает ● → ● → ●, или receipt 🧾 → ⚡ → 🧾. Мелочь, но именно такие детали создают ощущение дорогого consumer продукта.

## 18. Dynamic Island / Live Activity
Если технически сможете на iPhone: ZAP · Bellissimo / 3 of 4 paid / ████████░░ / ⚡ Timur left. И обновлять состояние прямо с lock screen. Для молодёжной аудитории очень хороший wow-effect.

## 19. Homescreen widget
Небольшой: Friday Crew ⚡ Nothing owed ✓, или Dinner 3/4 paid. Ещё одна точка возврата без push spam.

## 20. QR → magic transition
Пользователь сканирует QR. Не должно быть QR → loading → обычный экран. А: QR начинает светиться lime. Из него физически появляется receipt. QR исчезает. Чек разворачивается. 640 000 UZS. Так даже utility action ощущается магическим.

## Что особенно важно психологически — 4 чувства
1. **«Мои люди здесь»** — Crew / avatars / reactions / shared history
2. **«Хочется закончить»** — 3/4 paid / pending avatar / live progress
3. **«Приятно нажимать»** — motion / haptic / sound / micro-feedback
4. **«Хочу показать другим»** — Recap / Moments / funny stats / share cards

## ⚡ ZAP Memory (большая концепция)
ZAP постепенно создаёт историю твоей компании. Не «Transactions», а «Your moments»: 24 August 🍕 Dinner at Bellissimo 4 friends / 19 August ☕ Coffee Islam · Aziz / 14 August 🎂 Ali's birthday 7 friends / 8 August 🚕 Airport ride 3 friends.

Пользователь через несколько месяцев начинает терять что-то ценное, если перестаёт пользоваться ZAP. Не потому что его удерживают streak'ом. А потому что там накопилась его социальная история. Это потенциально самый сильный retention moat для ZAP.

### Если выбирать только 7 вещей для V1/V1.5
**ZAP Crews → Live Bill → Reactions → Who's Left → Funny Reminder → ZAP Moment → Monthly Recap.** А уже вокруг этого накручивать motion, sounds, stickers, QR, avatars и themes.

---

# Сводная таблица приоритетов

> Собрано из явных приоритетов руководства («Если совсем приоритизировать» и «7 вещей для V1/V1.5»). P0 = сначала.

| # | Фича | Слой | Приоритет (по рук-ву) | Требует бэкенд? |
|---|---|---|---|---|
| 1 | Group / Live Bill Screen (avatars, paid/pending, progress, realtime) | Social + Motion | 🔥 первым («сердце ZAP») | нет (данные есть) |
| 2 | Split the Bill animation | Motion | 🔥 P0 | нет |
| 3 | Everyone Paid animation + particles | Motion | 🔥 P0 | нет |
| 4 | Friend Paid animation (ring→lime) | Motion | 🔥 P0 | нет |
| 5 | QR → receipt magic transition | Motion | 🔥 P0 | нет |
| 6 | Reactions (emoji на оплату) | Social | P0 (в списке 7) | да (reactions) |
| 7 | Who's Left | Social | P0 (в списке 7) | нет |
| 8 | Reminder animation + «⚡ Пингануть» | Motion + Social | P1 (в списке 7) | нет (SMS/push есть) |
| 9 | ZAP Language / UX writing guide | Personality | высокий, дешёвый | нет |
| 10 | Funny reminders library (push + in-app) | Personality | P1 | да (push) |
| 11 | Shareable Cards | Viral | P0 (в списке 7) | частично |
| 12 | ZAP Crews | Social | V1/V1.5 (в списке 7) | да (crews) |
| 13 | ZAP Moments / milestones | Personality | P2 | да |
| 14 | Monthly Recap (Spotify Wrapped) | Viral | V1/V1.5 (в списке 7) | да (агрегация) |
| 15 | Merchant themes | Personality | P2 | частично |
| 16 | Empty states со стикерами | Personality | дешёвый, параллельно | нет |
| 17 | Sound design (4 звука) | Motion | вместе с анимациями | нет |
| 18 | Sticker system | Personality | «не тратить время на ещё 100» | нет |
| 19 | Custom bill names, Photo Moment, ZAP Memory | Personality/Retention | позже | да |
| 20 | Dynamic Island, Widget, Titles, Recap stats | Retention | позже | да |

**Явная рекомендация руководства по порядку:** Motion → Group Screen → Reactions → Reminder → Share Card.

**Куда стикеры (ответ на открытый вопрос):** empty states, success/loading экраны, onboarding — не на каждом экране (см. секции 8, 9 части B).
