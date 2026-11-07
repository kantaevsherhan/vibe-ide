import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentConfig, AgentsConfigFile } from './agents.types.js';
import { writeAtomicJson } from '../security/atomic-json.js';

const defaultAgents: AgentConfig[] = [
  { id: 'claude', name: 'Claude Code', command: 'claude', args: ['-p', '--permission-mode', 'acceptEdits', '{prompt}'], inputMode: 'argument', enabled: true },
  {
    id: 'codex',
    name: 'Codex',
    command: 'codex',
    args: ['exec', '--sandbox', 'workspace-write', '{prompt}'],
    inputMode: 'argument',
    enabled: true
  }
];

export class AgentsConfigService {
  readonly path: string;
  readonly legacyPath: string;
  private config?: AgentsConfigFile;
  private writes = Promise.resolve();

  constructor(projectRoot: string) {
    this.path = process.env.VIBEIDE_SETTINGS_CONFIG ?? path.join(projectRoot, 'config', 'settings.json');
    this.legacyPath = process.env.VIBEIDE_AGENTS_CONFIG ?? path.join(projectRoot, 'config', 'agents.config.json');
  }

  async load() {
    try {
      const raw = await fs.readFile(this.path, 'utf8');
      this.config = this.merge(JSON.parse(raw.replace(/^\uFEFF/, '')) as Partial<AgentsConfigFile>);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      this.config = await this.loadLegacyOrDefault();
      await this.save();
    }

    return this.config;
  }

  get value() {
    if (!this.config) throw new Error('Agents config has not been loaded.');
    return this.config;
  }

  async update(next: Partial<AgentsConfigFile>) {
    const write = this.writes.then(async () => {
      const updated = this.merge({
        agents: next.agents ?? this.value.agents,
        warmup: next.warmup ?? this.value.warmup,
        chronos: next.chronos ?? this.value.chronos,
        models: next.models ?? this.value.models,
        notifications: {
          telegram: {
            ...this.value.notifications.telegram,
            ...next.notifications?.telegram
          }
        }
      });
      await this.save(updated);
      this.config = updated;
      return updated;
    });
    this.writes = write.then(() => {}, () => {});
    return write;
  }

  private async save(config = this.value) {
    await writeAtomicJson(this.path, config);
  }

  private async loadLegacyOrDefault() {
    const raw = await fs.readFile(this.legacyPath, 'utf8').catch(() => null);
    if (!raw) return this.merge({});
    return this.merge(JSON.parse(raw.replace(/^\uFEFF/, '')) as Partial<AgentsConfigFile>);
  }

  private merge(partial: Partial<AgentsConfigFile>): AgentsConfigFile {
    return {
      models: partial.models ?? {
        api: { model: process.env.VIBEIDE_API_MODEL || '', baseUrl: process.env.VIBEIDE_API_BASE_URL || 'https://api.openai.com/v1', apiKey: process.env.VIBEIDE_API_KEY || '' },
        ollama: { model: process.env.VIBEIDE_OLLAMA_MODEL || '', baseUrl: process.env.VIBEIDE_OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1', apiKey: process.env.VIBEIDE_OLLAMA_KEY || '' }
      },
      agents: defaultAgents.map((fallback) => {
        const agent = partial.agents?.find((item) => item.id === fallback.id) ?? fallback;
        const needsKnownAgentArgsUpgrade =
          (agent.id === 'claude' && agent.args?.length === 2 && agent.args[0] === '-p' && agent.args[1] === '{prompt}') ||
          agent.id === 'codex' &&
          (!agent.args ||
            agent.args.length === 0 ||
            (agent.args.length === 2 && agent.args[0] === 'exec' && agent.args[1] === '{prompt}') ||
            agent.args.includes('--ask-for-approval'));
        return {
          ...agent,
          transport: undefined,
          args: needsKnownAgentArgsUpgrade ? (fallback?.args ?? []) : agent.args && agent.args.length > 0 ? agent.args : (fallback?.args ?? []),
          inputMode: agent.inputMode ?? fallback?.inputMode ?? 'stdin'
        };
      }),
      warmup: partial.warmup ?? { projectName: '', time: '04:30', timeZone: 'Asia/Qyzylorda', agents: [] },
      chronos: partial.chronos ?? {
        enabled: Boolean(process.env.VIBEIDE_CHRONOS_URL),
        url: process.env.VIBEIDE_CHRONOS_URL || 'https://chronos-beta-lyart.vercel.app/api/mcp',
        token: process.env.VIBEIDE_CHRONOS_TOKEN || '',
        projectName: process.env.VIBEIDE_CHRONOS_PROJECT || '',
        agentId: process.env.VIBEIDE_CHRONOS_AGENT === 'claude' ? 'claude' : 'codex'
      },
      notifications: {
        telegram: {
          enabled: partial.notifications?.telegram?.enabled ?? false,
          botToken: partial.notifications?.telegram?.botToken ?? '',
          chatId: partial.notifications?.telegram?.chatId ?? ''
        }
      }
    };
  }
}
