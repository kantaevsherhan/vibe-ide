<script setup lang="ts">
import { X } from '@lucide/vue';
import { useEditorStore } from '../../stores/editor.store';

const editor = useEditorStore();
</script>

<template>
  <div class="flex min-w-0 flex-nowrap items-end overflow-x-auto overflow-y-hidden border-b border-ide-border bg-[#202020] thin-scrollbar">
    <button
      v-for="file in editor.openFiles"
      :key="file.id"
      class="group relative flex h-9 min-w-32 max-w-56 flex-shrink-0 items-center gap-2 border-r border-ide-border px-3 text-left text-ide-muted"
      :class="{ 'bg-ide-main text-ide-text': editor.activePath === file.id }"
      @click="editor.activePath = file.id"
    >
      <span class="truncate">{{ file.name }}</span>
      <span v-if="editor.isDirty(file.id)" class="h-1.5 w-1.5 rounded-full bg-ide-accent" />
      <span
        v-if="editor.activePath === file.id"
        class="absolute inset-x-0 top-0 h-px bg-ide-accent shadow-[0_0_10px_rgba(0,122,204,0.9)]"
      />
      <button
        class="ml-auto hidden h-5 w-5 place-items-center rounded text-ide-muted hover:bg-white/10 hover:text-ide-text group-hover:grid"
        title="Close"
        @click.stop="editor.close(file.id)"
      >
        <X :size="13" />
      </button>
    </button>
  </div>
</template>
