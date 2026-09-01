// Сцена живого счёта: реестр анимируемых узлов экрана.
//
// Подписные анимации ZAP (vision, часть A) работают не с абстрактным UI,
// а с конкретными объектами: чек рвётся на куски, куски летят к аватарам,
// в конце все аватары сходятся в центр. Чтобы timeline мог их адресовать,
// экран регистрирует здесь свои узлы, а анимация потом измеряет их
// через measure() на UI-потоке.
//
// Сами анимации в этом проходе НЕ реализованы — здесь только точки крепления.
import { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import type { AnimatedRef } from 'react-native-reanimated';
import type { View } from 'react-native';

export type StageRef = AnimatedRef<View>;

export interface BillStage {
  /** Центральный чек: Split the Bill сжимает его, прогоняет молнию и рвёт. */
  receipt: { current: StageRef | null };
  /** Точка схождения для Everyone Paid: вспышка ZAP! и частицы. */
  center: { current: StageRef | null };
  /** Аватары участников по memberId: к ним летят куски чека, у них кольца. */
  members: Map<string, StageRef>;

  setReceipt: (ref: StageRef | null) => void;
  setCenter: (ref: StageRef | null) => void;
  setMember: (memberId: string, ref: StageRef | null) => void;
}

const Ctx = createContext<BillStage | null>(null);

export function useBillStageValue(): BillStage {
  const receipt = useRef<StageRef | null>(null);
  const center = useRef<StageRef | null>(null);
  const members = useRef(new Map<string, StageRef>()).current;

  const setReceipt = useCallback((ref: StageRef | null) => {
    receipt.current = ref;
  }, []);
  const setCenter = useCallback((ref: StageRef | null) => {
    center.current = ref;
  }, []);
  const setMember = useCallback(
    (memberId: string, ref: StageRef | null) => {
      if (ref) members.set(memberId, ref);
      else members.delete(memberId);
    },
    [members],
  );

  return useMemo(
    () => ({ receipt, center, members, setReceipt, setCenter, setMember }),
    [members, setReceipt, setCenter, setMember],
  );
}

export const BillStageProvider = Ctx.Provider;

/** Доступ к сцене из дочерних узлов (карточка участника, чек). */
export function useBillStage(): BillStage | null {
  return useContext(Ctx);
}
