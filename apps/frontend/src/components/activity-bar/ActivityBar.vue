<script setup lang="ts">
import { Bot, Files, GitBranch, LogOut, NotebookText, Settings, TerminalSquare } from '@lucide/vue';
import { useRouter } from 'vue-router';

const model = defineModel<'files' | 'git' | 'terminal' | 'notes' | 'agents'>({ required: true });
defineEmits<{
  settings: [];
  selectView: [view: 'files' | 'git' | 'terminal' | 'notes' | 'agents'];
}>();
const router = useRouter();

const items = [
  { id: 'files', label: 'Files', icon: Files },
  { id: 'git', label: 'Git', icon: GitBranch },
  { id: 'terminal', label: 'Terminal', icon: TerminalSquare },
  { id: 'notes', label: 'Notes', icon: NotebookText },
  { id: 'agents', label: 'Agents', icon: Bot }
] as const;

async function exitProject() {
  await router.push('/projects');
}
</script>

<template>
  <nav class="flex flex-col items-center gap-1 border-r border-ide-border bg-ide-activity py-2">
    <button
      v-for="item in items"
      :key="item.id"
      :title="item.label"
      class="relative grid h-11 w-full place-items-center font-mono text-[15px] text-ide-muted transition hover:text-ide-text"
      :class="{ 'text-ide-text': model === item.id }"
      @click="$emit('selectView', item.id)"
    >
      <span
        v-if="model === item.id"
        class="absolute left-0 top-2 h-7 w-0.5 rounded-r bg-ide-accent shadow-[0_0_12px_rgba(0,122,204,0.9)]"
      />
      <component :is="item.icon" :size="22" :stroke-width="1.8" />
      <span class="sr-only">{{ item.label }}</span>
    </button>
    <button
      title="Settings"
      class="mt-auto grid h-11 w-full place-items-center text-ide-muted transition hover:text-ide-text"
      @click="$emit('settings')"
    >
      <Settings :size="20" :stroke-width="1.8" />
    </button>
    <button
      title="Exit Project"
      class="grid h-11 w-full place-items-center text-ide-muted transition hover:text-ide-text"
      @click="exitProject"
    >
      <LogOut :size="20" :stroke-width="1.8" />
    </button>
  </nav>
</template>
