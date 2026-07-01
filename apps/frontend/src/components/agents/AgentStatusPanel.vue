<script setup lang="ts">
import { Bot } from '@lucide/vue';
import type { AgentListItem, AgentSession } from '../../types/agents';

defineProps<{
  agents: AgentListItem[];
  sessions: AgentSession[];
  selectedAgentId: string;
}>();

defineEmits<{
  select: [agentId: string];
}>();

const statusClass = {
  idle: 'bg-ide-muted',
  running: 'bg-ide-accent',
  thinking: 'bg-purple-400',
  waiting: 'bg-yellow-400',
  error: 'bg-red-400',
  finished: 'bg-green-400',
  stopped: 'bg-ide-muted',
  not_installed: 'bg-ide-muted'
};

const statusTextClass = {
  idle: 'text-ide-muted',
  running: 'text-ide-accent',
  thinking: 'text-purple-300',
  waiting: 'text-yellow-300',
  error: 'text-red-300',
  finished: 'text-green-300',
  stopped: 'text-ide-muted',
  not_installed: 'text-ide-muted'
};

const expectedAgents = ['Claude Code', 'Gemini', 'Codex', 'Custom CLI'];

function displayStatus(agent: AgentListItem, sessions: AgentSession[]) {
  if (!agent.installed || !agent.enabled) return 'not_installed';
  const session = sessions.find((item) => item.agentId === agent.id);
  return session?.status ?? agent.status ?? 'idle';
}

function formatStatus(status: string) {
  if (status === 'not_installed') return 'Not installed';
  return status.replace(/(^|_)([a-z])/g, (_, prefix: string, letter: string) => `${prefix ? ' ' : ''}${letter.toUpperCase()}`);
}

function compactAgents(agents: AgentListItem[]) {
  const byName = new Map(agents.map((agent) => [agent.name.toLowerCase(), agent]));
  const custom = agents.find((agent) => agent.id === 'custom');
  return expectedAgents.map((name) => {
    const found = name === 'Custom CLI' ? custom : byName.get(name.toLowerCase());
    return (
      found ?? {
        id: name.toLowerCase().replaceAll(' ', '-'),
        name,
        command: '',
        args: [],
        enabled: false,
        installed: false,
        status: 'not_installed' as const
      }
    );
  });
}

function canSelect(agent: AgentListItem) {
  return agent.enabled && agent.installed;
}
</script>

<template>
  <div class="border-b border-ide-border px-3 py-2">
    <div class="mb-1.5 text-[11px] uppercase tracking-wide text-ide-muted">AI Agents</div>
    <div class="space-y-1">
      <button
        v-for="agent in compactAgents(agents)"
        :key="agent.id"
        class="flex min-h-9 w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-white/5"
        :class="{ 'bg-white/5 ring-1 ring-ide-accent/50': selectedAgentId === agent.id, 'cursor-not-allowed opacity-60': !canSelect(agent) }"
        :disabled="!canSelect(agent)"
        @click="$emit('select', agent.id)"
      >
        <Bot class="shrink-0 text-ide-muted" :size="15" :stroke-width="1.8" />
        <div class="min-w-0 flex-1">
          <div class="truncate text-xs font-medium text-ide-text">{{ agent.name }}</div>
          <div class="truncate text-[11px]" :class="statusTextClass[displayStatus(agent, sessions)]">
            {{ formatStatus(displayStatus(agent, sessions)) }}
          </div>
        </div>
        <span class="h-2 w-2 shrink-0 rounded-full" :class="statusClass[displayStatus(agent, sessions)]" />
      </button>
    </div>
  </div>
</template>
