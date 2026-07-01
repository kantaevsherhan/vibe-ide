<script setup lang="ts">
import { FilePlus, FolderPlus, RefreshCw, Search } from '@lucide/vue';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useEditorStore } from '../../stores/editor.store';
import { useFilesStore } from '../../stores/files.store';
import type { FileNode } from '../../types/file';
import ContextMenu, { type ContextMenuItem } from '../ui/ContextMenu.vue';
import ConfirmModal from '../ui/ConfirmModal.vue';
import InputModal from '../ui/InputModal.vue';
import FileTreeNode from './FileTreeNode.vue';

const props = defineProps<{
  active?: boolean;
}>();

const files = useFilesStore();
const editor = useEditorStore();
const menu = ref<{ x: number; y: number; node: FileNode } | null>(null);
const inputModal = ref<{ title: string; label: string; placeholder: string; initialValue?: string; confirmLabel: string; action: (value: string) => Promise<void> } | null>(null);
const deleteTarget = ref<FileNode | null>(null);
let searchTimer: number | undefined;

onMounted(() => {
  void files.refresh();
  window.addEventListener('keydown', handleKeys);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeys);
  if (searchTimer) window.clearTimeout(searchTimer);
});

watch(
  () => files.searchQuery,
  () => {
    if (searchTimer) window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => void files.search(), 200);
  }
);

async function toggle(node: FileNode, force = false) {
  files.selectedPath = node.path;
  if (node.type === 'file') {
    void editor.open(node.path);
    return;
  }

  await files.toggleFolder(node, force);
}

function parentFor(node?: FileNode) {
  if (!node) return '';
  if (node.type === 'directory') return node.path;
  return node.path.includes('/') ? node.path.split('/').slice(0, -1).join('/') : '';
}

function openCreateFile(baseNode?: FileNode) {
  const folder = parentFor(baseNode);
  inputModal.value = {
    title: 'Create File',
    label: 'File name',
    placeholder: 'Enter file name',
    initialValue: folder ? `${folder}/untitled.txt` : 'untitled.txt',
    confirmLabel: 'Create',
    action: async (path) => {
      await files.createFile(path);
      await editor.open(path);
    }
  };
}

function openCreateFolder(baseNode?: FileNode) {
  const folder = parentFor(baseNode);
  inputModal.value = {
    title: 'Create Folder',
    label: 'Folder name',
    placeholder: 'Enter folder name',
    initialValue: folder ? `${folder}/New Folder` : 'New Folder',
    confirmLabel: 'Create',
    action: async (path) => files.createFolder(path)
  };
}

function openRename(node: FileNode) {
  inputModal.value = {
    title: 'Rename',
    label: 'New name',
    placeholder: 'Enter new name',
    initialValue: node.path,
    confirmLabel: 'Rename',
    action: async (path) => files.rename(node.path, path)
  };
}

async function confirmInput(value: string) {
  if (!inputModal.value) return;
  await inputModal.value.action(value);
  inputModal.value = null;
}

async function confirmDelete() {
  if (!deleteTarget.value) return;
  await files.remove(deleteTarget.value.path);
  if (editor.activeFile?.kind === 'file' && editor.activeFile.path === deleteTarget.value.path) editor.close(editor.activeFile.id);
  deleteTarget.value = null;
}

function copyPath(node: FileNode) {
  void navigator.clipboard?.writeText(node.path);
}

function openMenu(event: MouseEvent, node: FileNode) {
  files.selectedPath = node.path;
  menu.value = { x: event.clientX, y: event.clientY, node };
}

function openRootMenu(event: MouseEvent) {
  menu.value = { x: event.clientX, y: event.clientY, node: { name: 'workspace', path: '', type: 'directory', isIgnored: false } };
}

const menuItems = computed<ContextMenuItem[]>(() => {
  if (!menu.value) return [];
  const node = menu.value.node;
  if (node.type === 'file') {
    return [
      { label: 'Open', action: () => void editor.open(node.path) },
      { label: 'Rename', action: () => openRename(node) },
      { label: 'Duplicate', action: () => void files.duplicate(node.path) },
      { label: 'Delete', danger: true, action: () => (deleteTarget.value = node) },
      { label: 'Copy Path', action: () => copyPath(node) }
    ];
  }
  return [
    { label: 'New File', action: () => openCreateFile(node) },
    { label: 'New Folder', action: () => openCreateFolder(node) },
    { label: 'Rename', disabled: !node.path, action: () => openRename(node) },
    { label: 'Delete', danger: true, disabled: !node.path, action: () => (deleteTarget.value = node) },
    { label: 'Copy Path', action: () => copyPath(node) }
  ];
});

function selectedNode() {
  const path = files.selectedPath;
  const all = [...Object.values(files.childrenByPath).flat(), ...files.searchResults];
  return all.find((node) => node.path === path) ?? null;
}

function handleKeys(event: KeyboardEvent) {
  if (!props.active) return;
  if (event.ctrlKey || event.metaKey || event.key === 'F2' || event.key === 'Delete' || event.key === 'Enter') {
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === 'n' && !event.shiftKey) {
      event.preventDefault();
      openCreateFile(selectedNode() ?? undefined);
    } else if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'n') {
      event.preventDefault();
      openCreateFolder(selectedNode() ?? undefined);
    } else if ((event.ctrlKey || event.metaKey) && key === 'f') {
      event.preventDefault();
      document.getElementById('explorer-search')?.focus();
    } else if (event.key === 'F2' && selectedNode()) {
      event.preventDefault();
      openRename(selectedNode() as FileNode);
    } else if (event.key === 'Delete' && selectedNode()) {
      event.preventDefault();
      deleteTarget.value = selectedNode();
    } else if (event.key === 'Enter' && selectedNode()) {
      event.preventDefault();
      void toggle(selectedNode() as FileNode);
    }
  }
}

