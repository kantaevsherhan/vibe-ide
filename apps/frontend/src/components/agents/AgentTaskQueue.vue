<script setup lang="ts">
import { ArrowDown, ArrowUp, RotateCcw, Square, TerminalSquare } from '@lucide/vue';
import type { AgentTask } from '../../types/agents';

defineProps<{
  tasks: AgentTask[];
  selectedTaskId: string | null;
}>();

defineEmits<{
  select: [taskId: string];
  cancel: [taskId: string];
  retry: [taskId: string];
  move: [taskId: string, direction: 'up' | 'down'];
}>();
</script>

<template>
  <div class="min-h-0 flex-1 overflow-auto thin-scrollbar">
    <div class="sticky top-0 z-10 border-b border-ide-border bg-ide-sidebar px-3 py-2 text-[11px] uppercase tracking-wide text-ide-muted">
      Task Queue
    </div>
    <p v-if="tasks.length === 0" class="px-3 py-4 text-ide-muted">No agent tasks yet.</p>
    <button
      v-for="task in tasks"
      :key="task.id"
      class="group block w-full border-b border-ide-border/70 px-3 py-2 text-left hover:bg-white/5"
      :class="{ 'bg-[#37373d]': selectedTaskId === task.id }"
      @click="$emit('select', task.id)"
    >
      <div class="flex items-center gap-2">
        <TerminalSquare class="shrink-0 text-ide-accent" :size="14" />
        <span class="truncate text-xs">{{ task.prompt }}</span>
        <span class="ml-auto rounded border border-ide-border px-1.5 py-0.5 text-[10px] text-ide-muted">{{ task.status }}</span>
      </div>
      <div class="mt-1 flex items-center gap-1 text-[11px] text-ide-muted">
        <span class="font-mono">{{ task.agentId }}</span>
        <span>·</span>
        <span>{{ new Date(task.createdAt).toLocaleTimeString() }}</span>
        <button class="ml-auto hidden rounded p-1 hover:bg-white/10 group-hover:block" title="Move up" @click.stop="$emit('move', task.id, 'up')">
          <ArrowUp :size="12" />
        </button>
        <button class="hidden rounded p-1 hover:bg-white/10 group-hover:block" title="Move down" @click.stop="$emit('move', task.id, 'down')">
          <ArrowDown :size="12" />
        </button>
        <button
          v-if="task.status === 'running' || task.status === 'queued' || task.status === 'waiting'"
          class="hidden rounded p-1 hover:bg-white/10 group-hover:block"
          title="Cancel"
          @click.stop="$emit('cancel', task.id)"
        >
          <Square :size="12" />
        </button>
        <button
          v-if="task.status === 'error' || task.status === 'cancelled' || task.status === 'stopped'"
          class="hidden rounded p-1 hover:bg-white/10 group-hover:block"
          title="Retry"
          @click.stop="$emit('retry', task.id)"
        >
          <RotateCcw :size="12" />
        </button>
      </div>
    </button>
  </div>
</template>
