// Сессия: стадии те же, что в вебе (onboarding → phone → code → pin → authed).
// Стадия переживает перезапуск: токены в Keychain, стадия и телефон — в MMKV.
import { create } from 'zustand';
import { storage } from '@/theme/ThemeProvider';
import * as auth from '@/api/auth';
import { restoreTokens, getTokens, setUnauthorizedHandler } from '@/api/client';
import { applyLocale, storedLocale, LOCALES, type Locale } from '@/i18n';

const KEY = 'zap:session';

interface Persisted {
  stage: auth.Stage;
  phone?: string;
}

function readPersisted(): Persisted {
  const raw = storage.getString(KEY);
  if (!raw) return { stage: 'onboarding' };
  try {
    const p = JSON.parse(raw) as Persisted;
    return p.stage ? p : { stage: 'onboarding' };
  } catch {
    return { stage: 'onboarding' };
  }
}

interface SessionState {
  stage: auth.Stage;
  phone?: string;
  me: auth.Me | null;
  hydrated: boolean;
  /** восстановление при старте: токены + стадия + язык аккаунта */
  hydrate: () => Promise<void>;
  startLogin: (phone: string) => Promise<{ devCode?: string }>;
  verifyCode: (code: string) => Promise<void>;
  createPin: (pin: string) => Promise<void>;
  logout: () => Promise<void>;
  reset: () => void;
}

function persist(stage: auth.Stage, phone?: string) {
  storage.set(KEY, JSON.stringify({ stage, phone } satisfies Persisted));
}

const isLocale = (v: string): v is Locale => (LOCALES as readonly string[]).includes(v);

export const useSession = create<SessionState>((set, get) => ({
  ...readPersisted(),
  me: null,
  hydrated: false,

  async hydrate() {
    const tokens = await restoreTokens();
    const persisted = readPersisted();

    // токенов нет — что бы ни было записано, дальше кода не пускаем
    if (!tokens) {
      const stage = persisted.stage === 'authed' || persisted.stage === 'pin' ? 'phone' : persisted.stage;
      set({ stage, phone: persisted.phone, hydrated: true });
      return;
    }

    set({ stage: persisted.stage, phone: persisted.phone });
    try {
      const profile = await auth.me();
      // язык аккаунта применяем, только если на устройстве ещё не выбирали —
      // локальный выбор всегда свежее серверного (как в вебе)
      if (profile.locale && !storedLocale() && isLocale(profile.locale)) {
        await applyLocale(profile.locale, { persist: false });
      }
      set({ me: profile, stage: 'authed', hydrated: true });
      persist('authed', persisted.phone);
    } catch {
      // сеть или протухший refresh — оставляем стадию, UI покажет ошибку
      set({ hydrated: true });
    }
  },

  async startLogin(phone) {
    const res = await auth.requestOtp(phone);
    set({ stage: 'code', phone });
    persist('code', phone);
    return res;
  },

  async verifyCode(code) {
    const phone = get().phone;
    if (!phone) throw new Error('no phone in session');
    const { needsPin } = await auth.verifyOtp(phone, code);
    const stage: auth.Stage = needsPin ? 'pin' : 'authed';
    set({ stage });
    persist(stage, phone);
    if (!needsPin) set({ me: await auth.me().catch(() => null) });
  },

  async createPin(pin) {
    await auth.setPin(pin);
    set({ stage: 'authed' });
    persist('authed', get().phone);
    set({ me: await auth.me().catch(() => null) });
  },

  async logout() {
    await auth.logout(getTokens()?.refreshToken);
    get().reset();
  },

  reset() {
    set({ stage: 'onboarding', phone: undefined, me: null });
    persist('onboarding');
  },
}));

// протухший refresh на любом запросе — сбрасываем сессию
setUnauthorizedHandler(() => useSession.getState().reset());
