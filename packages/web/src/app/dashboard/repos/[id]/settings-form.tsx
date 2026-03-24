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
      <div>
        <label className="block text-sm font-medium mb-1">Preview URL Pattern</label>
        <input
          type="text"
          value={previewPattern}
          onChange={e => setPreviewPattern(e.target.value)}
          placeholder="https://deploy-preview-{pr}--myapp.netlify.app"
          className="w-full border rounded px-3 py-2 text-sm"
        />
        <p className="text-xs text-gray-400 mt-1">Use {'{pr}'} as placeholder for the PR number</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">LLM Provider</label>
        <select
          value={provider}
          onChange={e => setProvider(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
        >
          <option value="anthropic">Anthropic (Claude)</option>
          <option value="openai">OpenAI (GPT-4o)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder="sk-ant-..."
          className="w-full border rounded px-3 py-2 text-sm"
        />
        <p className="text-xs text-gray-400 mt-1">Your key is stored and used only for generating demo scripts</p>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="bg-black text-white text-sm px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
      >
        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
      </button>
    </form>
  );
}
