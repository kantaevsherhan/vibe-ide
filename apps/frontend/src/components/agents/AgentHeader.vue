<script setup lang="ts">
import { Play, RotateCcw, Square, Trash2 } from '@lucide/vue';
import type { AgentListItem, AgentStatus, AgentTask } from '../../types/agents';

defineProps<{
  agent: AgentListItem | null;
  status: AgentStatus;
  projectName: string | null;
  task: AgentTask | null;
}>();

defineEmits<{
  stop: [];
  restart: [];
  clear: [];
}>();

function formatStatus(status: AgentStatus) {
  if (status === 'not_installed') return 'Not installed';
  return status.replace(/(^|_)([a-z])/g, (_, prefix: string, letter: string) => `${prefix ? ' ' : ''}${letter.toUpperCase()}`);
}
</script>

<template>
  <header class="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-ide-border bg-[#202020] px-4 py-2">
    <div class="min-w-0">
      <div class="truncate text-base font-semibold">{{ agent?.name ?? 'Agent' }}</div>
      <div class="mt-0.5 flex flex-wrap gap-3 text-xs text-ide-muted">
        <span>Status: <span class="text-ide-text">{{ formatStatus(status) }}</span></span>
        <span>Project: <span class="font-mono text-ide-text">{{ projectName ?? 'No project' }}</span></span>
      </div>
    </div>
    <div class="flex flex-wrap gap-2">
      <button class="desktop-action-button h-8 gap-2 px-3" disabled title="Start is handled when a task is sent">
        <Play :size="14" />
        Start
      </button>
      <button class="desktop-action-button h-8 gap-2 px-3" :disabled="!task || !['queued', 'running', 'waiting'].includes(task.status)" @click="$emit('stop')">
        <Square :size="14" />
        Stop
      </button>
      <button class="desktop-action-button h-8 gap-2 px-3" :disabled="!task" @click="$emit('restart')">
        <RotateCcw :size="14" />
        Restart
      </button>
      <button class="desktop-action-button h-8 gap-2 px-3" @click="$emit('clear')">
        <Trash2 :size="14" />
        Clear Logs
      </button>
    </div>
  </header>
</template>
