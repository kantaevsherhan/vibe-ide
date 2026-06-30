<script setup lang="ts">
import { ChevronDown, ChevronRight, File, Folder, Loader2, Trash2 } from '@lucide/vue';
import type { FileNode, FolderChildrenResponse } from '../../types/file';

defineProps<{
  node: FileNode;
  depth: number;
  expanded: Set<string>;
  loadingFolders: Set<string>;
  childrenByPath: Record<string, FileNode[]>;
  folderLimits: Record<string, FolderChildrenResponse>;
  activePath: string | null;
}>();

defineEmits<{
  toggle: [node: FileNode, force?: boolean];
  openAnyway: [node: FileNode];
  remove: [path: string];
}>();
</script>

<template>
  <div>
    <div
      class="group flex h-6 cursor-default items-center gap-1 pr-2 text-ide-muted hover:bg-white/5 hover:text-ide-text"
      :class="{ 'bg-[#37373d] text-ide-text': activePath === node.path, 'opacity-55': node.isIgnored }"
      :style="{ paddingLeft: `${8 + depth * 14}px` }"
      @click="$emit('toggle', node)"
    >
      <span class="grid w-3 place-items-center text-ide-muted">
        <Loader2 v-if="loadingFolders.has(node.path)" class="animate-spin" :size="12" />
        <ChevronDown v-else-if="node.type === 'directory' && expanded.has(node.path)" :size="13" />
        <ChevronRight v-else-if="node.type === 'directory'" :size="13" />
      </span>
      <Folder v-if="node.type === 'directory'" class="shrink-0 text-[#dcb67a]" :class="{ 'text-ide-muted': node.isIgnored }" :size="14" :stroke-width="1.7" />
      <File v-else class="shrink-0 text-[#8fbadc]" :size="14" :stroke-width="1.7" />
      <span class="truncate">{{ node.name }}</span>
      <span v-if="node.isIgnored" class="rounded border border-ide-border px-1 text-[10px] text-ide-muted">ignored</span>
      <button
        v-if="node.isIgnored && node.type === 'directory'"
        class="hidden rounded px-1 text-[10px] text-ide-accent hover:bg-white/10 group-hover:block"
        @click.stop="$emit('openAnyway', node)"
      >
        Open Anyway
      </button>
      <button
        class="ml-auto hidden h-5 w-5 place-items-center rounded text-xs text-ide-muted hover:bg-white/10 hover:text-ide-text group-hover:grid"
        title="Delete"
        @click.stop="$emit('remove', node.path)"
      >
        <Trash2 :size="13" />
      </button>
    </div>

    <template v-if="node.type === 'directory' && expanded.has(node.path)">
      <div v-if="folderLimits[node.path]" class="py-2 text-xs text-ide-muted" :style="{ paddingLeft: `${24 + depth * 14}px` }">
        <div>Folder is too large</div>
        <div>{{ folderLimits[node.path].total }} items</div>
      </div>
      <FileTreeNode
        v-for="child in childrenByPath[node.path] ?? []"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
        :expanded="expanded"
        :loading-folders="loadingFolders"
        :children-by-path="childrenByPath"
        :folder-limits="folderLimits"
        :active-path="activePath"
        @toggle="$emit('toggle', $event)"
        @open-anyway="$emit('openAnyway', $event)"
        @remove="$emit('remove', $event)"
      />
    </template>
  </div>
</template>
