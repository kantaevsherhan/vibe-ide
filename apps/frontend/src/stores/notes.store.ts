import { defineStore } from 'pinia';
import { ref } from 'vue';
import { notesApi } from '../services/notes.api';
import type { NoteNode, NotesSearchResult } from '../types/notes';

function parentPath(path: string) {
  return path.includes('/') ? path.split('/').slice(0, -1).join('/') : '';
}

function duplicatedPath(path: string) {
  const parts = path.split('/');
  const name = parts.pop() ?? path;
  const folder = parts.join('/');
  const copyName = name.toLowerCase().endsWith('.md') ? name.replace(/\.md$/i, ' copy.md') : `${name} copy`;
  return folder ? `${folder}/${copyName}` : copyName;
}

export const useNotesStore = defineStore('notes', () => {
  const tree = ref<NoteNode[]>([]);
  const projectName = ref<string | null>(null);
  const expandedFolders = ref<Set<string>>(new Set());
  const loadedFolders = ref<Set<string>>(new Set());
  const loadingFolders = ref<Set<string>>(new Set());
  const childrenByPath = ref<Record<string, NoteNode[]>>({});
  const searchQuery = ref('');
  const searchResults = ref<NotesSearchResult[]>([]);
  const loading = ref(false);
  const searching = ref(false);
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
    searchQuery.value = '';
    searchResults.value = [];
    error.value = null;
  }

  async function refresh(openPath = '') {
    if (!projectName.value) return;
    loading.value = true;
    error.value = null;
    try {
      const response = await notesApi.tree(projectName.value, openPath);
      childrenByPath.value[openPath] = response.items;
      loadedFolders.value.add(openPath);
      loadedFolders.value = new Set(loadedFolders.value);
      if (!openPath) tree.value = response.items;
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Failed to load notes.';
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
      const response = await notesApi.tree(projectName.value, path);
      childrenByPath.value[path] = response.items;
      loadedFolders.value.add(path);
      loadedFolders.value = new Set(loadedFolders.value);
    } finally {
      loadingFolders.value.delete(path);
      loadingFolders.value = new Set(loadingFolders.value);
    }
  }

  async function toggleFolder(node: NoteNode) {
    if (node.type !== 'directory') return;
    if (expandedFolders.value.has(node.path)) {
      expandedFolders.value.delete(node.path);
      expandedFolders.value = new Set(expandedFolders.value);
      return;
    }
    await loadChildren(node.path);
    expandedFolders.value.add(node.path);
    expandedFolders.value = new Set(expandedFolders.value);
  }

  async function createNote(path: string, content = '') {
    if (!projectName.value) return;
    await notesApi.createFile(projectName.value, path, content);
    await refresh(parentPath(path));
    if (!parentPath(path)) tree.value = childrenByPath.value[''] ?? [];
  }

  async function createFolder(path: string) {
    if (!projectName.value) return;
    await notesApi.createFolder(projectName.value, path);
    await refresh(parentPath(path));
    if (!parentPath(path)) tree.value = childrenByPath.value[''] ?? [];
  }

  async function rename(from: string, to: string) {
    if (!projectName.value) return;
    await notesApi.rename(projectName.value, from, to);
    await refresh(parentPath(from));
    if (parentPath(from) !== parentPath(to)) await refresh(parentPath(to));
    tree.value = childrenByPath.value[''] ?? tree.value;
  }

  async function duplicate(path: string) {
    if (!projectName.value) return;
    await notesApi.duplicate(projectName.value, path, duplicatedPath(path));
    await refresh(parentPath(path));
    tree.value = childrenByPath.value[''] ?? tree.value;
  }

  async function remove(path: string) {
    if (!projectName.value) return;
    await notesApi.delete(projectName.value, path);
    await refresh(parentPath(path));
    tree.value = childrenByPath.value[''] ?? tree.value;
  }

  async function search() {
    if (!projectName.value || !searchQuery.value.trim()) {
      searchResults.value = [];
      return;
    }
    searching.value = true;
    try {
      searchResults.value = (await notesApi.search(projectName.value, searchQuery.value)).results;
    } finally {
      searching.value = false;
    }
  }

  return {
    tree,
    projectName,
    expandedFolders,
    loadedFolders,
    loadingFolders,
    childrenByPath,
    searchQuery,
    searchResults,
    loading,
    searching,
    error,
    setProject,
    refresh,
    loadChildren,
    toggleFolder,
    createNote,
    createFolder,
    rename,
    duplicate,
    remove,
    search
  };
});
