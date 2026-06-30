import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
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

  const activeFile = computed(() => openFiles.value.find((file) => file.path === activePath.value) ?? null);

  function setProject(nextProjectName: string) {
    if (projectName.value === nextProjectName) return;
    projectName.value = nextProjectName;
    openFiles.value = [];
    activePath.value = null;
  }

  async function open(path: string) {
    if (!projectName.value) return;
    const existing = openFiles.value.find((file) => file.path === path);
    if (existing) {
      activePath.value = path;
      return;
    }

    const { content } = await filesApi.read(projectName.value, path);
    openFiles.value.push({ path, name: fileName(path), content, savedContent: content });
    activePath.value = path;
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

  return { openFiles, activePath, activeFile, projectName, saving, setProject, open, close, updateContent, saveActive, isDirty };
});
