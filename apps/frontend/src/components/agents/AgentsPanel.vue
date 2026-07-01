<script setup lang="ts">
import { Send, Sparkles } from '@lucide/vue';
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
const selectedAgent = computed(() => agents.agents.find((agent) => agent.id === selectedAgentId.value) ?? null);
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

function selectAgent(agentId: string) {
  const agent = agents.agents.find((item) => item.id === agentId);
  if (!agent?.enabled || !agent.installed) return;
  selectedAgentId.value = agentId;
}
</script>

<template>
  <section class="flex h-full min-h-0 flex-col">
    <header class="flex h-9 items-center justify-between px-3 text-[11px] uppercase tracking-wide text-ide-muted">
      <span>Agents</span>
      <button class="rounded px-2 py-1 hover:bg-white/10 hover:text-ide-text" @click="agents.refresh">Refresh</button>
    </header>
    <p v-if="agents.error" class="mx-3 mb-2 border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">{{ agents.error }}</p>
    <AgentStatusPanel :agents="agents.agents" :sessions="agents.sessions" :selected-agent-id="selectedAgentId" @select="selectAgent" />
    <form class="grid gap-2 border-b border-ide-border p-3" @submit.prevent="sendTask">
      <div class="flex items-center justify-between gap-2">
        <div>
          <div class="text-[11px] uppercase tracking-wide text-ide-muted">Task Composer</div>
          <div class="truncate text-xs text-ide-text">{{ selectedAgent?.name ?? 'Select an agent' }}</div>
        </div>
        <Sparkles class="text-ide-accent" :size="16" />
      </div>
      <textarea
        v-model="prompt"
        class="min-h-24 resize-none border border-ide-border bg-ide-panel p-2 text-xs leading-5 outline-none focus:border-ide-accent"
        placeholder="Describe the task for the selected agent..."
      />
      <button
        class="inline-flex h-8 items-center justify-center gap-2 bg-ide-accent px-3 text-xs font-medium text-white hover:bg-[#1188d8] disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!selectedAgentId || !prompt.trim()"
      >
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
      :task="agents.selectedTask"
      :log="selectedLog"
      class="shrink-0"
      :style="{ height: `${logsResize.height.value}px` }"
      @clear="agents.clearSelectedLog"
    />
  </section>
</template>
