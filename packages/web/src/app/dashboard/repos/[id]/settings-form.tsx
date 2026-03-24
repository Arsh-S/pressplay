'use client';

import { useState } from 'react';

interface Props {
  repoId: string;
  settings: {
    llmProvider: string | null;
    llmApiKey: string | null;
    previewUrlPattern: string | null;
    configJson: string | null;
  } | null;
}

export function SettingsForm({ repoId, settings }: Props) {
  const [provider, setProvider] = useState(settings?.llmProvider || 'anthropic');
  const [apiKey, setApiKey] = useState(settings?.llmApiKey || '');
  const [previewPattern, setPreviewPattern] = useState(settings?.previewUrlPattern || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    await fetch(`/api/settings/${repoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ llmProvider: provider, llmApiKey: apiKey, previewUrlPattern: previewPattern }),
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="text-[11px] uppercase tracking-[0.05em] text-zinc-500 mb-4">Preview Configuration</div>

      <div>
        <label className="text-[12px] text-zinc-400 mb-1.5 block">Preview URL Pattern</label>
        <input
          type="text"
          value={previewPattern}
          onChange={e => setPreviewPattern(e.target.value)}
          placeholder="https://deploy-preview-{pr}--myapp.netlify.app"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-zinc-50 placeholder:text-zinc-600 focus:ring-2 focus:ring-indigo-500/50 focus:outline-none transition-colors"
        />
        <p className="text-[11px] text-zinc-600 mt-1.5">Use {'{pr}'} as placeholder for the PR number</p>
      </div>

      <div className="text-[11px] uppercase tracking-[0.05em] text-zinc-500 mb-4 mt-8">LLM Configuration</div>

      <div>
        <label className="text-[12px] text-zinc-400 mb-1.5 block">LLM Provider</label>
        <select
          value={provider}
          onChange={e => setProvider(e.target.value)}
          className="w-full appearance-none bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-zinc-50 focus:ring-2 focus:ring-indigo-500/50 focus:outline-none transition-colors"
        >
          <option value="anthropic">Anthropic (Claude)</option>
          <option value="openai">OpenAI (GPT-4o)</option>
        </select>
      </div>

      <div>
        <label className="text-[12px] text-zinc-400 mb-1.5 block">API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder="sk-ant-..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-zinc-50 font-mono focus:ring-2 focus:ring-indigo-500/50 focus:outline-none"
        />
        <p className="text-[11px] text-zinc-600 mt-1.5">Your key is stored and used only for generating demo scripts</p>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
      >
        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
      </button>
    </form>
  );
}
