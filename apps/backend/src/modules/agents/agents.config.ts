import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentConfig, AgentsConfigFile } from './agents.types.js';

const defaultAgents: AgentConfig[] = [
  { id: 'claude', name: 'Claude Code', command: 'claude', args: ['-p', '{prompt}'], inputMode: 'argument', enabled: true },
  { id: 'codex', name: 'Codex', command: 'codex', args: ['exec', '{prompt}'], inputMode: 'argument', enabled: true },
  { id: 'gemini', name: 'Gemini', command: 'gemini', args: ['-p', '{prompt}'], inputMode: 'argument', enabled: true },
  { id: 'custom', name: 'Custom Agent', command: 'npx', args: ['my-agent'], inputMode: 'stdin', enabled: false }
];

export class AgentsConfigService {
  readonly path: string;
  private config?: AgentsConfigFile;

  constructor(projectRoot: string) {
    this.path = process.env.VIBEIDE_AGENTS_CONFIG ?? path.join(projectRoot, 'config', 'agents.config.json');
  }

  async load() {
    try {
      const raw = await fs.readFile(this.path, 'utf8');
      this.config = this.merge(JSON.parse(raw.replace(/^\uFEFF/, '')) as Partial<AgentsConfigFile>);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      this.config = this.merge({});
      await fs.mkdir(path.dirname(this.path), { recursive: true });
      await fs.writeFile(this.path, `${JSON.stringify(this.config, null, 2)}\n`, 'utf8');
    }

    return this.config;
  }

  get value() {
    if (!this.config) throw new Error('Agents config has not been loaded.');
    return this.config;
  }

  private merge(partial: Partial<AgentsConfigFile>): AgentsConfigFile {
    return {
      agents: (partial.agents ?? defaultAgents).map((agent) => {
        const fallback = defaultAgents.find((item) => item.id === agent.id);
        return {
          ...agent,
          args: agent.args && agent.args.length > 0 ? agent.args : (fallback?.args ?? []),
          inputMode: agent.inputMode ?? fallback?.inputMode ?? 'stdin'
        };
      }),
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
