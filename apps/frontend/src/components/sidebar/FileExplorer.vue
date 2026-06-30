<script setup lang="ts">
import { FilePlus, FolderPlus, RefreshCw } from '@lucide/vue';
import { onMounted } from 'vue';
import { useEditorStore } from '../../stores/editor.store';
import { useFilesStore } from '../../stores/files.store';
import type { FileNode } from '../../types/file';
import FileTreeNode from './FileTreeNode.vue';

const files = useFilesStore();
const editor = useEditorStore();

onMounted(() => {
  void files.refresh();
});

async function toggle(node: FileNode, force = false) {
  if (node.type === 'file') {
    if (node.isBinary) {
      files.ignoredMessage = 'Binary file preview is not supported.';
      return;
    }
    void editor.open(node.path);
    return;
  }

  await files.toggleFolder(node, force);
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
    <p v-if="files.ignoredMessage" class="mx-3 mb-2 border border-ide-border bg-ide-panel p-2 text-xs text-ide-muted">
      {{ files.ignoredMessage }}
    </p>

    <div class="min-h-0 flex-1 overflow-auto pb-3 thin-scrollbar">
      <div v-if="files.folderLimits['']" class="px-3 py-4 text-xs text-ide-muted">
        <div>Folder is too large</div>
        <div>{{ files.folderLimits[''].total }} items</div>
      </div>
      <p v-else-if="!files.loading && files.tree.length === 0" class="px-3 py-4 text-ide-muted">Workspace is empty.</p>
      <FileTreeNode
        v-for="node in files.tree"
        :key="node.path"
        :node="node"
        :depth="0"
        :expanded="files.expandedFolders"
        :loading-folders="files.loadingFolders"
        :children-by-path="files.childrenByPath"
        :folder-limits="files.folderLimits"
        :active-path="editor.activePath"
        @toggle="toggle"
        @open-anyway="toggle($event, true)"
        @remove="remove"
      />
    </div>
  </section>
</template>
