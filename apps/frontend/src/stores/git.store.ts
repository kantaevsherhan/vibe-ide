import { defineStore } from 'pinia';
import { ref } from 'vue';
import { gitApi } from '../services/git.api';
import type { GitFileStatus } from '../types/git';

export const useGitStore = defineStore('git', () => {
  const files = ref<GitFileStatus[]>([]);
  const projectName = ref<string | null>(null);
  const isRepository = ref(true);
  const message = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  function setProject(nextProjectName: string) {
    if (projectName.value === nextProjectName) return;
    projectName.value = nextProjectName;
    files.value = [];
    isRepository.value = true;
    message.value = null;
  }

  async function refresh() {
    if (!projectName.value) return;
    loading.value = true;
    error.value = null;
    message.value = null;
    try {
      const response = await gitApi.status(projectName.value);
      files.value = response.files;
      isRepository.value = response.isRepository;
      message.value = response.message ?? null;
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Failed to load Git status.';
    } finally {
      loading.value = false;
    }
  }

  return { files, projectName, isRepository, message, loading, error, setProject, refresh };
});
