<script setup lang="ts">
import { computed } from 'vue';
import { useEditorStore } from '../../stores/editor.store';
import AgentWorkspace from '../agents/AgentWorkspace.vue';
import CodeEditor from './CodeEditor.vue';
import MarkdownEditor from './MarkdownEditor.vue';

const editor = useEditorStore();
const isNote = computed(() => editor.activeFile?.kind === 'note');
const isAgent = computed(() => editor.activeTab?.kind === 'agent');
</script>

<template>
  <AgentWorkspace v-if="isAgent" :agent-id="editor.activeAgentId" />
  <MarkdownEditor v-else-if="isNote" />
  <CodeEditor v-else />
</template>
