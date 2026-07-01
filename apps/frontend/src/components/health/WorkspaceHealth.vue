<script setup lang="ts">
import { Bot, ChevronDown, GitBranch, TerminalSquare } from '@lucide/vue';
import { computed, ref } from 'vue';
import { useGitStore } from '../../stores/git.store';
import { useHealthStore } from '../../stores/health.store';

const health = useHealthStore();
const git = useGitStore();
const branchOpen = ref(false);
const title = computed(() => {
  const state = health.state;
  if (!state) return 'Workspace health loading';
  return `Git: ${state.git.changedFiles} changed\nTerminals: ${state.terminals.active} active\nAgents: ${state.agents.running} running`;
});

async function toggleBranches() {
  branchOpen.value = !branchOpen.value;
  if (branchOpen.value) await git.loadBranches();
}

async function switchBranch(branch: string) {
  await git.checkout(branch);
  await health.refresh();
  branchOpen.value = false;
}
</script>

<template>
  <div class="workspace-health" :title="title">
    <button class="runtime-item hover:text-ide-text" @click="health.refresh">
      <GitBranch :size="13" />
      {{ health.state?.git.changedFiles ?? 0 }}
    </button>
    <div class="relative">
      <button class="runtime-item max-w-36 hover:text-ide-text" @click="toggleBranches">
        <GitBranch :size="13" />
        <span class="truncate">{{ git.branch ?? health.state?.git.branch ?? 'No branch' }}</span>
        <ChevronDown :size="12" />
      </button>
      <div v-if="branchOpen" class="fixed z-[1300] mt-2 max-h-72 min-w-44 overflow-auto border border-ide-border bg-ide-panel py-1 text-xs shadow-xl thin-scrollbar">
        <button
          v-for="branch in git.branches"
          :key="branch"
          class="block w-full px-3 py-1.5 text-left hover:bg-white/10"
          :class="branch === git.branch ? 'text-ide-accent' : 'text-ide-text'"
          @click="switchBranch(branch)"
        >
          {{ branch }}
        </button>
        <div v-if="git.branches.length === 0" class="px-3 py-2 text-ide-muted">No branches found.</div>
      </div>
    </div>
    <span class="runtime-item">
      <TerminalSquare :size="13" />
      {{ health.state?.terminals.active ?? 0 }}
    </span>
    <span class="runtime-item">
      <Bot :size="13" />
      {{ health.state?.agents.running ?? 0 }}
    </span>
  </div>
</template>
