import { defineStore } from 'pinia';
import { ref } from 'vue';
import { filesApi } from '../services/files.api';
import type { FileNode, FolderChildrenResponse } from '../types/file';

export const useFilesStore = defineStore('files', () => {
  const tree = ref<FileNode[]>([]);
  const projectName = ref<string | null>(null);
  const expandedFolders = ref<Set<string>>(new Set());
  const loadedFolders = ref<Set<string>>(new Set());
  const loadingFolders = ref<Set<string>>(new Set());
  const childrenByPath = ref<Record<string, FileNode[]>>({});
  const folderLimits = ref<Record<string, FolderChildrenResponse>>({});
  const ignoredMessage = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  function setProject(nextProjectName: string) {
    if (projectName.value === nextProjectName) return;
    projectName.value = nextProjectName;
    resetCache();
  }

  function resetCache() {
    tree.value = [];
    expandedFolders.value = new Set();
    loadedFolders.value = new Set();
    loadingFolders.value = new Set();
    childrenByPath.value = {};
    folderLimits.value = {};
    ignoredMessage.value = null;
  }

  async function refresh() {
    if (!projectName.value) return;
    loading.value = true;
    error.value = null;
    resetCache();
    try {
      const response = await filesApi.children(projectName.value, '');
      tree.value = response.items;
      childrenByPath.value[''] = response.items;
      loadedFolders.value.add('');
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Failed to load files.';
    } finally {
      loading.value = false;
    }
  }

  async function loadChildren(path: string, force = false) {
    if (!projectName.value) return;
    if (loadedFolders.value.has(path) && !force) return;

    loadingFolders.value.add(path);
    loadingFolders.value = new Set(loadingFolders.value);
    try {
      const response = await filesApi.children(projectName.value, path, force);
      if (response.limited) {
        folderLimits.value[path] = response;
        childrenByPath.value[path] = [];
      } else {
        delete folderLimits.value[path];
        childrenByPath.value[path] = response.items;
      }
      loadedFolders.value.add(path);
      loadedFolders.value = new Set(loadedFolders.value);
    } finally {
      loadingFolders.value.delete(path);
      loadingFolders.value = new Set(loadingFolders.value);
    }
  }

  async function toggleFolder(node: FileNode, force = false) {
    if (node.type !== 'directory') return;
    if (node.isIgnored && !force) {
      ignoredMessage.value = 'This folder is ignored for performance.';
      return;
    }

    if (expandedFolders.value.has(node.path) && !force) {
      expandedFolders.value.delete(node.path);
      expandedFolders.value = new Set(expandedFolders.value);
      return;
    }

    await loadChildren(node.path, force);
    expandedFolders.value.add(node.path);
    expandedFolders.value = new Set(expandedFolders.value);
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

  return {
    tree,
    projectName,
    expandedFolders,
    loadedFolders,
    loadingFolders,
    childrenByPath,
    folderLimits,
    ignoredMessage,
    loading,
    error,
    setProject,
    refresh,
    loadChildren,
    toggleFolder,
    createFile,
    createFolder,
    remove
  };
});
