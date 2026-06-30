import { defineStore } from 'pinia';
import { ref } from 'vue';
import { healthApi } from '../services/health.api';
import type { WorkspaceHealthResponse } from '../types/health';

export const useHealthStore = defineStore('health', () => {
  const projectName = ref<string | null>(null);
  const state = ref<WorkspaceHealthResponse | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  function setProject(nextProjectName: string) {
    if (projectName.value === nextProjectName) return;
    projectName.value = nextProjectName;
    state.value = null;
  }

  async function refresh() {
    if (!projectName.value) return;
    loading.value = true;
    error.value = null;
    try {
      state.value = await healthApi.workspace(projectName.value);
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Failed to load workspace health.';
    } finally {
      loading.value = false;
    }
  }

  return { projectName, state, loading, error, setProject, refresh };
});
