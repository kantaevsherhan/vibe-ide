import { defineStore } from 'pinia';
import { computed } from 'vue';
import { useAgentsStore } from './agents.store';
import { useTerminalStore } from './terminal.store';

export interface ProjectRuntimeState {
  activeTerminalsCount: number;
  runningAgentsCount: number;
  activeTasksCount: number;
  agentsEnabled: boolean;
  tasksEnabled: boolean;
}

export const useRuntimeStore = defineStore('runtime', () => {
  const terminals = useTerminalStore();
  const agents = useAgentsStore();

  const state = computed<ProjectRuntimeState>(() => ({
    activeTerminalsCount: terminals.sessions.length,
    runningAgentsCount: agents.runningAgentsCount,
    activeTasksCount: agents.activeTasksCount,
    agentsEnabled: true,
    tasksEnabled: true
  }));

  return { state };
});
