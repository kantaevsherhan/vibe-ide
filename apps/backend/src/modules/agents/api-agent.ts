import type { AgentConfig, AgentsConfigFile, RunOptions } from './agents.types.js';

const providers = [
  { id: 'api', name: 'Model API' },
  { id: 'ollama', name: 'Ollama' }
];

export function apiAgents(models: AgentsConfigFile['models']): AgentConfig[] {
  return providers.map(({ id, name }) => {
    const model = models[id as keyof typeof models].model.trim();
    return { id, name: model ? `${name} · ${model}` : name, enabled: Boolean(model), command: '', args: [], transport: 'api' };
  });
}

export async function completeWithApi(models: AgentsConfigFile['models'], agentId: string, prompt: string, signal: AbortSignal, options?: RunOptions) {
  const provider = providers.find(({ id }) => id === agentId);
  if (!provider) throw new Error('Unknown model provider.');

  const config = models[agentId as keyof typeof models];
  const base = config.baseUrl.trim().replace(/\/+$/, '');
  const url = new URL(`${base}/chat/completions`);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Model API base URL must be an HTTP(S) URL without credentials, query or fragment.');
  }
  const key = config.apiKey;
  const response = await fetch(url, {
    method: 'POST',
    redirect: 'error',
    headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({
      model: options?.model ?? config.model.trim(),
      reasoning_effort: options?.effort,
      messages: [
        { role: 'system', content: 'Assist with coding. Return explanations or suggested changes as text. You have no workspace tools.' },
        { role: 'user', content: prompt }
      ]
    }),
    signal
  });
  if (!response.ok) throw new Error(`Model API returned HTTP ${response.status}.`);

  const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
  const text = payload.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('Model API returned no text.');
  return text;
}
