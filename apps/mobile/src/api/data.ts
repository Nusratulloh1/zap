// Данные приложения. Бэкенд отдаёт единую проекцию /bootstrap той же формы,
// что и мок веба (тип Db из @zap/shared), — поэтому экраны считают из неё всё
// то же самое, что веб-сторы.
import { http } from './client';
import type { Db } from '@zap/shared/types';

export function fetchBootstrap(): Promise<Db> {
  return http<Db>('/bootstrap');
}

/** Ключи react-query: один корень, чтобы инвалидировать всё одним вызовом. */
export const qk = {
  bootstrap: ['bootstrap'] as const,
  split: (id: string) => ['split', id] as const,
};
