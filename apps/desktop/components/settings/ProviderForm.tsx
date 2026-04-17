'use client';

import { useState } from 'react';
import { CheckCircle2, KeyRound, RadioTower, Sparkles } from 'lucide-react';
import type { ProviderCredential, ProviderId } from '@/lib/tauri';
import { PROVIDERS } from '@/lib/tauri';
import { useSettingsStore } from '@/stores/settings';

interface ProviderFormProps {
  providerId: ProviderId;
}

export default function ProviderForm({ providerId }: ProviderFormProps) {
  const provider = PROVIDERS.find((item) => item.id === providerId)!;
  const { providers, saveProvider, removeProvider } = useSettingsStore();
  const existing = providers[providerId]?.credential;

  const [apiKeyDraft, setApiKey] = useState<string | null>(null);
  const [baseUrlDraft, setBaseUrl] = useState<string | null>(null);
  const [modelDraft, setModel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  const apiKey = apiKeyDraft ?? existing?.api_key ?? '';
  const baseUrl = baseUrlDraft ?? existing?.base_url ?? '';
  const model = modelDraft ?? existing?.model ?? provider.defaultModel;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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

  if (provider.status === 'planned') {
    return (
      <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="shell-panel px-6 py-6">
          <div className="flex items-center gap-2 text-warning-500">
            <Sparkles size={15} />
            <span className="shell-kicker text-warning-500">Planned Integration</span>
          </div>
          <h4 className="mt-4 text-[1.85rem] font-display font-semibold text-text-primary">
            {provider.name} is on the roadmap
          </h4>
          <p className="mt-4 text-sm leading-8 text-text-secondary">
            This provider stays visible inside the registry so the shell shows the real platform
            direction, but credential storage and routing remain disabled until the Rust gateway is
            implemented.
          </p>
        </div>

        <div className="shell-panel-muted space-y-4 px-5 py-5">
          <div>
            <p className="shell-kicker text-primary-400">Default Target</p>
            <p className="mt-2 text-base font-medium text-text-primary">{provider.defaultModel}</p>
          </div>
          <div>
            <p className="shell-kicker text-primary-400">Availability</p>
            <p className="mt-2 text-sm leading-7 text-text-secondary">
              Visible in the settings workspace and chat routing surface as a planned provider, but
              intentionally non-interactive.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-[520px] flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="shell-panel space-y-5 px-6 py-6">
          <div>
            <div className="flex items-center gap-2 text-primary-400">
              <KeyRound size={15} />
              <span className="shell-kicker text-primary-400">Credentials</span>
            </div>
            <p className="mt-3 text-sm leading-7 text-text-secondary">
              Credentials are stored locally in the OS keyring and only used by the desktop shell.
            </p>
          </div>

          <div className="space-y-2">
            <label className="shell-kicker text-text-muted">API Key</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={`Enter ${provider.name} API key`}
                className="cyber-input h-14 w-full rounded-[20px] pr-20"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs uppercase tracking-[0.16em] text-text-tertiary transition-colors hover:text-primary-400"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="shell-kicker text-text-muted">Base URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://api.example.com/v1"
              className="cyber-input h-14 w-full rounded-[20px]"
            />
          </div>
        </section>

        <section className="shell-panel space-y-5 px-6 py-6">
          <div>
            <div className="flex items-center gap-2 text-primary-400">
              <RadioTower size={15} />
              <span className="shell-kicker text-primary-400">Routing Defaults</span>
            </div>
            <p className="mt-3 text-sm leading-7 text-text-secondary">
              Set the default model and keep the gateway status readable from the workspace.
            </p>
          </div>

          <div className="space-y-2">
            <label className="shell-kicker text-text-muted">Model</label>
            <input
              type="text"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder={provider.defaultModel}
              className="cyber-input h-14 w-full rounded-[20px]"
            />
          </div>

          <div className="shell-panel-muted space-y-3 px-4 py-4">
            <div className="flex items-center gap-2 text-accent-500">
              <CheckCircle2 size={15} />
              <span className="shell-kicker text-accent-500">Status</span>
            </div>
            <p className="text-sm text-text-primary">
              {existing ? 'This provider is configured and ready.' : 'No credentials saved yet.'}
            </p>
            <p className="text-xs leading-6 text-text-secondary">
              Default model: {provider.defaultModel}
            </p>
          </div>
        </section>
      </div>

      {error ? (
        <div className="rounded-2xl border border-error-500/30 bg-error-500/10 px-4 py-3 text-sm text-error-500">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-accent-500/30 bg-accent-500/10 px-4 py-3 text-sm text-accent-500">
          Credentials saved successfully.
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-border-subtle pt-4">
        <button
          type="submit"
          disabled={saving || !apiKey}
          className="cyber-button text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save Provider'}
        </button>

        {existing ? (
          <button
            type="button"
            onClick={handleRemove}
            className="rounded-2xl border border-error-500/35 bg-error-500/8 px-5 py-3 text-sm text-error-500 transition-all duration-200 hover:border-error-500/50 hover:bg-error-500/12"
          >
            Remove Credentials
          </button>
        ) : null}
      </div>
    </form>
  );
}
