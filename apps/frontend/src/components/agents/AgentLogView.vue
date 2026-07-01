<script setup lang="ts">
import { Clipboard, Trash2 } from '@lucide/vue';
import { nextTick, ref, watch } from 'vue';
import type { AgentTask } from '../../types/agents';

const props = defineProps<{
  taskId: string | null;
  task: AgentTask | null;
  log: string;
}>();

const emit = defineEmits<{
  clear: [];
}>();

const logContainer = ref<HTMLElement | null>(null);
const activeTab = ref<'logs' | 'details' | 'files' | 'output'>('logs');
const tabs = [
  { id: 'logs', label: 'Live Logs' },
  { id: 'details', label: 'Task Details' },
  { id: 'files', label: 'Files' },
  { id: 'output', label: 'Output' }
] as const;

async function copyLog(log: string) {
  await navigator.clipboard?.writeText(log);
}

function scrollToBottom() {
  void nextTick(() => {
    if (!logContainer.value) return;
    logContainer.value.scrollTop = logContainer.value.scrollHeight;
  });
}

watch(() => props.log, scrollToBottom, { flush: 'post' });
</script>

<template>
  <section class="grid min-h-0 grid-rows-[56px_minmax(0,1fr)] bg-[#181818]">
    <header class="border-b border-ide-border">
      <div class="flex h-7 items-center justify-between px-3 text-[11px] uppercase tracking-wide text-ide-muted">
        <span>Agent Logs</span>
        <span v-if="taskId" class="truncate font-mono normal-case">{{ taskId.slice(0, 8) }}</span>
        <div class="ml-auto flex gap-1">
          <button class="grid h-5 w-5 place-items-center rounded hover:bg-white/10 hover:text-ide-text" title="Copy logs" @click="copyLog(log)">
            <Clipboard :size="12" />
          </button>
          <button class="grid h-5 w-5 place-items-center rounded hover:bg-white/10 hover:text-ide-text" title="Clear logs" @click="emit('clear')">
            <Trash2 :size="12" />
          </button>
        </div>
      </div>
      <div class="flex h-7 overflow-x-auto px-2 thin-scrollbar">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="shrink-0 border-b px-2 text-[11px]"
          :class="activeTab === tab.id ? 'border-ide-accent text-ide-text' : 'border-transparent text-ide-muted hover:text-ide-text'"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>
    </header>
    <pre v-if="activeTab === 'logs'" ref="logContainer" class="min-h-0 overflow-auto whitespace-pre-wrap bg-[#181818] p-3 font-mono text-[11px] leading-5 text-ide-text thin-scrollbar">{{ log || 'Open a task log to see output.' }}</pre>
    <div v-else-if="activeTab === 'details'" class="min-h-0 overflow-auto p-3 text-xs text-ide-muted thin-scrollbar">
      <div v-if="task" class="grid gap-2">
        <div><span class="text-ide-text">Agent:</span> {{ task.agentId }}</div>
        <div><span class="text-ide-text">Status:</span> {{ task.status }}</div>
        <div><span class="text-ide-text">Created:</span> {{ new Date(task.createdAt).toLocaleString() }}</div>
        <div v-if="task.startedAt"><span class="text-ide-text">Started:</span> {{ new Date(task.startedAt).toLocaleString() }}</div>
        <div v-if="task.finishedAt"><span class="text-ide-text">Finished:</span> {{ new Date(task.finishedAt).toLocaleString() }}</div>
        <div class="pt-2">
          <div class="mb-1 text-ide-text">Prompt</div>
          <div class="whitespace-pre-wrap border border-ide-border bg-ide-panel p-2">{{ task.prompt }}</div>
        </div>
      </div>
      <div v-else>Open a task to see details.</div>
    </div>
    <div v-else-if="activeTab === 'files'" class="min-h-0 overflow-auto p-3 text-xs text-ide-muted thin-scrollbar">
      File changes reported by agents will appear here.
    </div>
    <pre v-else class="min-h-0 overflow-auto whitespace-pre-wrap bg-[#181818] p-3 font-mono text-[11px] leading-5 text-ide-text thin-scrollbar">{{ log ? log.slice(-4000) : 'Open a task to see output.' }}</pre>
  </section>
</template>
