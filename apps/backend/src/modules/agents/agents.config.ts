import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentConfig, AgentsConfigFile } from './agents.types.js';

const defaultAgents: AgentConfig[] = [
  { id: 'claude', name: 'Claude Code', command: 'claude', args: ['-p', '{prompt}'], inputMode: 'argument', enabled: true },
  {
    id: 'codex',
    name: 'Codex',
    command: 'codex',
    args: ['exec', '--sandbox', 'workspace-write', '{prompt}'],
    inputMode: 'argument',
    enabled: true
  },
  { id: 'gemini', name: 'Gemini', command: 'gemini', args: ['-p', '{prompt}'], inputMode: 'argument', enabled: true },
  { id: 'opencode', name: 'OpenCode', command: 'opencode', args: ['run', '{prompt}'], inputMode: 'argument', enabled: true },
  { id: 'mimo', name: 'MiMo Code', command: 'mimo', args: ['run', '{prompt}'], inputMode: 'argument', enabled: true },
  { id: 'custom', name: 'Custom Agent', command: 'npx', args: ['my-agent'], inputMode: 'stdin', enabled: false }
];

export class AgentsConfigService {
  readonly path: string;
  readonly legacyPath: string;
  private config?: AgentsConfigFile;

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
    this.config = this.merge({
      agents: next.agents ?? this.value.agents,
      notifications: {
        ...this.value.notifications,
        ...next.notifications,
        telegram: {
          ...this.value.notifications.telegram,
          ...next.notifications?.telegram
        }
      }
    });
    await this.save();
    return this.value;
  }

  async save() {
    await fs.mkdir(path.dirname(this.path), { recursive: true });
    await fs.writeFile(this.path, `${JSON.stringify(this.value, null, 2)}\n`, 'utf8');
  }

  private async loadLegacyOrDefault() {
    const raw = await fs.readFile(this.legacyPath, 'utf8').catch(() => null);
    if (!raw) return this.merge({});
    return this.merge(JSON.parse(raw.replace(/^\uFEFF/, '')) as Partial<AgentsConfigFile>);
  }

  private merge(partial: Partial<AgentsConfigFile>): AgentsConfigFile {
    const agents = partial.agents ?? defaultAgents;
    const mergedAgents = [
      ...agents,
      ...defaultAgents.filter((agent) => !agents.some((item) => item.id === agent.id))
    ];

    return {
      agents: mergedAgents.map((agent) => {
        const fallback = defaultAgents.find((item) => item.id === agent.id);
        const needsKnownAgentArgsUpgrade =
          agent.id === 'codex' &&
          (!agent.args ||
            agent.args.length === 0 ||
            (agent.args.length === 2 && agent.args[0] === 'exec' && agent.args[1] === '{prompt}') ||
            agent.args.includes('--ask-for-approval'));
        return {
          ...agent,
          args: needsKnownAgentArgsUpgrade ? (fallback?.args ?? []) : agent.args && agent.args.length > 0 ? agent.args : (fallback?.args ?? []),
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
