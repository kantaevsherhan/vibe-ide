import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { AgentsConfigService } from './agents.config.js';
import type { AgentsService } from './agents.service.js';
import type { AgentTask, WarmupConfig } from './agents.types.js';

interface ChronosItem {
  id: string;
  kind: string;
  updatedAt: number;
  deleted: boolean;
  data: {
    title?: string;
    note?: string;
    project?: string;
    done?: boolean;
    vibeide?: { taskId: string; status: string; reviewTaskId?: string; reviewStatus?: string };
  } | null;
}

export function warmupDue(config: WarmupConfig, now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  if (`${part('hour')}:${part('minute')}` !== config.time) return null;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export class AutomationService {
  private timer?: NodeJS.Timeout;
  private running = false;
  private lastChronosPoll = 0;
  readonly status = {
    running: false,
    lastCheckedAt: null as string | null,
    lastChronosAt: null as string | null,
    error: null as string | null
  };

  constructor(private readonly config: AgentsConfigService, private readonly agents: AgentsService) {}

  start() {
    this.timer = setInterval(() => { void this.tick(); }, 15_000);
    this.timer.unref();
    void this.tick();
  }

  stop() { if (this.timer) clearInterval(this.timer); }

  async tick(force = false, now = new Date()) {
    if (this.running) return this.status;
    this.running = true;
    this.status.running = true;
    try {
      this.status.error = null;
      await this.warmup(now);
      const configured = Number(process.env.VIBEIDE_CHRONOS_INTERVAL_MS || 60_000);
      const interval = Number.isFinite(configured) ? Math.max(60_000, configured) : 60_000;
      if (this.config.value.chronos.enabled && (force || Date.now() - this.lastChronosPoll >= interval)) {
        this.lastChronosPoll = Date.now();
        await this.syncChronos();
        this.status.lastChronosAt = new Date().toISOString();
      }
    } catch (error) {
      // Provider responses may contain account details. Expose only our own short messages.
      this.status.error = error instanceof Error ? error.message.slice(0, 200) : 'Automation check failed.';
    } finally {
      this.status.lastCheckedAt = new Date().toISOString();
      this.running = false;
      this.status.running = false;
    }
    return this.status;
  }

  private async warmup(now: Date) {
    const config = this.config.value.warmup;
    if (!config.agents.length || !config.projectName) return;
    const day = warmupDue(config, now);
    if (!day) return;
    for (const agentId of config.agents) {
      await this.agents.createTask({
        projectName: config.projectName, agentId, prompt: 'Scheduled CLI check. Reply OK without using tools.'
      }, { kind: 'warmup', key: `${day}:${agentId}`, title: `${day} ${config.time} ${config.timeZone}` });
    }
  }

  private async syncChronos() {
    const config = this.config.value.chronos;
    if (!config.token || !config.projectName) throw new Error('Configure a Chronos token and workspace project.');
    const client = new Client({ name: 'vibe-ide', version: '0.2.0' });
    const transport = new StreamableHTTPClientTransport(new URL(config.url), {
      requestInit: { headers: { Authorization: `Bearer ${config.token}` }, redirect: 'error' }
    });
    const call = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
      const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 20_000 });
      if (result.isError) throw new Error(`Chronos rejected ${name}. Check token permissions and task versions.`);
      const content = result.content as { type: string; text?: string }[];
      const text = content.find((item) => item.type === 'text')?.text;
      if (!text) throw new Error('Chronos returned an invalid response.');
      return JSON.parse(text) as T;
    };
    try {
      await client.connect(transport, { timeout: 20_000 });
      const cursors = new Set<string>();
      let after: string | undefined;
      do {
        const page = await call<{ items: ChronosItem[]; nextCursor: string | null }>('chronos_list', { kind: 'task', limit: 100, ...(after ? { after } : {}) });
        for (const item of page.items) {
          if (item.deleted || item.kind !== 'task' || !item.data || item.data.project !== config.projectName) continue;
          const title = item.data.title || '';
          if (!/\[vibe\]/i.test(title)) continue;
          const key = item.id;
          const tasks = (await this.agents.tasks(config.projectName)).tasks;
          const existing = tasks.find((task) => task.source?.kind === 'chronos' && task.source.key === key);
          if (item.data.done && !existing) continue;
          const task = existing ?? (await this.agents.createTask({
            projectName: config.projectName, agentId: config.agentId,
            run: config.run, reviewer: config.reviewer,
            prompt: `Chronos task\n${title}\n\n${item.data.note || ''}\n\nImplement the requested project work and run relevant checks. Summarize changes and check results for review.`
          }, { kind: 'chronos', key, title })).task;
          const reviewStatus = tasks.find((entry) => entry.id === task.reviewTaskId)?.status;
          await this.publishStatus(call, item, task, reviewStatus);
        }
        after = page.nextCursor || undefined;
        if (after && (cursors.has(after) || cursors.size >= 1000)) throw new Error('Chronos pagination did not finish.');
        if (after) cursors.add(after);
      } while (after);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Chronos ')) throw error;
      throw new Error('Chronos connection failed. Check the URL, token expiry and backend connectivity.');
    } finally {
      await client.close().catch(() => {});
    }
  }

  private async publishStatus(call: <T>(name: string, args: Record<string, unknown>) => Promise<T>, item: ChronosItem, task: AgentTask, reviewStatus?: string) {
    const status = task.status === 'done' ? 'review' : task.status;
    const previous = item.data?.vibeide;
    if (previous?.taskId === task.id && previous.status === status &&
        previous.reviewTaskId === task.reviewTaskId && previous.reviewStatus === reviewStatus) return;
    await call('chronos_upsert', {
      kind: 'task', id: item.id, expectedUpdatedAt: item.updatedAt,
      data: { vibeide: { taskId: task.id, status, reviewTaskId: task.reviewTaskId, reviewStatus } }
    });
  }
}
