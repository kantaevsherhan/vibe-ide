<script setup lang="ts">
import { FilePlus, FolderPlus, RefreshCw, Search } from '@lucide/vue';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useEditorStore } from '../../stores/editor.store';
import { useNotesStore } from '../../stores/notes.store';
import type { NoteNode } from '../../types/notes';
import NotesTreeNode from './NotesTreeNode.vue';

const notes = useNotesStore();
const editor = useEditorStore();
const menu = ref<{ x: number; y: number; node: NoteNode } | null>(null);
let searchTimer: number | undefined;

onMounted(() => {
  void notes.refresh();
  window.addEventListener('keydown', handleKeys);
  window.addEventListener('click', closeMenu);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeys);
  window.removeEventListener('click', closeMenu);
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
  const name = window.prompt('New note name', folder ? `${folder}/Untitled.md` : 'Untitled.md');
  if (!name) return;
  await notes.createNote(name, '# Untitled\n');
  await editor.openNote(name.toLowerCase().endsWith('.md') ? name : `${name}.md`);
}

async function createFolder(baseNode?: NoteNode) {
  const folder = parentFor(baseNode);
  const name = window.prompt('New folder name', folder ? `${folder}/New Folder` : 'New Folder');
  if (!name) return;
  await notes.createFolder(name);
}

async function rename(node: NoteNode) {
  const next = window.prompt('Rename', node.path);
  if (!next || next === node.path) return;
  await notes.rename(node.path, next);
  if (editor.activeFile?.kind === 'note' && editor.activeFile.path === node.path) {
    editor.close(editor.activeFile.id);
    await editor.openNote(next.toLowerCase().endsWith('.md') || node.type === 'directory' ? next : `${next}.md`);
  }
}

async function remove(node: NoteNode) {
  if (!window.confirm(`Delete ${node.path}?`)) return;
  await notes.remove(node.path);
  if (editor.activeFile?.kind === 'note' && editor.activeFile.path === node.path) editor.close(editor.activeFile.id);
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
          :active-path="editor.activeFile?.kind === 'note' ? editor.activeFile.path : null"
          @toggle="toggle"
          @menu="openMenu"
          @move="move"
        />
      </template>
    </div>

    <div
      v-if="menu"
      class="fixed z-[1200] w-40 border border-ide-border bg-ide-panel py-1 text-xs shadow-xl"
      :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
      @click.stop
    >
      <button class="block w-full px-3 py-1.5 text-left hover:bg-white/10" @click="createNote(menu.node); closeMenu()">New Note</button>
      <button class="block w-full px-3 py-1.5 text-left hover:bg-white/10" @click="createFolder(menu.node); closeMenu()">New Folder</button>
      <button v-if="menu.node.path" class="block w-full px-3 py-1.5 text-left hover:bg-white/10" @click="rename(menu.node); closeMenu()">Rename</button>
      <button v-if="menu.node.path" class="block w-full px-3 py-1.5 text-left hover:bg-white/10" @click="remove(menu.node); closeMenu()">Delete</button>
      <button v-if="menu.node.path" class="block w-full px-3 py-1.5 text-left hover:bg-white/10" @click="duplicate(menu.node); closeMenu()">Duplicate</button>
      <button v-if="menu.node.path" class="block w-full px-3 py-1.5 text-left hover:bg-white/10" @click="copyPath(menu.node); closeMenu()">Copy Path</button>
    </div>
  </section>
</template>
