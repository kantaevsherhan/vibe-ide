<script setup lang="ts">
import { FilePlus, FolderPlus, RefreshCw } from '@lucide/vue';
import { onMounted, ref } from 'vue';
import { useEditorStore } from '../../stores/editor.store';
import { useFilesStore } from '../../stores/files.store';
import type { FileNode } from '../../types/file';
import FileTreeNode from './FileTreeNode.vue';

const files = useFilesStore();
const editor = useEditorStore();
const expanded = ref<Set<string>>(new Set());

onMounted(() => {
  void files.refresh();
});

function toggle(node: FileNode) {
  if (node.type === 'file') {
    void editor.open(node.path);
    return;
  }

  if (expanded.value.has(node.path)) expanded.value.delete(node.path);
  else expanded.value.add(node.path);
  expanded.value = new Set(expanded.value);
}

async function createFile() {
  const path = window.prompt('New file path inside workspace');
  if (!path) return;
  await files.createFile(path);
  await editor.open(path);
}

async function createFolder() {
  const path = window.prompt('New folder path inside workspace');
  if (!path) return;
  await files.createFolder(path);
}

async function remove(path: string) {
  if (!window.confirm(`Delete ${path}?`)) return;
  await files.remove(path);
}
</script>

<template>
  <section class="flex h-full min-h-0 flex-col">
    <header class="flex h-9 items-center justify-between px-3 text-[11px] uppercase tracking-wide text-ide-muted">
      <span>Explorer</span>
      <div class="flex gap-1">
        <button class="grid h-6 w-6 place-items-center rounded hover:bg-white/10 hover:text-ide-text" title="New file" @click="createFile">
          <FilePlus :size="15" />
        </button>
        <button class="grid h-6 w-6 place-items-center rounded hover:bg-white/10 hover:text-ide-text" title="New folder" @click="createFolder">
          <FolderPlus :size="15" />
        </button>
        <button class="grid h-6 w-6 place-items-center rounded hover:bg-white/10 hover:text-ide-text" title="Refresh" @click="files.refresh">
          <RefreshCw :size="14" />
        </button>
      </div>
    </header>

    <p v-if="files.error" class="mx-3 mb-2 border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">
      {{ files.error }}
    </p>

    <div class="min-h-0 flex-1 overflow-auto pb-3 thin-scrollbar">
      <p v-if="!files.loading && files.tree.length === 0" class="px-3 py-4 text-ide-muted">Workspace is empty.</p>
      <FileTreeNode
        v-for="node in files.tree"
        :key="node.path"
        :node="node"
        :depth="0"
        :expanded="expanded"
        :active-path="editor.activePath"
        @toggle="toggle"
        @remove="remove"
      />
    </div>
  </section>
</template>
