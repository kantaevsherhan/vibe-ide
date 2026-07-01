<script setup lang="ts">
import { Send } from '@lucide/vue';
import { computed, onMounted, ref } from 'vue';
import { useResizable } from '../../composables/useResizable';
import { useAgentsStore } from '../../stores/agents.store';
import AgentLogView from './AgentLogView.vue';
import AgentStatusPanel from './AgentStatusPanel.vue';
import AgentTaskQueue from './AgentTaskQueue.vue';

const agents = useAgentsStore();
const selectedAgentId = ref('');
const prompt = ref('');
const logsResize = useResizable({
  key: 'vibeide:agents:logs-height',
  direction: 'vertical',
  defaultHeight: 220,
  verticalGrowthDirection: 'up'
});

const enabledAgents = computed(() => agents.agents.filter((agent) => agent.enabled));
const selectedLog = computed(() => {
  const id = agents.selectedTaskId;
  return id ? (agents.logs[id] ?? '') : '';
});

onMounted(async () => {
  await agents.refresh();
  selectedAgentId.value = enabledAgents.value[0]?.id ?? '';
});

async function sendTask() {
  if (!selectedAgentId.value) return;
  await agents.sendTask(selectedAgentId.value, prompt.value);
  prompt.value = '';
}
</script>

<template>
  <section class="flex h-full min-h-0 flex-col">
    <header class="flex h-9 items-center justify-between px-3 text-[11px] uppercase tracking-wide text-ide-muted">
      <span>Agents</span>
      <button class="rounded px-2 py-1 hover:bg-white/10 hover:text-ide-text" @click="agents.refresh">Refresh</button>
    </header>
    <p v-if="agents.error" class="mx-3 mb-2 border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">{{ agents.error }}</p>
    <AgentStatusPanel :agents="agents.agents" :sessions="agents.sessions" />
    <form class="grid gap-2 border-b border-ide-border p-3" @submit.prevent="sendTask">
      <select v-model="selectedAgentId" class="h-8 border border-ide-border bg-ide-panel px-2 text-xs outline-none focus:border-ide-accent">
        <option v-for="agent in enabledAgents" :key="agent.id" :value="agent.id">
          {{ agent.name }}{{ agent.installed ? '' : ' (not installed)' }}
        </option>
      </select>
      <textarea
        v-model="prompt"
        class="min-h-16 resize-none border border-ide-border bg-ide-panel p-2 text-xs outline-none focus:border-ide-accent"
        placeholder="Send a task to the selected agent..."
      />
      <button class="inline-flex h-8 items-center justify-center gap-2 bg-ide-accent px-3 text-xs font-medium text-white hover:bg-[#1188d8]">
        <Send :size="14" />
        Send Task
      </button>
    </form>
    <AgentTaskQueue
      :tasks="agents.tasks"
      :selected-task-id="agents.selectedTaskId"
      @select="agents.openLog"
      @cancel="agents.cancel"
      @retry="agents.retry"
      @move="agents.move"
    />
    <button
      class="resize-handle-horizontal shrink-0"
      :class="{ 'resize-handle-active': logsResize.isResizing.value }"
      title="Resize agent logs"
      @mousedown="logsResize.startResize"
    />
    <AgentLogView
      :task-id="agents.selectedTaskId"
      :log="selectedLog"
      class="shrink-0"
      :style="{ height: `${logsResize.height.value}px` }"
      @clear="agents.clearSelectedLog"
    />
  </section>
</template>
