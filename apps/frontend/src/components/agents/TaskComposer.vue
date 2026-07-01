<script setup lang="ts">
import { ListPlus, Send, Trash2 } from '@lucide/vue';
import { ref } from 'vue';
import type { AgentListItem } from '../../types/agents';

defineProps<{
  agent: AgentListItem | null;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  send: [prompt: string];
}>();

const prompt = ref('');
const contextItems = ['Project context', 'Git diff', 'Open files', 'Terminal output'];

function submit() {
  if (!prompt.value.trim()) return;
  emit('send', prompt.value.trim());
  prompt.value = '';
}
</script>

<template>
  <section class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] border-r border-ide-border bg-ide-main">
    <header class="border-b border-ide-border px-4 py-3">
      <div class="text-[11px] uppercase tracking-wide text-ide-muted">Task Composer</div>
      <div class="mt-1 truncate text-sm text-ide-text">{{ agent?.name ?? 'Select an agent' }}</div>
    </header>

    <div class="min-h-0 overflow-auto p-4 thin-scrollbar">
      <textarea
        v-model="prompt"
        class="min-h-56 w-full resize-none border border-ide-border bg-ide-panel p-3 text-sm leading-6 outline-none focus:border-ide-accent"
        placeholder="Describe what this agent should do..."
        :disabled="disabled"
      />

      <section class="mt-4 border border-ide-border bg-ide-panel p-3">
        <div class="mb-2 text-[11px] uppercase tracking-wide text-ide-muted">Context</div>
        <label v-for="item in contextItems" :key="item" class="flex items-center gap-2 py-1 text-xs text-ide-muted">
          <input type="checkbox" checked disabled />
          {{ item }}
        </label>
      </section>
    </div>

    <footer class="flex flex-wrap items-center gap-2 border-t border-ide-border p-3">
      <button
        class="inline-flex h-8 items-center gap-2 bg-ide-accent px-3 text-xs font-medium text-white hover:bg-[#1188d8] disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="disabled || !prompt.trim()"
        @click="submit"
      >
        <Send :size="14" />
        Send Task
      </button>
      <button
        class="desktop-action-button h-8 gap-2 px-3"
        :disabled="disabled || !prompt.trim()"
        @click="submit"
      >
        <ListPlus :size="14" />
        Add to Queue
      </button>
      <button class="desktop-action-button h-8 gap-2 px-3" :disabled="!prompt" @click="prompt = ''">
        <Trash2 :size="14" />
        Clear
      </button>
    </footer>
  </section>
</template>
