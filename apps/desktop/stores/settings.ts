import { create } from 'zustand';
import type { ProviderId, ProviderCredential } from '@/lib/tauri';
import {
  storeProviderCredentials,
  getProviderCredentials,
  listStoredProviders,
  removeProviderCredentials,
  getSetting,
  setSetting,
  getAllSettings,
} from '@/lib/tauri';

interface ProviderState {
  credential: ProviderCredential | null;
  loading: boolean;
  error: string | null;
}

interface SettingsState {
  providers: Record<ProviderId, ProviderState>;
  settings: Record<string, string>;
  activeProvider: ProviderId | null;
  loading: boolean;
  error: string | null;

  init: () => Promise<void>;
  loadProvider: (providerId: ProviderId) => Promise<ProviderCredential | null>;
  saveProvider: (credential: ProviderCredential) => Promise<void>;
  removeProvider: (providerId: ProviderId) => Promise<void>;
  setActiveProvider: (providerId: ProviderId) => void;
  loadSetting: (key: string) => Promise<string | null>;
  saveSetting: (key: string, value: string) => Promise<void>;
  loadAllSettings: () => Promise<void>;
}

const initialProviders: Record<ProviderId, ProviderState> = {
  anthropic: { credential: null, loading: false, error: null },
  openai: { credential: null, loading: false, error: null },
  google: { credential: null, loading: false, error: null },
  deepseek: { credential: null, loading: false, error: null },
  ollama: { credential: null, loading: false, error: null },
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  providers: initialProviders,
  settings: {},
  activeProvider: null,
  loading: false,
  error: null,

  init: async () => {
    set({ loading: true, error: null });
    try {
      const [storedIds, allSettings] = await Promise.all([
        listStoredProviders(),
        getAllSettings(),
      ]);
      const providers = { ...get().providers };
      for (const id of storedIds) {
        try {
          const cred = await getProviderCredentials(id as ProviderId);
          providers[id as ProviderId] = { credential: cred, loading: false, error: null };
        } catch {
          // ignore
        }
      }
      const activeProvider = (allSettings['active_provider'] as ProviderId) ?? null;
      set({ providers, settings: allSettings, activeProvider, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  loadProvider: async (providerId) => {
    set((s) => ({
      providers: {
        ...s.providers,
        [providerId]: { ...s.providers[providerId], loading: true, error: null },
      },
    }));
    try {
      const cred = await getProviderCredentials(providerId);
      set((s) => ({
        providers: {
          ...s.providers,
          [providerId]: { credential: cred, loading: false, error: null },
        },
      }));
      return cred;
    } catch (e) {
      set((s) => ({
        providers: {
          ...s.providers,
          [providerId]: { credential: null, loading: false, error: String(e) },
        },
      }));
      return null;
    }
  },

  saveProvider: async (credential) => {
    const providerId = credential.provider_id;
    set((s) => ({
      providers: {
        ...s.providers,
        [providerId]: { ...s.providers[providerId], loading: true, error: null },
      },
    }));
    try {
      await storeProviderCredentials(credential);
      set((s) => ({
        providers: {
          ...s.providers,
          [providerId]: { credential, loading: false, error: null },
        },
      }));
    } catch (e) {
      set((s) => ({
        providers: {
          ...s.providers,
          [providerId]: { ...s.providers[providerId], loading: false, error: String(e) },
        },
      }));
      throw e;
    }
  },

  removeProvider: async (providerId) => {
    try {
      await removeProviderCredentials(providerId);
      set((s) => ({
        providers: {
          ...s.providers,
          [providerId]: { credential: null, loading: false, error: null },
        },
      }));
    } catch (e) {
      set((s) => ({
        providers: {
          ...s.providers,
          [providerId]: { ...s.providers[providerId], error: String(e) },
        },
      }));
    }
  },

  setActiveProvider: (providerId) => {
    set({ activeProvider: providerId });
    setSetting('active_provider', providerId).catch(() => {});
  },

  loadSetting: async (key) => {
    try {
      const value = await getSetting(key);
      if (value !== null) {
        set((s) => ({ settings: { ...s.settings, [key]: value } }));
      }
      return value;
    } catch {
      return null;
    }
  },

  saveSetting: async (key, value) => {
    await setSetting(key, value);
    set((s) => ({ settings: { ...s.settings, [key]: value } }));
  },

  loadAllSettings: async () => {
    try {
      const allSettings = await getAllSettings();
      set({ settings: allSettings });
    } catch (e) {
      set({ error: String(e) });
    }
  },
}));
