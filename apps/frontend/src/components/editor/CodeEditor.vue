<script setup lang="ts">
import loader from '@monaco-editor/loader';
import type * as Monaco from 'monaco-editor';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { resizeEventName } from '../../composables/useResizable';
import { useEditorStore } from '../../stores/editor.store';
import { useSettingsStore } from '../../stores/settings.store';

const editorStore = useEditorStore();
const settings = useSettingsStore();
const container = ref<HTMLElement | null>(null);
let monacoEditor: Monaco.editor.IStandaloneCodeEditor | null = null;
let monacoInstance: typeof Monaco | null = null;
let applyingExternalValue = false;

const activeFile = computed(() => editorStore.activeFile);

function languageFor(path: string) {
  const extension = path.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    vue: 'html',
    json: 'json',
    md: 'markdown',
    css: 'css',
    html: 'html',
    py: 'python',
    go: 'go',
    rs: 'rust',
    sh: 'shell'
  };
  return map[extension ?? ''] ?? 'plaintext';
}

function layoutEditor() {
  window.requestAnimationFrame(() => monacoEditor?.layout());
}

async function mountEditor() {
  if (!container.value) return;

  monacoInstance = await loader.init();
  monacoInstance.editor.defineTheme('vibe-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#1e1e1e',
      'editorLineNumber.foreground': '#858585',
      'editorCursor.foreground': '#007acc',
      'editorIndentGuide.background1': '#333333'
    }
  });
  monacoInstance.editor.defineTheme('vibe-light', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#f3f3f3',
      'editorLineNumber.foreground': '#6a6a6a',
      'editorCursor.foreground': '#007acc',
      'editorIndentGuide.background1': '#d0d0d0'
    }
  });

  monacoEditor = monacoInstance.editor.create(container.value, {
    value: activeFile.value?.content ?? '',
    language: activeFile.value?.path ? languageFor(activeFile.value.path) : 'plaintext',
    theme: settings.local.theme === 'light' ? 'vibe-light' : 'vibe-dark',
    automaticLayout: true,
    minimap: { enabled: true },
    fontFamily: settings.editorFontFamily,
    fontSize: settings.local.fontSize,
    tabSize: 2,
    padding: { top: 14 }
  });

  monacoEditor.onDidChangeModelContent(() => {
    if (applyingExternalValue || !monacoEditor) return;
    editorStore.updateContent(monacoEditor.getValue());
  });

  monacoEditor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
    void editorStore.saveActive();
  });
}

watch(
  () => activeFile.value?.path,
  async () => {
    await nextTick();
    if (!monacoEditor || !monacoInstance) return;

    applyingExternalValue = true;
    monacoEditor.setValue(activeFile.value?.content ?? '');
    const model = monacoEditor.getModel();
    if (model && activeFile.value?.path) {
      monacoInstance.editor.setModelLanguage(model, languageFor(activeFile.value.path));
    }
    applyingExternalValue = false;
  }
);

watch(
  () => [settings.local.theme, settings.local.fontSize, settings.local.fontFamily] as const,
  () => {
    if (!monacoEditor || !monacoInstance) return;
    monacoInstance.editor.setTheme(settings.local.theme === 'light' ? 'vibe-light' : 'vibe-dark');
    monacoEditor.updateOptions({
      fontFamily: settings.editorFontFamily,
      fontSize: settings.local.fontSize
    });
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

onMounted(() => {
  void mountEditor();
  window.addEventListener(resizeEventName, layoutEditor);
});
onBeforeUnmount(() => {
  window.removeEventListener(resizeEventName, layoutEditor);
  monacoEditor?.dispose();
});
</script>

<template>
  <section class="relative min-h-0 bg-ide-main">
    <div v-show="activeFile" ref="container" class="h-full w-full" />
    <div v-if="editorStore.blockedFile" class="grid h-full place-items-center px-6 text-center text-ide-muted">
      <div class="max-w-md">
        <div class="mb-2 font-mono text-2xl text-ide-text">{{ editorStore.blockedFile.title }}</div>
        <p>{{ editorStore.blockedFile.message }}</p>
        <p class="mt-2 truncate font-mono text-xs text-[#858585]">{{ editorStore.blockedFile.path }}</p>
        <button
          v-if="editorStore.blockedFile.canForceOpen"
          class="mt-5 rounded bg-ide-accent px-4 py-2 text-sm font-medium text-white hover:bg-[#1188d8]"
          @click="editorStore.openAnyway"
        >
          Open anyway
        </button>
      </div>
    </div>
    <div v-else-if="!activeFile" class="grid h-full place-items-center text-center text-ide-muted">
      <div>
        <div class="mb-3 font-mono text-3xl text-[#3f3f3f]">VibeIDE</div>
        <p>Open a file from the workspace to start coding.</p>
      </div>
    </div>
  </section>
</template>
