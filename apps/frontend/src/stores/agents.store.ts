import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { agentsApi } from '../services/agents.api';
import { AgentsSocket } from '../services/agents.ws';
import type { AgentListItem, AgentSession, AgentTask, AgentWsMessage } from '../types/agents';

const socket = new AgentsSocket();

export const useAgentsStore = defineStore('agents', () => {
  const projectName = ref<string | null>(null);
  const agents = ref<AgentListItem[]>([]);
  const sessions = ref<AgentSession[]>([]);
  const tasks = ref<AgentTask[]>([]);
  const logs = ref<Record<string, string>>({});
  const selectedTaskId = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const runningAgentsCount = computed(() => sessions.value.filter((session) => session.status === 'running').length);
  const activeTasksCount = computed(() => tasks.value.filter((task) => task.status === 'queued' || task.status === 'running' || task.status === 'waiting').length);
  const selectedTask = computed(() => tasks.value.find((task) => task.id === selectedTaskId.value) ?? null);

  function setProject(nextProjectName: string) {
    if (projectName.value === nextProjectName) return;
    projectName.value = nextProjectName;
    agents.value = [];
    sessions.value = [];
    tasks.value = [];
    logs.value = {};
    selectedTaskId.value = null;
    connect();
  }

  function connect() {
    if (!projectName.value) return;
    socket.connect(projectName.value, handleMessage);
  }

  async function refresh() {
    if (!projectName.value) return;
    loading.value = true;
    error.value = null;
    try {
      const response = await agentsApi.status(projectName.value);
      agents.value = response.agents;
      sessions.value = response.sessions;
      tasks.value = response.tasks;
      selectedTaskId.value = selectedTaskId.value ?? response.tasks.at(-1)?.id ?? null;
      connect();
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Failed to load agents.';
    } finally {
      loading.value = false;
    }
  }

  async function loadAgents() {
    loading.value = true;
    error.value = null;
    try {
      const response = await agentsApi.list();
      agents.value = response.agents;
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Failed to load agents.';
    } finally {
      loading.value = false;
    }
  }

  async function sendTask(agentId: string, prompt: string) {
    if (!projectName.value || !prompt.trim()) return;
    error.value = null;
    try {
      const response = await agentsApi.createTask(projectName.value, agentId, prompt.trim());
      upsertTask(response.task);
      selectedTaskId.value = response.task.id;
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Failed to create agent task.';
    }
  }

  async function cancel(taskId: string) {
    const response = await agentsApi.cancel(taskId);
    upsertTask(response.task);
  }

  async function retry(taskId: string) {
    const response = await agentsApi.retry(taskId);
    upsertTask(response.task);
  }

  async function move(taskId: string, direction: 'up' | 'down') {
    await agentsApi.move(taskId, direction);
    await refresh();
  }

  async function openLog(taskId: string) {
    selectedTaskId.value = taskId;
    const response = await agentsApi.log(taskId);
    logs.value[taskId] = response.log;
  }

  function clearSelectedLog() {
    if (!selectedTaskId.value) return;
    logs.value[selectedTaskId.value] = '';
  }

  function handleMessage(message: AgentWsMessage) {
    if (message.type === 'snapshot') {
      sessions.value = message.sessions;
      tasks.value = message.tasks;
      selectedTaskId.value = selectedTaskId.value ?? message.tasks.at(-1)?.id ?? null;
    }
    if (message.type === 'agent_status') upsertSession(message.session);
    if (message.type === 'agent_task') upsertTask(message.task);
    if (message.type === 'agent_output') {
      logs.value[message.taskId] = `${logs.value[message.taskId] ?? ''}${message.data}`;
    }
    if (message.type === 'agent_error') {
      error.value = message.message;
    }
  }

  function upsertTask(task: AgentTask | undefined) {
    if (!task) return;
    tasks.value = [...tasks.value.filter((item) => item.id !== task.id), task].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  function upsertSession(session: AgentSession) {
    sessions.value = [...sessions.value.filter((item) => item.id !== session.id), session];
  }

  return {
    projectName,
    agents,
    sessions,
    tasks,
    logs,
    selectedTaskId,
    selectedTask,
    runningAgentsCount,
    activeTasksCount,
    loading,
    error,
    setProject,
    refresh,
    loadAgents,
    sendTask,
    cancel,
    retry,
    move,
    openLog,
    clearSelectedLog
  };
});