function highlightedName(name: string) {
  const query = files.searchQuery.trim().toLowerCase();
  if (!query) return [{ text: name, match: false }];
  const index = name.toLowerCase().indexOf(query);
  if (index === -1) return [{ text: name, match: false }];
  return [
    { text: name.slice(0, index), match: false },
    { text: name.slice(index, index + query.length), match: true },
    { text: name.slice(index + query.length), match: false }
  ].filter((part) => part.text);
}

function deleteMessage() {
  const target = deleteTarget.value;
  if (!target) return '';
  const kind = target.type === 'directory' ? 'folder' : 'file';
  return `Are you sure you want to delete the ${kind} "${target.path}"? This action cannot be undone.`;
}
</script>

<template>
  <section class="flex h-full min-h-0 flex-col">
    <header class="flex h-9 items-center justify-between px-3 text-[11px] uppercase tracking-wide text-ide-muted">
      <span>Explorer</span>
      <div class="flex gap-1">
        <button class="grid h-6 w-6 place-items-center rounded hover:bg-white/10 hover:text-ide-text" title="New file" @click="openCreateFile()">
          <FilePlus :size="15" />
        </button>
        <button class="grid h-6 w-6 place-items-center rounded hover:bg-white/10 hover:text-ide-text" title="New folder" @click="openCreateFolder()">
          <FolderPlus :size="15" />
        </button>
        <button class="grid h-6 w-6 place-items-center rounded hover:bg-white/10 hover:text-ide-text" title="Refresh" @click="files.refresh">
          <RefreshCw :size="14" />
        </button>
      </div>
    </header>

    <div class="px-3 pb-2">
      <label class="flex h-7 items-center gap-2 border border-ide-border bg-ide-panel px-2 text-ide-muted">
        <Search :size="13" />
        <input id="explorer-search" v-model="files.searchQuery" class="min-w-0 flex-1 bg-transparent text-xs text-ide-text outline-none" placeholder="Search files" />
      </label>
    </div>

    <p v-if="files.error" class="mx-3 mb-2 border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">
      {{ files.error }}
    </p>
    <p v-if="files.ignoredMessage" class="mx-3 mb-2 border border-ide-border bg-ide-panel p-2 text-xs text-ide-muted">
      {{ files.ignoredMessage }}
    </p>

    <div class="min-h-0 flex-1 overflow-auto pb-3 thin-scrollbar" @contextmenu.prevent="openRootMenu">
      <template v-if="files.searchQuery.trim()">
        <button
          v-for="result in files.searchResults"
          :key="result.path"
          class="block w-full px-3 py-1.5 text-left text-xs text-ide-muted hover:bg-white/5 hover:text-ide-text"
          :class="{ 'bg-[#37373d] text-ide-text': files.selectedPath === result.path }"
          @click="files.selectedPath = result.path; toggle(result)"
        >
          <div class="truncate">
            <template v-for="part in highlightedName(result.name)" :key="`${result.path}:${part.text}:${part.match}`">
              <mark v-if="part.match" class="bg-ide-accent px-0.5 text-white">{{ part.text }}</mark>
              <span v-else>{{ part.text }}</span>
            </template>
          </div>
          <div class="truncate text-[11px] text-ide-muted">{{ result.path }}</div>
        </button>
        <p v-if="!files.searching && files.searchResults.length === 0" class="px-3 py-4 text-ide-muted">No files found.</p>
      </template>
      <div v-else-if="files.folderLimits['']" class="px-3 py-4 text-xs text-ide-muted">
        <div>Folder is too large</div>
        <div>{{ files.folderLimits[''].total }} items</div>
      </div>
      <p v-else-if="!files.loading && files.tree.length === 0" class="px-3 py-4 text-ide-muted">Workspace is empty.</p>
      <template v-if="!files.searchQuery.trim()">
        <FileTreeNode
          v-for="node in files.tree"
          :key="node.path"
          :node="node"
          :depth="0"
          :expanded="files.expandedFolders"
          :loading-folders="files.loadingFolders"
          :children-by-path="files.childrenByPath"
          :folder-limits="files.folderLimits"
          :active-path="editor.activeFile?.kind === 'file' ? editor.activeFile.path ?? null : null"
          @toggle="toggle"
          @open-anyway="toggle($event, true)"
          @menu="openMenu"
          @select="files.selectedPath = $event.path"
        />
      </template>
    </div>

    <ContextMenu v-if="menu" :x="menu.x" :y="menu.y" :items="menuItems" @close="menu = null" />
    <InputModal
      :open="Boolean(inputModal)"
      :title="inputModal?.title ?? ''"
      :label="inputModal?.label ?? ''"
      :placeholder="inputModal?.placeholder"
      :initial-value="inputModal?.initialValue"
      :confirm-label="inputModal?.confirmLabel ?? 'OK'"
      @close="inputModal = null"
      @confirm="confirmInput"
    />
    <ConfirmModal
      :open="Boolean(deleteTarget)"
      title="Delete"
      :message="deleteMessage()"
      confirm-label="Delete"
      danger
      @close="deleteTarget = null"
      @confirm="confirmDelete"
    />
  </section>
</template>
