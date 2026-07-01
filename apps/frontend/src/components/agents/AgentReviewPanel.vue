<script setup lang="ts">
import { FileCode, RefreshCw } from '@lucide/vue';
import { computed, ref, watch } from 'vue';
import { gitApi } from '../../services/git.api';
import type { GitFileStatus } from '../../types/git';

const props = defineProps<{
  projectName: string | null;
}>();

const files = ref<GitFileStatus[]>([]);
const selectedPath = ref<string | null>(null);
const diff = ref('');
const loading = ref(false);
const error = ref<string | null>(null);

const selectedFile = computed(() => files.value.find((file) => file.path === selectedPath.value) ?? null);

async function refresh() {
  if (!props.projectName) return;
  loading.value = true;
  error.value = null;
  try {
    const status = await gitApi.status(props.projectName);
    files.value = status.files;
    selectedPath.value = files.value[0]?.path ?? null;
    await loadDiff();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Failed to load Git review.';
  } finally {
    loading.value = false;
  }
}

async function loadDiff() {
  if (!props.projectName || !selectedPath.value) {
    diff.value = '';
    return;
  }
  try {
    diff.value = (await gitApi.diff(props.projectName, selectedPath.value)).diff;
  } catch (caught) {
    diff.value = caught instanceof Error ? caught.message : 'Unable to load diff.';
  }
}

watch(() => props.projectName, () => void refresh(), { immediate: true });
watch(selectedPath, () => void loadDiff());
</script>

<template>
  <section class="grid min-h-0 grid-cols-[220px_minmax(0,1fr)] bg-ide-panel max-md:grid-cols-1 max-md:grid-rows-[180px_minmax(0,1fr)]">
    <aside class="min-h-0 border-r border-ide-border max-md:border-b max-md:border-r-0">
      <header class="flex h-9 items-center justify-between border-b border-ide-border px-3 text-[11px] uppercase tracking-wide text-ide-muted">
        <span>Changed Files</span>
        <button class="grid h-6 w-6 place-items-center rounded hover:bg-white/10 hover:text-ide-text" title="Refresh review" @click="refresh">
          <RefreshCw :size="13" />
        </button>
      </header>
      <div class="min-h-0 overflow-auto thin-scrollbar">
        <p v-if="loading" class="p-3 text-xs text-ide-muted">Loading changes...</p>
        <p v-else-if="error" class="p-3 text-xs text-red-300">{{ error }}</p>
        <p v-else-if="files.length === 0" class="p-3 text-xs text-ide-muted">No changed files.</p>
        <button
          v-for="file in files"
          :key="file.path"
          class="flex w-full items-center gap-2 border-b border-ide-border/70 px-3 py-2 text-left text-xs hover:bg-white/5"
          :class="{ 'bg-white/10 text-ide-text': selectedPath === file.path, 'text-ide-muted': selectedPath !== file.path }"
          @click="selectedPath = file.path"
        >
          <FileCode :size="14" />
          <span class="min-w-0 flex-1 truncate">{{ file.path }}</span>
          <span class="font-mono text-[10px]">{{ file.raw }}</span>
        </button>
      </div>
    </aside>

    <pre class="min-h-0 overflow-auto whitespace-pre-wrap bg-[#181818] p-3 font-mono text-[11px] leading-5 text-ide-text thin-scrollbar">{{ selectedFile ? diff || 'No diff for this file.' : 'Select a changed file to review the diff.' }}</pre>
  </section>
</template>
