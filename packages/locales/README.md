# @zap/locales

Единственный источник переводов. Импортируется обоими клиентами:

- веб — `@zap/locales/ru.json` (workspace-зависимость)
- мобильный — `@locales/ru.json` (babel-alias + metro watchFolders на эту папку)

Наборы ключей всех трёх файлов обязаны совпадать: `pnpm i18n:check`
входит в `build`, расхождение валит сборку.
