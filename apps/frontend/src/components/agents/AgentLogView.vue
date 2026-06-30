<script setup lang="ts">
defineProps<{
  taskId: string | null;
  log: string;
}>();
</script>

<template>
  <section class="grid min-h-0 grid-rows-[28px_minmax(0,1fr)] border-t border-ide-border bg-ide-panel">
    <header class="flex items-center justify-between border-b border-ide-border px-3 text-[11px] uppercase tracking-wide text-ide-muted">
      <span>Agent Log</span>
      <span v-if="taskId" class="font-mono normal-case">{{ taskId.slice(0, 8) }}</span>
    </header>
    <pre class="min-h-0 overflow-auto whitespace-pre-wrap p-3 font-mono text-xs text-ide-text thin-scrollbar">{{ log || 'Open a task log to see output.' }}</pre>
  </section>
</template>
