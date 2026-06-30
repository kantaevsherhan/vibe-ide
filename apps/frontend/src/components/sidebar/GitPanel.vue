<script setup lang="ts">
import { GitBranch, RefreshCw } from '@lucide/vue';
import { onMounted } from 'vue';
import { useEditorStore } from '../../stores/editor.store';
import { useGitStore } from '../../stores/git.store';

const git = useGitStore();
const editor = useEditorStore();

onMounted(() => {
  void git.refresh();
});

const labels = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  untracked: 'U',
  renamed: 'R',
  unknown: '?'
};
</script>

<template>
  <section class="flex h-full min-h-0 flex-col">
    <header class="flex h-9 items-center justify-between px-3 text-[11px] uppercase tracking-wide text-ide-muted">
      <span>Source Control</span>
      <button class="grid h-6 w-6 place-items-center rounded hover:bg-white/10 hover:text-ide-text" title="Refresh" @click="git.refresh">
        <RefreshCw :size="14" />
      </button>
    </header>

    <p v-if="git.error" class="mx-3 mb-2 border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">
      {{ git.error }}
    </p>

    <div class="min-h-0 flex-1 overflow-auto thin-scrollbar">
      <p v-if="git.loading" class="px-3 py-3 text-ide-muted">Loading changes...</p>
      <p v-else-if="git.files.length === 0" class="px-3 py-4 text-ide-muted">No changed files.</p>
      <button
        v-for="file in git.files"
        :key="file.path"
        class="flex h-7 w-full items-center gap-2 px-3 text-left text-ide-muted hover:bg-white/5 hover:text-ide-text"
        @click="editor.open(file.path)"
      >
        <GitBranch class="shrink-0 text-ide-accent" :size="14" />
        <span class="w-4 font-mono text-[11px] text-ide-accent">{{ labels[file.status] }}</span>
        <span class="truncate">{{ file.path }}</span>
      </button>
    </div>
  </section>
</template>
