<script setup lang="ts">
import { computed, watch } from 'vue';
import { useResizable } from '../../composables/useResizable';
import { useAgentsStore } from '../../stores/agents.store';
import type { AgentListItem, AgentStatus, AgentTask } from '../../types/agents';
import AgentHeader from './AgentHeader.vue';
import AgentLogsPanel from './AgentLogsPanel.vue';
import TaskComposer from './TaskComposer.vue';

const props = defineProps<{
  agentId: string | null;
}>();

const agents = useAgentsStore();
const split = useResizable({
  key: 'vibeide:agents:split-size',
  direction: 'horizontal',
  defaultWidth: 520
});

const agent = computed(() => agents.agents.find((item) => item.id === props.agentId) ?? null);
const agentTasks = computed(() => agents.tasks.filter((task) => task.agentId === props.agentId));
const activeTask = computed(() => {
  const selected = agentTasks.value.find((task) => task.id === agents.selectedTaskId);
  return selected ?? agentTasks.value.at(-1) ?? null;
});
const activeLog = computed(() => (activeTask.value ? agents.logs[activeTask.value.id] ?? '' : ''));
const status = computed<AgentStatus>(() => statusFor(agent.value, activeTask.value));
const canSend = computed(() => Boolean(agent.value?.enabled && agent.value.installed && props.agentId));

const gridStyle = computed(() => ({
  gridTemplateColumns: `${Math.max(split.width.value, 260)}px 4px minmax(0, 1fr)`
}));

watch(
  () => activeTask.value?.id,
  (taskId) => {
    if (taskId) void agents.openLog(taskId);
  },
  { immediate: true }
);

function statusFor(nextAgent: AgentListItem | null, task: AgentTask | null): AgentStatus {
  if (!nextAgent?.enabled) return 'stopped';
  if (!nextAgent.installed) return 'not_installed';
  const session = agents.sessions.find((item) => item.agentId === nextAgent.id);
  return session?.status ?? (task?.status === 'running' ? 'running' : nextAgent.status ?? 'idle');
}

async function sendTask(prompt: string) {
  if (!props.agentId) return;
  await agents.sendTask(props.agentId, prompt);
}

async function stopTask() {
  if (!activeTask.value) return;
  await agents.cancel(activeTask.value.id);
}

async function restartTask() {
  if (!activeTask.value) return;
  await agents.retry(activeTask.value.id);
}

function clearLog() {
  if (activeTask.value) agents.selectedTaskId = activeTask.value.id;
  agents.clearSelectedLog();
}
</script>

<template>
  <section class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-ide-main">
    <AgentHeader
      :agent="agent"
      :status="status"
      :project-name="agents.projectName"
      :task="activeTask"
      @stop="stopTask"
      @restart="restartTask"
      @clear="clearLog"
    />

    <div class="hidden min-h-0 md:grid" :style="gridStyle">
      <TaskComposer :agent="agent" :disabled="!canSend" @send="sendTask" />
      <button
        class="resize-handle-vertical"
        :class="{ 'resize-handle-active': split.isResizing.value }"
        title="Resize agent workspace"
        @mousedown="split.startResize"
      />
      <AgentLogsPanel :log="activeLog" :project-name="agents.projectName" @clear="clearLog" />
    </div>

    <div class="grid min-h-0 grid-rows-[minmax(320px,auto)_minmax(0,1fr)] md:hidden">
      <TaskComposer :agent="agent" :disabled="!canSend" @send="sendTask" />
      <AgentLogsPanel :log="activeLog" :project-name="agents.projectName" @clear="clearLog" />
    </div>

    <div v-if="split.isResizing.value" class="resize-shield" />
  </section>
</template>
