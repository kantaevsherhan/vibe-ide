<script setup lang="ts">
import type { AgentListItem, AgentSession } from '../../types/agents';

defineProps<{
  agents: AgentListItem[];
  sessions: AgentSession[];
}>();

const statusClass = {
  idle: 'text-ide-muted',
  running: 'text-ide-accent',
  thinking: 'text-purple-300',
  waiting: 'text-yellow-300',
  error: 'text-red-300',
  finished: 'text-green-300',
  stopped: 'text-ide-muted',
  not_installed: 'text-red-300'
};
</script>

<template>
  <div class="border-b border-ide-border p-3">
    <div class="mb-2 text-[11px] uppercase tracking-wide text-ide-muted">Agents</div>
    <div class="space-y-2">
      <div v-for="agent in agents" :key="agent.id" class="rounded border border-ide-border bg-ide-panel p-2">
        <div class="flex items-center justify-between gap-2">
          <span class="truncate font-medium">{{ agent.name }}</span>
          <span class="text-[11px]" :class="statusClass[agent.status]">
            {{ agent.installed && agent.enabled ? agent.status : 'Not installed' }}
          </span>
        </div>
        <div class="mt-1 truncate font-mono text-[11px] text-ide-muted">{{ agent.command }} {{ agent.args.join(' ') }}</div>
        <div class="mt-1 truncate text-[11px] text-ide-muted">Mode: {{ agent.inputMode ?? 'stdin' }}</div>
        <div v-if="agent.resolvedCommand" class="mt-1 truncate font-mono text-[10px] text-ide-muted">{{ agent.resolvedCommand }}</div>
        <div v-if="agent.lastError" class="mt-1 text-[11px] text-red-300">{{ agent.lastError }}</div>
        <div
          v-for="session in sessions.filter((item) => item.agentId === agent.id)"
          :key="session.id"
          class="mt-2 text-[11px] text-ide-muted"
        >
          Status: <span :class="statusClass[session.status]">{{ session.status }}</span>
          <span v-if="session.currentTaskId"> · Task: {{ session.currentTaskId.slice(0, 8) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
