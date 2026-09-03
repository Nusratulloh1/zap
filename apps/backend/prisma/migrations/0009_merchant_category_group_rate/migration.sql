-- Категория заведения: для аналитики «на что уходит».
-- Раньше категорию угадывали по названию на клиенте, и «Коммуналка» с «Такси»
-- не определялись вовсе.
CREATE TYPE "MerchantCategory" AS ENUM ('food', 'coffee', 'grocery', 'utilities', 'taxi', 'shopping', 'fun', 'other');

ALTER TABLE "Merchant" ADD COLUMN "category" "MerchantCategory" NOT NULL DEFAULT 'other';

-- Ступенчатая ставка компании: 200 б.п. = 2% — стартовая ступень.
ALTER TABLE "Group" ADD COLUMN "cashbackRateBp" INTEGER NOT NULL DEFAULT 200;

-- Разовая простановка категорий существующим заведениям по названию.
UPDATE "Merchant" SET "category" = 'coffee'
 WHERE lower(name) SIMILAR TO '%(coffee|кофе|kofe|safia|bon|espresso|barista|cofix|starbucks)%';
UPDATE "Merchant" SET "category" = 'food'
 WHERE "category" = 'other'
   AND lower(name) SIMILAR TO '%(pizza|пицц|bellissimo|evos|feed|kfc|burger|бургер|lavash|лаваш|oqtepa|osh|плов|somsa|сомса|kafe|кафе|cafe|restoran|ресторан|choyxona|чайхана|sushi|суши|lagman|лагман)%';
UPDATE "Merchant" SET "category" = 'grocery'
 WHERE "category" = 'other'
   AND lower(name) SIMILAR TO '%(korzinka|корзинка|makro|макро|havas|market|маркет|magazin|магазин)%';
UPDATE "Merchant" SET "category" = 'taxi'
 WHERE "category" = 'other' AND lower(name) SIMILAR TO '%(taxi|такси|yandex|uber)%';
UPDATE "Merchant" SET "category" = 'utilities'
 WHERE "category" = 'other'
   AND lower(name) SIMILAR TO '%(kommunal|коммунал|gaz|газ|svet|свет|suv|вода|internet|интернет)%';
UPDATE "Merchant" SET "category" = 'fun'
 WHERE "category" = 'other' AND lower(name) SIMILAR TO '%(cinema|кино|imax|game|игров|bowling|боулинг)%';

-- Ставки компаний по уже накопленному пулу (ступени: 25к → 2.5%, 50к → 3%).
UPDATE "Group" SET "cashbackRateBp" = 250 WHERE "cashbackPool" >= 25000;
UPDATE "Group" SET "cashbackRateBp" = 300 WHERE "cashbackPool" >= 50000;
