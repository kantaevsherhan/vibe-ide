<script setup lang="ts">
import { Bot, Brain, Command, RotateCw, Settings, Sparkles } from '@lucide/vue';
import { computed, onMounted } from 'vue';
import { useAgentsStore } from '../../stores/agents.store';
import { useEditorStore } from '../../stores/editor.store';
import type { AgentListItem, AgentSession, AgentStatus } from '../../types/agents';

const agents = useAgentsStore();
const editor = useEditorStore();

const iconMap = {
  claude: Bot,
  chatgpt: Brain,
  gemini: Sparkles,
  codex: Command,
  custom: Settings
};

const statusClass: Record<AgentStatus, string> = {
  idle: 'bg-ide-muted',
  running: 'bg-ide-accent',
  thinking: 'bg-purple-400',
  waiting: 'bg-yellow-400',
  error: 'bg-red-400',
  finished: 'bg-green-400',
  stopped: 'bg-ide-muted',
  not_installed: 'bg-ide-muted'
};

const statusTextClass: Record<AgentStatus, string> = {
  idle: 'text-ide-muted',
  running: 'text-ide-accent',
  thinking: 'text-purple-300',
  waiting: 'text-yellow-300',
  error: 'text-red-300',
  finished: 'text-green-300',
  stopped: 'text-ide-muted',
  not_installed: 'text-ide-muted'
};

const expectedAgents = [
  { id: 'claude', name: 'Claude Code' },
  { id: 'chatgpt', name: 'ChatGPT' },
  { id: 'gemini', name: 'Gemini' },
  { id: 'codex', name: 'Codex' },
  { id: 'custom', name: 'Custom CLI' }
];

const visibleAgents = computed(() => {
  const byId = new Map(agents.agents.map((agent) => [agent.id, agent]));
  const byName = new Map(agents.agents.map((agent) => [agent.name.toLowerCase(), agent]));
  return expectedAgents.map((expected) => {
    const match = byId.get(expected.id) ?? byName.get(expected.name.toLowerCase());
    return match ?? placeholderAgent(expected.id, expected.name);
  });
});

onMounted(() => {
  void agents.refresh();
});

function placeholderAgent(id: string, name: string): AgentListItem {
  return {
    id,
    name,
    command: '',
    args: [],
    enabled: false,
    installed: false,
    status: 'not_installed'
  };
}

function displayStatus(agent: AgentListItem, sessions: AgentSession[]): AgentStatus {
  if (!agent.enabled) return 'stopped';
  if (!agent.installed) return 'not_installed';
  return sessions.find((item) => item.agentId === agent.id)?.status ?? agent.status ?? 'idle';
}

function formatStatus(status: AgentStatus, agent: AgentListItem) {
  if (!agent.enabled) return 'Disabled';
  if (status === 'not_installed') return 'Not installed';
  return status.replace(/(^|_)([a-z])/g, (_, prefix: string, letter: string) => `${prefix ? ' ' : ''}${letter.toUpperCase()}`);
}

function openAgent(agent: AgentListItem) {
  editor.openAgentTab(agent.id, agent.name);
}

function iconFor(agent: AgentListItem) {
  return iconMap[agent.id as keyof typeof iconMap] ?? Bot;
}
</script>

<template>
  <section class="flex h-full min-h-0 flex-col">
    <header class="flex h-9 items-center justify-between px-3 text-[11px] uppercase tracking-wide text-ide-muted">
      <span>Agents</span>
      <button class="grid h-6 w-6 place-items-center rounded hover:bg-white/10 hover:text-ide-text" title="Refresh agents" @click="agents.refresh">
        <RotateCw :size="13" />
      </button>
    </header>

    <p v-if="agents.error" class="mx-3 mb-2 border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">{{ agents.error }}</p>

    <div class="min-h-0 flex-1 overflow-auto px-2 pb-2 thin-scrollbar">
      <button
        v-for="agent in visibleAgents"
        :key="agent.id"
        class="group flex min-h-11 w-full items-center gap-2 border border-transparent px-2 py-1.5 text-left hover:border-ide-border hover:bg-white/5"
        :class="{ 'border-ide-accent/50 bg-ide-accent/10': editor.activeAgentId === agent.id }"
        @click="openAgent(agent)"
      >
        <component :is="iconFor(agent)" class="shrink-0 text-ide-muted group-hover:text-ide-text" :size="16" />
        <div class="min-w-0 flex-1">
          <div class="truncate text-xs font-medium text-ide-text">{{ agent.name }}</div>
          <div class="truncate text-[11px]" :class="statusTextClass[displayStatus(agent, agents.sessions)]">
            {{ formatStatus(displayStatus(agent, agents.sessions), agent) }}
          </div>
        </div>
        <span class="h-2 w-2 shrink-0 rounded-full" :class="statusClass[displayStatus(agent, agents.sessions)]" />
      </button>
    </div>
  </section>
</template>
