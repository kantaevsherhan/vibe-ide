<script setup lang="ts">
import { Clipboard, Trash2 } from '@lucide/vue';
import { nextTick, ref, watch } from 'vue';

const props = defineProps<{
  taskId: string | null;
  log: string;
}>();

const emit = defineEmits<{
  clear: [];
}>();

const logContainer = ref<HTMLElement | null>(null);

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
  <section class="grid min-h-0 grid-rows-[28px_minmax(0,1fr)] bg-[#181818]">
    <header class="flex items-center justify-between border-b border-ide-border px-3 text-[11px] uppercase tracking-wide text-ide-muted">
      <div class="flex min-w-0 items-center gap-2">
        <span>Agent Logs</span>
        <span v-if="taskId" class="truncate font-mono normal-case">{{ taskId.slice(0, 8) }}</span>
      </div>
      <div class="flex gap-1">
        <button class="grid h-5 w-5 place-items-center rounded hover:bg-white/10 hover:text-ide-text" title="Copy logs" @click="copyLog(log)">
          <Clipboard :size="12" />
        </button>
        <button class="grid h-5 w-5 place-items-center rounded hover:bg-white/10 hover:text-ide-text" title="Clear logs" @click="emit('clear')">
          <Trash2 :size="12" />
        </button>
      </div>
    </header>
    <pre ref="logContainer" class="min-h-0 overflow-auto whitespace-pre-wrap bg-[#181818] p-3 font-mono text-[11px] leading-5 text-ide-text thin-scrollbar">{{ log || 'Open a task log to see output.' }}</pre>
  </section>
</template>
