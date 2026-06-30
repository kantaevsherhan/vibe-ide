import { defineStore } from 'pinia';
import { ref } from 'vue';
import { filesApi } from '../services/files.api';
import type { FileNode } from '../types/file';

export const useFilesStore = defineStore('files', () => {
  const tree = ref<FileNode[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function refresh() {
    loading.value = true;
    error.value = null;
    try {
      tree.value = (await filesApi.tree()).tree;
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Failed to load files.';
    } finally {
      loading.value = false;
    }
  }

  async function createFile(path: string) {
    await filesApi.createFile(path);
    await refresh();
  }

  async function createFolder(path: string) {
    await filesApi.createFolder(path);
    await refresh();
  }

  async function remove(path: string) {
    await filesApi.delete(path);
    await refresh();
  }

  return { tree, loading, error, refresh, createFile, createFolder, remove };
});
