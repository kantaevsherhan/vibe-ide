import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { ApiError } from '../services/api';
import { filesApi } from '../services/files.api';
import type { OpenFile } from '../types/file';

function fileName(path: string) {
  return path.split('/').pop() ?? path;
}

export const useEditorStore = defineStore('editor', () => {
  const openFiles = ref<OpenFile[]>([]);
  const activePath = ref<string | null>(null);
  const projectName = ref<string | null>(null);
  const saving = ref(false);
  const blockedFile = ref<{ path: string; title: string; message: string; canForceOpen: boolean } | null>(null);

  const activeFile = computed(() => openFiles.value.find((file) => file.path === activePath.value) ?? null);

  function setProject(nextProjectName: string) {
    if (projectName.value === nextProjectName) return;
    projectName.value = nextProjectName;
    openFiles.value = [];
    activePath.value = null;
    blockedFile.value = null;
  }

  async function open(path: string, force = false) {
    if (!projectName.value) return;
    const existing = openFiles.value.find((file) => file.path === path);
    if (existing) {
      activePath.value = path;
      blockedFile.value = null;
      return;
    }

    try {
      const { content } = await filesApi.read(projectName.value, path, force);
      openFiles.value.push({ path, name: fileName(path), content, savedContent: content });
      activePath.value = path;
      blockedFile.value = null;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 413) {
        activePath.value = null;
        blockedFile.value = {
          path,
          title: 'Large file',
          message: 'This file is larger than 5MB.',
          canForceOpen: true
        };
        return;
      }

      if (error instanceof ApiError && error.statusCode === 415) {
        activePath.value = null;
        blockedFile.value = {
          path,
          title: 'Binary file preview is not supported',
          message: error.message,
          canForceOpen: false
        };
        return;
      }

      activePath.value = null;
      blockedFile.value = {
        path,
        title: 'Cannot open file',
        message: error instanceof Error ? error.message : 'Unknown error',
        canForceOpen: false
      };
    }
  }

  async function openAnyway() {
    const path = blockedFile.value?.path;
    if (!path) return;
    await open(path, true);
  }

  function close(path: string) {
    const index = openFiles.value.findIndex((file) => file.path === path);
    if (index === -1) return;

    openFiles.value.splice(index, 1);
    if (activePath.value === path) {
      activePath.value = openFiles.value[Math.max(0, index - 1)]?.path ?? null;
    }
  }

  function updateContent(content: string) {
    if (!activeFile.value) return;
    activeFile.value.content = content;
  }

  async function saveActive() {
    if (!activeFile.value) return;
    saving.value = true;
    try {
      if (!projectName.value) return;
      await filesApi.write(projectName.value, activeFile.value.path, activeFile.value.content);
      activeFile.value.savedContent = activeFile.value.content;
    } finally {
      saving.value = false;
    }
  }

  function isDirty(path: string) {
    const file = openFiles.value.find((item) => item.path === path);
    return Boolean(file && file.content !== file.savedContent);
  }

  return {
    openFiles,
    activePath,
    activeFile,
    projectName,
    saving,
    blockedFile,
    setProject,
    open,
    openAnyway,
    close,
    updateContent,
    saveActive,
    isDirty
  };
});
