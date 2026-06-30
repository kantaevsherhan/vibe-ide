<script setup lang="ts">
import { Bot, GitBranch, TerminalSquare } from '@lucide/vue';
import { computed, onMounted } from 'vue';
import { useHealthStore } from '../../stores/health.store';

const health = useHealthStore();
const title = computed(() => {
  const state = health.state;
  if (!state) return 'Workspace health loading';
  return `Git: ${state.git.changedFiles} changed\nTerminals: ${state.terminals.active} active\nAgents: ${state.agents.running} running`;
});

onMounted(() => {
  void health.refresh();
});
</script>

<template>
  <button class="workspace-health" :title="title" @click="health.refresh">
    <span class="runtime-item">
      <GitBranch :size="13" />
      {{ health.state?.git.changedFiles ?? 0 }}
    </span>
    <span class="runtime-item">
      <TerminalSquare :size="13" />
      {{ health.state?.terminals.active ?? 0 }}
    </span>
    <span class="runtime-item">
      <Bot :size="13" />
      {{ health.state?.agents.running ?? 0 }}
    </span>
  </button>
</template>
