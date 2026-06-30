<script setup lang="ts">
import { ChevronDown, ChevronRight, File, Folder, Trash2 } from '@lucide/vue';
import type { FileNode } from '../../types/file';

defineProps<{
  node: FileNode;
  depth: number;
  expanded: Set<string>;
  activePath: string | null;
}>();

defineEmits<{
  toggle: [node: FileNode];
  remove: [path: string];
}>();
</script>

<template>
  <div>
    <div
      class="group flex h-6 cursor-default items-center gap-1 pr-2 text-ide-muted hover:bg-white/5 hover:text-ide-text"
      :class="{ 'bg-[#37373d] text-ide-text': activePath === node.path }"
      :style="{ paddingLeft: `${8 + depth * 14}px` }"
      @click="$emit('toggle', node)"
    >
      <span class="grid w-3 place-items-center text-ide-muted">
        <ChevronDown v-if="node.type === 'directory' && expanded.has(node.path)" :size="13" />
        <ChevronRight v-else-if="node.type === 'directory'" :size="13" />
      </span>
      <Folder v-if="node.type === 'directory'" class="shrink-0 text-[#dcb67a]" :size="14" :stroke-width="1.7" />
      <File v-else class="shrink-0 text-[#8fbadc]" :size="14" :stroke-width="1.7" />
      <span class="truncate">{{ node.name }}</span>
      <button
        class="ml-auto hidden h-5 w-5 place-items-center rounded text-xs text-ide-muted hover:bg-white/10 hover:text-ide-text group-hover:grid"
        title="Delete"
        @click.stop="$emit('remove', node.path)"
      >
        <Trash2 :size="13" />
      </button>
    </div>

    <template v-if="node.type === 'directory' && expanded.has(node.path)">
      <FileTreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
        :expanded="expanded"
        :active-path="activePath"
        @toggle="$emit('toggle', $event)"
        @remove="$emit('remove', $event)"
      />
    </template>
  </div>
</template>
