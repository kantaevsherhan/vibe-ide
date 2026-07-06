<script setup lang="ts">
import { Check, ChevronDown, GitBranch, RefreshCw } from '@lucide/vue';
import { onMounted, ref } from 'vue';
import { useEditorStore } from '../../stores/editor.store';
import { useGitStore } from '../../stores/git.store';

const git = useGitStore();
const editor = useEditorStore();
const commitMessage = ref('');
const branchOpen = ref(false);

onMounted(() => {
  void git.refresh();
  void git.loadBranches();
});

const labels = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  untracked: 'U',
  renamed: 'R',
  unknown: '?'
};

async function toggleBranches() {
  branchOpen.value = !branchOpen.value;
  if (branchOpen.value) await git.loadBranches();
}

async function switchBranch(branch: string) {
  await git.checkout(branch);
  branchOpen.value = false;
}

async function commitChanges() {
  if (!commitMessage.value.trim()) return;
  await git.commit(commitMessage.value);
  commitMessage.value = '';
}
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
    <p v-if="git.messageText" class="mx-3 mb-2 border border-green-500/40 bg-green-500/10 p-2 text-xs text-green-200">
      {{ git.messageText }}
    </p>

    <div class="border-b border-ide-border px-3 pb-3">
      <div class="relative mb-2">
        <button
          class="flex h-8 w-full items-center gap-2 border border-ide-border bg-ide-panel px-2 text-left text-xs text-ide-muted hover:border-ide-accent hover:text-ide-text disabled:opacity-50"
          :disabled="!git.isRepository"
          @click="toggleBranches"
        >
          <GitBranch :size="13" />
          <span class="min-w-0 flex-1 truncate">{{ git.branch ?? 'No branch' }}</span>
          <ChevronDown :size="13" />
        </button>
        <div v-if="branchOpen" class="absolute z-30 mt-1 max-h-64 w-full overflow-auto border border-ide-border bg-ide-panel py-1 text-xs shadow-xl thin-scrollbar">
          <button
            v-for="branch in git.branches"
            :key="branch"
            class="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-white/10"
            :class="branch === git.branch ? 'text-ide-accent' : 'text-ide-text'"
            @click="switchBranch(branch)"
          >
            <Check v-if="branch === git.branch" :size="12" />
            <span v-else class="w-3" />
            <span class="truncate">{{ branch }}</span>
          </button>
          <div v-if="git.branches.length === 0" class="px-3 py-2 text-ide-muted">No branches found.</div>
        </div>
      </div>
      <textarea
        v-model="commitMessage"
        class="mb-2 min-h-16 w-full resize-none border border-ide-border bg-ide-panel p-2 text-xs outline-none focus:border-ide-accent"
        placeholder="Commit message"
        :disabled="!git.isRepository || git.files.length === 0"
      />
      <button
        class="inline-flex h-8 w-full items-center justify-center gap-2 bg-ide-accent px-3 text-xs font-medium text-white hover:bg-[#1188d8] disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!git.isRepository || git.files.length === 0 || !commitMessage.trim() || git.committing"
        @click="commitChanges"
      >
        <GitBranch :size="13" />
        {{ git.committing ? 'Committing...' : 'Commit Changes' }}
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-auto thin-scrollbar">
      <p v-if="git.loading" class="px-3 py-3 text-ide-muted">Loading changes...</p>
      <p v-else-if="!git.isRepository" class="px-3 py-4 text-ide-muted">
        {{ git.message ?? 'This project is not a Git repository.' }}
        <button
          class="mt-3 block rounded bg-ide-accent px-3 py-2 text-xs font-medium text-white hover:bg-[#1188d8]"
          @click="git.initRepository"
        >
          Initialize repository
        </button>
      </p>
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
