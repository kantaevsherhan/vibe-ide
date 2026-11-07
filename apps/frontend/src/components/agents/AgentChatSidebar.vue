<script setup lang="ts">
import { Bot, Brain, ChevronDown, Clipboard, Command, MessageSquarePlus, MoreHorizontal, RotateCw, Send, Sparkles, Trash2, X } from '@lucide/vue';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useResizable } from '../../composables/useResizable';
import { useAgentsStore } from '../../stores/agents.store';
import type { AgentListItem, AgentSession, AgentStatus, AgentTask, TaskOptions } from '../../types/agents';
import AgentRunOptions from './AgentRunOptions.vue';

const props = defineProps<{
  mobile?: boolean;
  closable?: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const agents = useAgentsStore();
const selectedAgentId = ref('');
const prompt = ref('');
const options = ref<TaskOptions>({});
const chatListOpen = ref(false);
const hiddenTaskIds = ref<Set<string>>(new Set(readHiddenTaskIds()));
const logContainer = ref<HTMLElement | null>(null);
const activeDetailTab = ref<'logs' | 'details' | 'files' | 'output'>('logs');
const detailResize = useResizable({
  key: 'vibeide:agents:detail-height',
  direction: 'vertical',
  defaultHeight: 210,
  verticalGrowthDirection: 'up'
});

const iconMap = { claude: Bot, codex: Command, ollama: Brain, api: Sparkles };

const statusClass: Record<AgentStatus, string> = {
  idle: 'bg-ide-muted',
  running: 'bg-ide-accent',
  thinking: 'bg-purple-400',
  waiting: 'bg-yellow-400',
  error: 'bg-red-400',
  finished: 'bg-green-400',
  stopped: 'bg-ide-muted',
  not_installed: 'bg-ide-muted'
};

const statusTextClass: Record<AgentStatus, string> = {
  idle: 'text-ide-muted',
  running: 'text-ide-accent',
  thinking: 'text-purple-300',
  waiting: 'text-yellow-300',
  error: 'text-red-300',
  finished: 'text-green-300',
  stopped: 'text-ide-muted',
  not_installed: 'text-ide-muted'
};



const detailTabs = [
  { id: 'logs', label: 'Live Logs' },
  { id: 'details', label: 'Task Details' },
  { id: 'files', label: 'Files' },
  { id: 'output', label: 'Output' }
] as const;

const visibleAgents = computed(() => agents.agents);
const reviewers = computed(() => agents.agents.filter((agent) => agent.enabled && agent.installed && ['codex', 'claude'].includes(agent.id)));

const selectedAgent = computed(() => visibleAgents.value.find((agent) => agent.id === selectedAgentId.value) ?? visibleAgents.value[0] ?? null);
const visibleTasks = computed(() => agents.tasks.filter((task) => !hiddenTaskIds.value.has(task.id)).slice().reverse());
const selectedTask = computed(() => {
  const selected = agents.selectedTaskId ? visibleTasks.value.find((task) => task.id === agents.selectedTaskId) : null;
  return selected ?? visibleTasks.value.find((task) => task.agentId === selectedAgent.value?.id) ?? visibleTasks.value[0] ?? null;
});
const selectedLog = computed(() => (selectedTask.value ? agents.logs[selectedTask.value.id] ?? '' : ''));
const canSend = computed(() => Boolean(!agents.sending && selectedAgent.value?.enabled && selectedAgent.value.installed && prompt.value.trim()));
const linkedTask = computed(() => {
  const id = selectedTask.value?.reviewTaskId ?? selectedTask.value?.reviewOf;
  return agents.tasks.find((task) => task.id === id);
});

onMounted(async () => {
  await agents.refresh();
  selectedAgentId.value = selectedAgentId.value || visibleAgents.value.find((agent) => agent.enabled && agent.installed)?.id || visibleAgents.value[0]?.id || '';
});

watch(() => selectedTask.value?.id, (id) => {
  if (id) void agents.openLog(id);
}, { immediate: true });

watch(() => agents.tasks, () => {
  if (!selectedAgentId.value) selectedAgentId.value = visibleAgents.value.find((agent) => agent.enabled && agent.installed)?.id || visibleAgents.value[0]?.id || '';
}, { deep: true });

watch(selectedLog, () => {
  void nextTick(() => {
    if (!logContainer.value) return;
    logContainer.value.scrollTop = logContainer.value.scrollHeight;
  });
}, { flush: 'post' });

function displayStatus(agent: AgentListItem, sessions: AgentSession[]): AgentStatus {
  if (!agent.enabled) return 'stopped';
  if (!agent.installed) return 'not_installed';
  return sessions.slice().reverse().find((item) => item.agentId === agent.id)?.status ?? agent.status ?? 'idle';
}

function formatStatus(status: AgentStatus, agent?: AgentListItem | null) {
  if (agent && !agent.enabled) return 'Disabled';
  if (status === 'not_installed') return 'Not installed';
  return status.replace(/(^|_)([a-z])/g, (_, prefix: string, letter: string) => `${prefix ? ' ' : ''}${letter.toUpperCase()}`);
}

function iconFor(agent: AgentListItem | null) {
  if (!agent) return Bot;
  return iconMap[agent.id as keyof typeof iconMap] ?? Bot;
}

async function sendTask() {
  if (!canSend.value || !selectedAgent.value) return;
  const submitted = prompt.value;
  const sent = await agents.sendTask(selectedAgent.value.id, submitted, options.value);
  if (sent && prompt.value === submitted) {
    prompt.value = '';
  }
}

function selectAgent(agent: AgentListItem) {
  selectedAgentId.value = agent.id;
  chatListOpen.value = false;
}

function selectTask(task: AgentTask) {
  agents.selectedTaskId = task.id;
  chatListOpen.value = false;
}

function hideTask(taskId: string) {
  hiddenTaskIds.value = new Set([...hiddenTaskIds.value, taskId]);
  saveHiddenTaskIds(hiddenTaskIds.value);
  if (agents.selectedTaskId === taskId) agents.selectedTaskId = visibleTasks.value.find((task) => task.id !== taskId)?.id ?? null;
}

function readHiddenTaskIds() {
  try {
    return JSON.parse(localStorage.getItem('vibeide:agents:hidden-chat-ids') ?? '[]') as string[];
  } catch {
    return [];
  }
}

function saveHiddenTaskIds(ids: Set<string>) {
  localStorage.setItem('vibeide:agents:hidden-chat-ids', JSON.stringify([...ids]));
}

async function copyLog() {
  await navigator.clipboard?.writeText(selectedLog.value);
}
</script>

<template>
  <aside
    class="agent-chat-sidebar"
    :class="{ 'is-mobile': props.mobile }"
    :style="{ '--agent-detail-height': `${detailResize.height.value}px` }"
  >
    <header class="agent-chat-header">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <component :is="iconFor(selectedAgent)" class="text-ide-accent" :size="16" />
          <span class="truncate text-sm font-semibold">{{ selectedAgent?.name ?? 'AI Agents' }}</span>
        </div>
        <div class="mt-0.5 flex items-center gap-2 text-[11px]" :class="selectedAgent ? statusTextClass[displayStatus(selectedAgent, agents.sessions)] : 'text-ide-muted'">
          <span class="h-1.5 w-1.5 rounded-full" :class="selectedAgent ? statusClass[displayStatus(selectedAgent, agents.sessions)] : 'bg-ide-muted'" />
          {{ selectedAgent ? formatStatus(displayStatus(selectedAgent, agents.sessions), selectedAgent) : 'Select chat' }}
        </div>
      </div>
      <div class="flex items-center gap-1">
        <button class="agent-icon-button" title="New chat" @click="chatListOpen = true">
          <MessageSquarePlus :size="15" />
        </button>
        <button class="agent-icon-button" title="Chats" @click="chatListOpen = !chatListOpen">
          <MoreHorizontal :size="16" />
        </button>
        <button class="agent-icon-button" title="Refresh agents" @click="agents.refresh">
          <RotateCw :size="14" />
        </button>
        <button v-if="props.mobile || props.closable" class="agent-icon-button" title="Hide agents" @click="emit('close')">
          <X :size="16" />
        </button>
      </div>
    </header>

    <p v-if="agents.error" role="alert" class="mx-3 mt-2 border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">{{ agents.error }}</p>

    <section v-if="chatListOpen" class="agent-chat-list thin-scrollbar">
      <div class="px-3 pb-2 pt-3 text-[11px] uppercase tracking-wide text-ide-muted">Start Chat</div>
      <button
        v-for="agent in visibleAgents"
        :key="agent.id"
        class="agent-list-row"
        :class="{ 'is-active': selectedAgentId === agent.id }"
        @click="selectAgent(agent)"
      >
        <component :is="iconFor(agent)" :size="15" />
        <span class="min-w-0 flex-1 truncate">{{ agent.name }}</span>
        <span class="h-1.5 w-1.5 rounded-full" :class="statusClass[displayStatus(agent, agents.sessions)]" />
      </button>

      <div class="px-3 pb-2 pt-4 text-[11px] uppercase tracking-wide text-ide-muted">Chats</div>
      <p v-if="visibleTasks.length === 0" class="px-3 pb-3 text-xs text-ide-muted">No chats yet.</p>
      <button
        v-for="task in visibleTasks"
        :key="task.id"
        class="agent-list-row group"
        :class="{ 'is-active': selectedTask?.id === task.id }"
        @click="selectTask(task)"
      >
        <ChevronDown class="-rotate-90 text-ide-muted" :size="13" />
        <span class="min-w-0 flex-1 truncate">{{ task.prompt }}</span>
        <span class="rounded border border-ide-border px-1 py-0.5 text-[10px] text-ide-muted">{{ task.status }}</span>
        <span class="grid h-6 w-6 place-items-center text-ide-muted hover:text-red-300" title="Remove chat from list" @click.stop="hideTask(task.id)">
          <Trash2 :size="12" />
        </span>
      </button>
    </section>

    <section class="agent-chat-thread thin-scrollbar">
      <div v-if="selectedTask" class="agent-message user">
        <div class="agent-message-label">{{ selectedTask.reviewOf ? 'Review assignment' : 'You' }}</div>
        <div class="whitespace-pre-wrap">{{ selectedTask.prompt }}</div>
      </div>
      <div class="agent-message assistant">
        <div class="agent-message-label">{{ visibleAgents.find(agent => agent.id === selectedTask?.agentId)?.name ?? selectedAgent?.name ?? 'Agent' }}</div>
        <pre ref="logContainer" class="agent-log-preview">{{ selectedLog || 'Send a task to start a live agent chat.' }}</pre>
      </div>
    </section>

    <button
      class="resize-handle-horizontal agent-detail-resize"
      :class="{ 'resize-handle-active': detailResize.isResizing.value }"
      title="Resize agent details"
      @mousedown="detailResize.startResize"
      @touchstart="detailResize.startResize"
    />

    <section class="agent-detail-panel">
      <header class="flex h-8 items-center justify-between border-b border-ide-border px-2">
        <div class="flex min-w-0 overflow-x-auto thin-scrollbar">
          <button
            v-for="tab in detailTabs"
            :key="tab.id"
            class="shrink-0 border-b px-2 text-[11px]"
            :class="activeDetailTab === tab.id ? 'border-ide-accent text-ide-text' : 'border-transparent text-ide-muted hover:text-ide-text'"
            @click="activeDetailTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>
        <div class="flex gap-1">
          <button class="agent-icon-button h-6 w-6" title="Copy logs" @click="copyLog">
            <Clipboard :size="12" />
          </button>
          <button class="agent-icon-button h-6 w-6" title="Clear logs" @click="agents.clearSelectedLog">
            <Trash2 :size="12" />
          </button>
        </div>
      </header>
      <pre v-if="activeDetailTab === 'logs'" class="agent-detail-content font-mono">{{ selectedLog || 'Live logs will appear here.' }}</pre>
      <div v-else-if="activeDetailTab === 'details'" class="agent-detail-content">
        <template v-if="selectedTask">
          <div><span class="text-ide-text">Agent:</span> {{ selectedTask.agentId }}</div>
          <div><span class="text-ide-text">Status:</span> {{ selectedTask.status }}</div>
          <div><span class="text-ide-text">Model:</span> {{ selectedTask.run?.model ?? 'Provider default' }}</div>
          <div><span class="text-ide-text">Reasoning:</span> {{ selectedTask.run?.effort ?? 'Provider default' }}</div>
          <button v-if="linkedTask" class="desktop-action-button mt-2 min-h-11 px-3" @click="selectTask(linkedTask)">
            {{ selectedTask.reviewOf ? 'Open execution' : `Open review · ${linkedTask.status}` }}
          </button>
          <button v-if="['queued', 'running', 'waiting'].includes(selectedTask.status)" class="desktop-action-button mt-2 min-h-11 px-3" @click="agents.cancel(selectedTask.id)">
            Cancel task
          </button>
          <button v-else-if="!selectedTask.reviewTaskId && ['error', 'cancelled', 'stopped'].includes(selectedTask.status)" class="desktop-action-button mt-2 min-h-11 px-3" @click="agents.retry(selectedTask.id)">
            Retry task
          </button>
          <div><span class="text-ide-text">Created:</span> {{ new Date(selectedTask.createdAt).toLocaleString() }}</div>
          <div v-if="selectedTask.startedAt"><span class="text-ide-text">Started:</span> {{ new Date(selectedTask.startedAt).toLocaleString() }}</div>
          <div v-if="selectedTask.finishedAt"><span class="text-ide-text">Finished:</span> {{ new Date(selectedTask.finishedAt).toLocaleString() }}</div>
        </template>
        <span v-else>Open a chat to see task details.</span>
      </div>
      <div v-else-if="activeDetailTab === 'files'" class="agent-detail-content">File changes reported by agents will appear here.</div>
      <pre v-else class="agent-detail-content font-mono">{{ selectedLog ? selectedLog.slice(-4000) : 'Open a chat to see output.' }}</pre>
    </section>

    <form class="agent-composer" @submit.prevent="sendTask">
      <label class="flex items-center gap-2 text-sm">
        Executor
        <select v-model="selectedAgentId" class="min-h-11 min-w-0 flex-1 border border-ide-border bg-ide-panel px-2">
          <option v-for="agent in visibleAgents" :key="agent.id" :value="agent.id" :disabled="!agent.enabled || !agent.installed">{{ agent.name }}</option>
        </select>
      </label>
      <textarea
        v-model="prompt"
        class="agent-composer-input"
        aria-label="Task prompt"
        placeholder="Ask the selected agent to change, inspect, or explain this project..."
      />
      <AgentRunOptions v-model="options" :reviewers="reviewers" />
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0">
          <div class="truncate text-[11px] text-ide-muted">Project context included</div>
        </div>
        <div class="relative flex shrink-0 items-center gap-1">
          <button class="inline-flex min-h-11 items-center gap-2 bg-ide-accent px-3 text-xs font-medium text-white hover:bg-[#1188d8] disabled:cursor-not-allowed disabled:opacity-50" :disabled="!canSend">
            <Send :size="14" />
            {{ agents.sending ? 'Sending…' : 'Send' }}
          </button>
        </div>
      </div>
    </form>
  </aside>
</template>
