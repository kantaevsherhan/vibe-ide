import { defineStore } from 'pinia';
import { ref } from 'vue';
import { gitApi } from '../services/git.api';
import type { GitFileStatus } from '../types/git';

export const useGitStore = defineStore('git', () => {
  const files = ref<GitFileStatus[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function refresh() {
    loading.value = true;
    error.value = null;
    try {
      files.value = (await gitApi.status()).files;
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Failed to load Git status.';
    } finally {
      loading.value = false;
    }
  }

  return { files, loading, error, refresh };
});
