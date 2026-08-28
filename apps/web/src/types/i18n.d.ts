// Типобезопасные ключи: схема берётся из ru.json (эталон), поэтому t('...')
// с несуществующим ключом — ошибка компиляции, а не пустое место на экране.
import type ru from '@zap/locales/ru.json'

type Schema = typeof ru

declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends Schema {}
}

export {}
