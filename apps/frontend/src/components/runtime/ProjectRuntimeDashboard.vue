<script setup lang="ts">
import { Bot, ClipboardList, TerminalSquare } from '@lucide/vue';
import { computed } from 'vue';
import { useRuntimeStore } from '../../stores/runtime.store';

const runtime = useRuntimeStore();
const tooltip = computed(
  () =>
    `Active terminals: ${runtime.state.activeTerminalsCount}\nAI agents: Coming soon\nTasks: Coming soon`
);
</script>

<template>
  <div class="runtime-dashboard" :title="tooltip">
    <span class="runtime-item">
      <TerminalSquare :size="13" />
      {{ runtime.state.activeTerminalsCount }}
    </span>
    <span class="runtime-item">
      <Bot :size="13" />
      {{ runtime.state.runningAgentsCount }}
    </span>
    <span class="runtime-item">
      <ClipboardList :size="13" />
      {{ runtime.state.activeTasksCount }}
    </span>
    <span class="runtime-soon">AI coming soon</span>
  </div>
</template>
