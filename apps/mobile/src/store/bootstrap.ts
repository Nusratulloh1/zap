// Производные данные главной. Веб держит их в девяти пиньях; здесь один
// react-query-запрос и селекторы над ним — данные всё равно приезжают одним
// /bootstrap, а дробить его на девять кэшей нет смысла.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchBootstrap, qk } from '@/api/data';
import type { Contact, Db, Group, Split } from '@zap/shared/types';

export function useBootstrap() {
  return useQuery({ queryKey: qk.bootstrap, queryFn: fetchBootstrap, staleTime: 30_000 });
}

export interface HomeData {
  db: Db | undefined;
  loading: boolean;
  contactById: (id: string) => Contact | undefined;
  /** активные сплиты — сверху, дальше по дате; как в вебе */
  splits: Split[];
  activeSplit: Split | undefined;
  groups: Group[];
  cashbackBalance: number;
  cashbackCount: number;
  totalOwedToMe: number;
  debtors: Contact[];
}

export function useHomeData(): HomeData {
  const { data: db, isLoading } = useBootstrap();

  return useMemo(() => {
    const contacts = db?.contacts ?? [];
    const byId = new Map(contacts.map((c) => [c.id, c]));
    const contactById = (id: string) => byId.get(id);

    const splits = [...(db?.splits ?? [])].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
      return b.createdAt - a.createdAt;
    });

    const openDebts = (db?.debts ?? []).filter((d) => d.direction === 'owedToMe' && d.status === 'open');
    const debtorIds = [...new Set(openDebts.map((d) => d.contactId))];

    return {
      db,
      loading: isLoading,
      contactById,
      splits,
      activeSplit: splits.find((s) => s.status === 'active'),
      groups: db?.groups ?? [],
      cashbackBalance: (db?.cashbackEntries ?? []).reduce((sum, e) => (e.held ? sum : sum + e.amount), 0),
      cashbackCount: (db?.cashbackEntries ?? []).length,
      totalOwedToMe: openDebts.reduce((sum, d) => sum + d.amount, 0),
      debtors: debtorIds.map(contactById).filter((c): c is Contact => !!c),
    };
  }, [db, isLoading]);
}
