<script setup lang="ts">
import { FilePlus, FolderPlus, RefreshCw, Search } from '@lucide/vue';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useEditorStore } from '../../stores/editor.store';
import { useNotesStore } from '../../stores/notes.store';
import type { NoteNode } from '../../types/notes';
import ContextMenu, { type ContextMenuItem } from '../ui/ContextMenu.vue';
import ConfirmModal from '../ui/ConfirmModal.vue';
import InputModal from '../ui/InputModal.vue';
import NotesTreeNode from './NotesTreeNode.vue';

const notes = useNotesStore();
const editor = useEditorStore();
const menu = ref<{ x: number; y: number; node: NoteNode } | null>(null);
const inputModal = ref<{ title: string; label: string; placeholder: string; initialValue?: string; confirmLabel: string; action: (value: string) => Promise<void> } | null>(null);
const deleteTarget = ref<NoteNode | null>(null);
let searchTimer: number | undefined;

onMounted(() => {
  void notes.refresh();
  window.addEventListener('keydown', handleKeys);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeys);
  if (searchTimer) window.clearTimeout(searchTimer);
});

watch(
  () => notes.searchQuery,
  () => {
    if (searchTimer) window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => void notes.search(), 250);
  }
);

async function toggle(node: NoteNode) {
  if (node.type === 'file') {
    await editor.openNote(node.path);
    return;
  }
  await notes.toggleFolder(node);
}

function parentFor(node?: NoteNode) {
  if (!node) return '';
  if (node.type === 'directory') return node.path;
  return node.path.includes('/') ? node.path.split('/').slice(0, -1).join('/') : '';
}

async function createNote(baseNode?: NoteNode) {
  const folder = parentFor(baseNode);
  inputModal.value = {
    title: 'Create Note',
    label: 'Note name',
    placeholder: 'Enter note name',
    initialValue: folder ? `${folder}/Untitled.md` : 'Untitled.md',
    confirmLabel: 'Create',
    action: async (name) => {
      await notes.createNote(name, '# Untitled\n');
      await editor.openNote(name.toLowerCase().endsWith('.md') ? name : `${name}.md`);
    }
  };
}

async function createFolder(baseNode?: NoteNode) {
  const folder = parentFor(baseNode);
  inputModal.value = {
    title: 'Create Folder',
    label: 'Folder name',
    placeholder: 'Enter folder name',
    initialValue: folder ? `${folder}/New Folder` : 'New Folder',
    confirmLabel: 'Create',
    action: async (name) => notes.createFolder(name)
  };
}

async function rename(node: NoteNode) {
  inputModal.value = {
    title: 'Rename',
    label: 'New name',
    placeholder: 'Enter new name',
    initialValue: node.path,
    confirmLabel: 'Rename',
    action: async (next) => {
      if (next === node.path) return;
      await notes.rename(node.path, next);
      if (editor.activeFile?.kind === 'note' && editor.activeFile.path === node.path) {
        editor.close(editor.activeFile.id);
        await editor.openNote(next.toLowerCase().endsWith('.md') || node.type === 'directory' ? next : `${next}.md`);
      }
    }
  };
}

async function remove(node: NoteNode) {
  deleteTarget.value = node;
}

async function confirmDelete() {
  if (!deleteTarget.value) return;
  const node = deleteTarget.value;
  await notes.remove(node.path);
  if (editor.activeFile?.kind === 'note' && editor.activeFile.path === node.path) editor.close(editor.activeFile.id);
  deleteTarget.value = null;
}

async function duplicate(node: NoteNode) {
  await notes.duplicate(node.path);
}

async function copyPath(node: NoteNode) {
  await navigator.clipboard?.writeText(`.vibeide/notes/${node.path}`);
}

