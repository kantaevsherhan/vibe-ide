<script setup lang="ts">
import { Clipboard, Trash2 } from '@lucide/vue';
import { nextTick, ref, watch } from 'vue';
import AgentReviewPanel from './AgentReviewPanel.vue';

const props = defineProps<{
  log: string;
  projectName: string | null;
}>();

const emit = defineEmits<{
  clear: [];
}>();

const activeTab = ref<'logs' | 'review'>('logs');
const logContainer = ref<HTMLElement | null>(null);

async function copyLog() {
  await navigator.clipboard?.writeText(props.log);
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
  <section class="grid min-h-0 grid-rows-[36px_minmax(0,1fr)] bg-[#181818]">
    <header class="flex items-center justify-between border-b border-ide-border bg-ide-panel px-3">
      <div class="flex h-full">
        <button
          class="border-b px-3 text-xs"
          :class="activeTab === 'logs' ? 'border-ide-accent text-ide-text' : 'border-transparent text-ide-muted hover:text-ide-text'"
          @click="activeTab = 'logs'"
        >
          Logs
        </button>
        <button
          class="border-b px-3 text-xs"
          :class="activeTab === 'review' ? 'border-ide-accent text-ide-text' : 'border-transparent text-ide-muted hover:text-ide-text'"
          @click="activeTab = 'review'"
        >
          Review
        </button>
      </div>
      <div class="flex gap-1">
        <button class="grid h-6 w-6 place-items-center rounded text-ide-muted hover:bg-white/10 hover:text-ide-text" title="Copy logs" @click="copyLog">
          <Clipboard :size="13" />
        </button>
        <button class="grid h-6 w-6 place-items-center rounded text-ide-muted hover:bg-white/10 hover:text-ide-text" title="Clear logs" @click="emit('clear')">
          <Trash2 :size="13" />
        </button>
      </div>
    </header>

    <pre
      v-if="activeTab === 'logs'"
      ref="logContainer"
      class="min-h-0 overflow-auto whitespace-pre-wrap bg-[#181818] p-3 font-mono text-[11px] leading-5 text-ide-text thin-scrollbar"
    >{{ log || 'Agent logs will appear here.' }}</pre>
    <AgentReviewPanel v-else :project-name="projectName" />
  </section>
</template>
