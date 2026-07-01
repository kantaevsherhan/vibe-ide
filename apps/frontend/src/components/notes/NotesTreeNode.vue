<script setup lang="ts">
import { ChevronDown, ChevronRight, FileText, Folder, Loader2, MoreHorizontal } from '@lucide/vue';
import type { NoteNode } from '../../types/notes';

defineProps<{
  node: NoteNode;
  depth: number;
  expanded: Set<string>;
  loadingFolders: Set<string>;
  childrenByPath: Record<string, NoteNode[]>;
  activePath: string | null;
}>();

defineEmits<{
  toggle: [node: NoteNode];
  menu: [event: MouseEvent, node: NoteNode];
  move: [from: string, to: string, targetType: NoteNode['type']];
}>();
</script>

<template>
  <div>
    <div
      class="group flex h-6 cursor-default items-center gap-1 pr-2 text-ide-muted hover:bg-white/5 hover:text-ide-text"
      :class="{ 'bg-[#37373d] text-ide-text': activePath === node.path }"
      :style="{ paddingLeft: `${8 + depth * 14}px` }"
      draggable="true"
      @click="$emit('toggle', node)"
      @contextmenu.prevent.stop="$emit('menu', $event, node)"
      @dragstart="$event.dataTransfer?.setData('text/plain', node.path)"
      @dragover.prevent
      @drop.prevent="$emit('move', $event.dataTransfer?.getData('text/plain') ?? '', node.path, node.type)"
    >
      <span class="grid w-3 place-items-center text-ide-muted">
        <Loader2 v-if="loadingFolders.has(node.path)" class="animate-spin" :size="12" />
        <ChevronDown v-else-if="node.type === 'directory' && expanded.has(node.path)" :size="13" />
        <ChevronRight v-else-if="node.type === 'directory'" :size="13" />
      </span>
      <Folder v-if="node.type === 'directory'" class="shrink-0 text-[#dcb67a]" :size="14" :stroke-width="1.7" />
      <FileText v-else class="shrink-0 text-[#8fbadc]" :size="14" :stroke-width="1.7" />
      <span class="truncate">{{ node.name }}</span>
      <button
        class="ml-auto hidden h-5 w-5 place-items-center rounded text-xs text-ide-muted hover:bg-white/10 hover:text-ide-text group-hover:grid"
        title="Actions"
        @click.stop="$emit('menu', $event, node)"
      >
        <MoreHorizontal :size="13" />
      </button>
    </div>

    <template v-if="node.type === 'directory' && expanded.has(node.path)">
      <NotesTreeNode
        v-for="child in childrenByPath[node.path] ?? []"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
        :expanded="expanded"
        :loading-folders="loadingFolders"
        :children-by-path="childrenByPath"
        :active-path="activePath"
        @toggle="$emit('toggle', $event)"
        @menu="(event, target) => $emit('menu', event, target)"
        @move="(from, to, targetType) => $emit('move', from, to, targetType)"
      />
    </template>
  </div>
</template>