async function move(from: string, to: string, targetType: NoteNode['type']) {
  if (!from || from === to || to.startsWith(`${from}/`)) return;
  const name = from.split('/').pop() ?? from;
  const target = targetType === 'directory' ? `${to}/${name}` : `${to.split('/').slice(0, -1).join('/')}/${name}`.replace(/^\//, '');
  await notes.rename(from, target);
  if (editor.activeFile?.kind === 'note' && editor.activeFile.path === from) {
    editor.close(editor.activeFile.id);
    await editor.openNote(target);
  }
}

function openMenu(event: MouseEvent, node: NoteNode) {
  menu.value = { x: event.clientX, y: event.clientY, node };
}

function closeMenu() {
  menu.value = null;
}

async function confirmInput(value: string) {
  if (!inputModal.value) return;
  await inputModal.value.action(value);
  inputModal.value = null;
}

function menuItems(node: NoteNode): ContextMenuItem[] {
  if (!node.path) {
    return [
      { label: 'New Note', action: () => void createNote(node) },
      { label: 'New Folder', action: () => void createFolder(node) }
    ];
  }
  const common = [
    { label: 'Rename', action: () => void rename(node) },
    { label: 'Delete', danger: true, action: () => void remove(node) },
    { label: 'Duplicate', action: () => void duplicate(node) },
    { label: 'Copy Path', action: () => void copyPath(node) }
  ];
  if (node.type === 'file') {
    return [{ label: 'Open', action: () => void editor.openNote(node.path) }, ...common];
  }
  return [
    { label: 'New Note', action: () => void createNote(node) },
    { label: 'New Folder', action: () => void createFolder(node) },
    ...common
  ];
}

function handleKeys(event: KeyboardEvent) {
  if (!event.ctrlKey && !event.metaKey && event.key !== 'F2' && event.key !== 'Delete') return;
  const activeNote = editor.activeFile?.kind === 'note' ? editor.activeFile.path : null;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n' && !event.shiftKey) {
    event.preventDefault();
    void createNote();
  } else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'n') {
    event.preventDefault();
    void createFolder();
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    document.getElementById('notes-search')?.focus();
  } else if (event.key === 'F2' && activeNote) {
    event.preventDefault();
    void rename({ name: activeNote.split('/').pop() ?? activeNote, path: activeNote, type: 'file' });
  } else if (event.key === 'Delete' && activeNote) {
    event.preventDefault();
    void remove({ name: activeNote.split('/').pop() ?? activeNote, path: activeNote, type: 'file' });
  }
}

function deleteMessage() {
  const target = deleteTarget.value;
  if (!target) return '';
  const kind = target.type === 'directory' ? 'folder' : 'note';
  return `Are you sure you want to delete the ${kind} "${target.path}"? This action cannot be undone.`;
}
</script>

<template>
  <section class="flex h-full min-h-0 flex-col">
    <header class="flex h-9 items-center justify-between px-3 text-[11px] uppercase tracking-wide text-ide-muted">
      <span>Notes</span>
      <div class="flex gap-1">
        <button class="grid h-6 w-6 place-items-center rounded hover:bg-white/10 hover:text-ide-text" title="New note" @click="createNote()">
          <FilePlus :size="15" />
        </button>
        <button class="grid h-6 w-6 place-items-center rounded hover:bg-white/10 hover:text-ide-text" title="New folder" @click="createFolder()">
          <FolderPlus :size="15" />
        </button>
        <button class="grid h-6 w-6 place-items-center rounded hover:bg-white/10 hover:text-ide-text" title="Refresh" @click="notes.refresh()">
          <RefreshCw :size="14" />
        </button>
      </div>
    </header>

    <div class="px-3 pb-2">
      <label class="flex h-7 items-center gap-2 border border-ide-border bg-ide-panel px-2 text-ide-muted">
        <Search :size="13" />
        <input id="notes-search" v-model="notes.searchQuery" class="min-w-0 flex-1 bg-transparent text-xs text-ide-text outline-none" placeholder="Search notes" />
      </label>
    </div>

    <p v-if="notes.error" class="mx-3 mb-2 border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">{{ notes.error }}</p>

    <div class="min-h-0 flex-1 overflow-auto pb-3 thin-scrollbar" @contextmenu.prevent="openMenu($event, { name: 'notes', path: '', type: 'directory' })">
      <template v-if="notes.searchQuery.trim()">
        <button
          v-for="result in notes.searchResults"
          :key="result.path"
          class="block w-full px-3 py-1.5 text-left text-xs text-ide-muted hover:bg-white/5 hover:text-ide-text"
          @click="result.type === 'file' ? editor.openNote(result.path) : notes.toggleFolder(result)"
        >
          <div class="truncate text-ide-text">{{ result.path }}</div>
          <div class="truncate">{{ result.match === 'name' ? 'Name match' : result.excerpt }}</div>
        </button>
        <p v-if="!notes.searching && notes.searchResults.length === 0" class="px-3 py-4 text-ide-muted">No notes found.</p>
      </template>
      <template v-else>
        <p v-if="!notes.loading && notes.tree.length === 0" class="px-3 py-4 text-ide-muted">No notes yet.</p>
        <NotesTreeNode
          v-for="node in notes.tree"
          :key="node.path"
          :node="node"
          :depth="0"
          :expanded="notes.expandedFolders"
          :loading-folders="notes.loadingFolders"
          :children-by-path="notes.childrenByPath"
          :active-path="editor.activeFile?.kind === 'note' ? editor.activeFile.path ?? null : null"
          @toggle="toggle"
          @menu="openMenu"
          @move="move"
        />
      </template>
    </div>

    <ContextMenu v-if="menu" :x="menu.x" :y="menu.y" :items="menuItems(menu.node)" @close="closeMenu" />
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
