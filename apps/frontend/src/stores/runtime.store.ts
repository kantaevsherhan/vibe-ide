import { defineStore } from 'pinia';
import { computed } from 'vue';
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

  const state = computed<ProjectRuntimeState>(() => ({
    activeTerminalsCount: terminals.sessions.length,
    runningAgentsCount: 0,
    activeTasksCount: 0,
    agentsEnabled: false,
    tasksEnabled: false
  }));

  return { state };
});
