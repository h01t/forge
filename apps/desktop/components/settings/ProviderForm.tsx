'use client';

import { useState, useEffect } from 'react';
import type { ProviderId, ProviderCredential } from '@/lib/tauri';
import { PROVIDERS } from '@/lib/tauri';
import { useSettingsStore } from '@/stores/settings';

interface ProviderFormProps {
  providerId: ProviderId;
}

export default function ProviderForm({ providerId }: ProviderFormProps) {
  const provider = PROVIDERS.find((p) => p.id === providerId)!;
  const { providers, saveProvider, removeProvider } = useSettingsStore();
  const existing = providers[providerId]?.credential;

  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState(provider.defaultModel);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (existing) {
      setApiKey(existing.api_key);
      setBaseUrl(existing.base_url ?? '');
      setModel(existing.model ?? provider.defaultModel);
    }
  }, [existing, provider.defaultModel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const credential: ProviderCredential = {
      provider_id: providerId,
      api_key: apiKey,
      base_url: baseUrl || undefined,
      model: model || undefined,
      created_at: existing?.created_at ?? Date.now(),
    };

    try {
      await saveProvider(credential);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    await removeProvider(providerId);
    setApiKey('');
    setBaseUrl('');
    setModel(provider.defaultModel);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-display font-semibold text-primary-500">
          {provider.name}
        </h3>
        {existing && (
          <span className="text-xs text-accent-500 status-online">CONFIGURED</span>
        )}
      </div>

      <div>
        <label className="block text-xs font-display text-text-tertiary uppercase tracking-widest mb-2">
          API Key
        </label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={`Enter ${provider.name} API key`}
            className="w-full cyber-input rounded-lg pr-20"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-tertiary hover:text-primary-500 transition-colors"
          >
            {showKey ? 'HIDE' : 'SHOW'}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-display text-text-tertiary uppercase tracking-widest mb-2">
          Base URL <span className="normal-case tracking-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.example.com/v1"
          className="w-full cyber-input rounded-lg"
        />
      </div>

      <div>
        <label className="block text-xs font-display text-text-tertiary uppercase tracking-widest mb-2">
          Model
        </label>
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={provider.defaultModel}
          className="w-full cyber-input rounded-lg"
        />
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-error-500/10 border border-error-500/30 text-error-500 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 rounded-lg bg-accent-500/10 border border-accent-500/30 text-accent-500 text-sm">
          Credentials saved successfully
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving || !apiKey}
          className="cyber-button text-sm px-6 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'SAVING...' : 'SAVE'}
        </button>
        {existing && (
          <button
            type="button"
            onClick={handleRemove}
            className="px-4 py-2 text-sm text-error-500 border border-error-500/40 rounded-lg hover:bg-error-500/10 transition-colors"
          >
            REMOVE
          </button>
        )}
      </div>
    </form>
  );
}
