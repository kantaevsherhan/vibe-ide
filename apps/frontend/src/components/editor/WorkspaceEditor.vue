<script setup lang="ts">
import { computed } from 'vue';
import { useEditorStore } from '../../stores/editor.store';
import CodeEditor from './CodeEditor.vue';
import MarkdownEditor from './MarkdownEditor.vue';

const editor = useEditorStore();
const isNote = computed(() => editor.activeFile?.kind === 'note');
</script>

<template>
  <MarkdownEditor v-if="isNote" />
  <CodeEditor v-else />
</template>
