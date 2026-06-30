import { defineStore } from 'pinia';
import { ref } from 'vue';
import { filesApi } from '../services/files.api';
import type { FileNode } from '../types/file';

export const useFilesStore = defineStore('files', () => {
  const tree = ref<FileNode[]>([]);
  const projectName = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  function setProject(nextProjectName: string) {
    if (projectName.value === nextProjectName) return;
    projectName.value = nextProjectName;
    tree.value = [];
  }

  async function refresh() {
    if (!projectName.value) return;
    loading.value = true;
    error.value = null;
    try {
      tree.value = (await filesApi.tree(projectName.value)).tree;
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Failed to load files.';
    } finally {
      loading.value = false;
    }
  }

  async function createFile(path: string) {
    if (!projectName.value) return;
    await filesApi.createFile(projectName.value, path);
    await refresh();
  }

  async function createFolder(path: string) {
    if (!projectName.value) return;
    await filesApi.createFolder(projectName.value, path);
    await refresh();
  }

  async function remove(path: string) {
    if (!projectName.value) return;
    await filesApi.delete(projectName.value, path);
    await refresh();
  }

  return { tree, projectName, loading, error, setProject, refresh, createFile, createFolder, remove };
});
