<script setup lang="ts">
import { onMounted, ref } from 'vue';
import ActivityBar from '../components/activity-bar/ActivityBar.vue';
import CodeEditor from '../components/editor/CodeEditor.vue';
import EditorTabs from '../components/editor/EditorTabs.vue';
import FileExplorer from '../components/sidebar/FileExplorer.vue';
import GitPanel from '../components/sidebar/GitPanel.vue';
import TerminalPanel from '../components/sidebar/TerminalPanel.vue';
import TerminalView from '../components/terminal/TerminalView.vue';
import { useFilesStore } from '../stores/files.store';
import { useTerminalStore } from '../stores/terminal.store';

const activeView = ref<'files' | 'git' | 'terminal'>('files');
const files = useFilesStore();
const terminals = useTerminalStore();

onMounted(async () => {
  await files.refresh();
  terminals.connect();
});
</script>

<template>
  <div class="grid h-screen w-screen grid-cols-[48px_280px_minmax(0,1fr)] bg-ide-main text-[13px] text-ide-text">
    <ActivityBar v-model="activeView" />

    <aside class="min-w-0 border-r border-ide-border bg-ide-sidebar">
      <FileExplorer v-if="activeView === 'files'" />
      <GitPanel v-else-if="activeView === 'git'" />
      <TerminalPanel v-else />
    </aside>

    <main class="grid min-w-0 grid-rows-[36px_minmax(0,1fr)_220px]">
      <EditorTabs />
      <CodeEditor />
      <TerminalView />
    </main>
  </div>
</template>
