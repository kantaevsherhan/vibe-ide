<script setup lang="ts">
import loader from '@monaco-editor/loader';
import type * as Monaco from 'monaco-editor';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import MarkdownIt from 'markdown-it';
import { full as markdownItEmoji } from 'markdown-it-emoji';
import markdownItTaskLists from 'markdown-it-task-lists';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { resizeEventName } from '../../composables/useResizable';
import { useEditorStore } from '../../stores/editor.store';

type MarkdownMode = 'edit' | 'preview' | 'split';

const editorStore = useEditorStore();
const container = ref<HTMLElement | null>(null);
const mode = ref<MarkdownMode>('split');
let monacoEditor: Monaco.editor.IStandaloneCodeEditor | null = null;
let monacoInstance: typeof Monaco | null = null;
let applyingExternalValue = false;
let saveTimer: number | undefined;

const activeFile = computed(() => editorStore.activeFile);
const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight(code: string, language: string) {
    const validLanguage = language && hljs.getLanguage(language);
    const result = validLanguage ? hljs.highlight(code, { language }).value : hljs.highlightAuto(code).value;
    return `<pre class="hljs"><code>${result}</code></pre>`;
  }
})
  .use(markdownItEmoji)
  .use(markdownItTaskLists, { enabled: true });

const rendered = computed(() => markdown.render(activeFile.value?.content ?? ''));

function layoutEditor() {
  window.requestAnimationFrame(() => monacoEditor?.layout());
}

function scheduleSave() {
  if (activeFile.value?.kind !== 'note') return;
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    void editorStore.saveActive();
  }, 500);
}

async function mountEditor() {
  if (!container.value) return;
  monacoInstance = await loader.init();
  monacoEditor = monacoInstance.editor.create(container.value, {
    value: activeFile.value?.content ?? '',
    language: 'markdown',
    theme: 'vibe-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    wordWrap: 'on',
    fontFamily: 'JetBrains Mono, Cascadia Code, Consolas, monospace',
    fontSize: 13,
    tabSize: 2,
    padding: { top: 14 }
  });

  monacoEditor.onDidChangeModelContent(() => {
    if (applyingExternalValue || !monacoEditor) return;
    editorStore.updateContent(monacoEditor.getValue());
    scheduleSave();
  });

  monacoEditor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
    void editorStore.saveActive();
  });
}

watch(
  () => activeFile.value?.id,
  async () => {
    await nextTick();
    if (!monacoEditor) return;
    applyingExternalValue = true;
    monacoEditor.setValue(activeFile.value?.content ?? '');
    applyingExternalValue = false;
    layoutEditor();
  }
);

watch(
  () => activeFile.value?.content,
  (content) => {
    if (!monacoEditor || monacoEditor.getValue() === (content ?? '')) return;
    applyingExternalValue = true;
    monacoEditor.setValue(content ?? '');
    applyingExternalValue = false;
  }
);

watch(mode, layoutEditor);

onMounted(() => {
  void mountEditor();
  window.addEventListener(resizeEventName, layoutEditor);
});

onBeforeUnmount(() => {
  if (saveTimer) window.clearTimeout(saveTimer);
  window.removeEventListener(resizeEventName, layoutEditor);
  monacoEditor?.dispose();
});
</script>

<template>
  <section class="grid min-h-0 bg-ide-main" style="grid-template-rows: 36px minmax(0, 1fr)">
    <header class="flex items-center justify-between border-b border-ide-border bg-[#202020] px-3">
      <div class="truncate text-xs text-ide-muted">{{ activeFile?.path }}</div>
      <div class="flex overflow-hidden rounded border border-ide-border text-xs">
        <button class="px-3 py-1 hover:bg-white/10" :class="{ 'bg-ide-accent text-white': mode === 'edit' }" @click="mode = 'edit'">Edit</button>
        <button class="px-3 py-1 hover:bg-white/10" :class="{ 'bg-ide-accent text-white': mode === 'preview' }" @click="mode = 'preview'">Preview</button>
        <button class="px-3 py-1 hover:bg-white/10" :class="{ 'bg-ide-accent text-white': mode === 'split' }" @click="mode = 'split'">Split</button>
      </div>
    </header>

    <div class="grid min-h-0" :class="{ 'grid-cols-2': mode === 'split', 'grid-cols-1': mode !== 'split' }">
      <div v-show="mode !== 'preview'" ref="container" class="min-h-0 min-w-0" />
      <article
        v-show="mode !== 'edit'"
        class="markdown-preview min-h-0 min-w-0 overflow-auto border-l border-ide-border bg-ide-main p-6 thin-scrollbar"
        v-html="rendered"
      />
    </div>
  </section>
</template>
