<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { GitBranch, PackagePlus, Sparkles } from '@lucide/vue';
import BaseModal from '../ui/BaseModal.vue';
import { useAgentsStore } from '../../stores/agents.store';
import type { CreateProjectInput } from '../../services/projects.api';

const props = defineProps<{
  open: boolean;
  loading?: boolean;
  error?: string | null;
}>();

const emit = defineEmits<{
  close: [];
  create: [input: CreateProjectInput];
}>();

type ProjectSource = 'blank' | 'git' | 'prompt';

const agents = useAgentsStore();
const source = ref<ProjectSource>('blank');
const touchedFolder = ref(false);
const form = reactive({
  name: '',
  folderName: '',
  description: '',
  repositoryUrl: '',
  prompt: '',
  agentId: ''
});

const normalizedFolderName = computed(() => slugify(form.folderName || form.name));
const folderChanged = computed(() => Boolean(form.folderName) && form.folderName !== normalizedFolderName.value);
const canCreate = computed(() => {
  if (!form.name.trim() || !normalizedFolderName.value) return false;
  if (source.value === 'git' && !form.repositoryUrl.trim()) return false;
  if (source.value === 'prompt' && (!form.prompt.trim() || !form.agentId)) return false;
  return !props.loading;
});

const availableAgents = computed(() => agents.agents.filter((agent) => agent.enabled && agent.installed));

watch(
  () => form.name,
  () => {
    if (!touchedFolder.value) {
      form.folderName = slugify(form.name);
    }
  }
);

watch(
  () => props.open,
  (open) => {
    if (!open) reset();
    if (open) void loadAgents();
  }
);

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/_+/g, '_')
    .replace(/^[-_]+|[-_]+$/g, '');
}

function normalizeFolderName() {
  form.folderName = normalizedFolderName.value;
}

function reset() {
  source.value = 'blank';
  touchedFolder.value = false;
  form.name = '';
  form.folderName = '';
  form.description = '';
  form.repositoryUrl = '';
  form.prompt = '';
  form.agentId = '';
}

async function loadAgents() {
  await agents.loadAgents();
  form.agentId = form.agentId || availableAgents.value[0]?.id || '';
}

function submit() {
  normalizeFolderName();
  if (!canCreate.value) return;
  emit('create', {
    source: source.value,
    name: form.name.trim(),
    folderName: form.folderName,
    description: form.description.trim(),
    repositoryUrl: source.value === 'git' ? form.repositoryUrl.trim() : undefined,
    prompt: source.value === 'prompt' ? form.prompt.trim() : undefined,
    agentId: source.value === 'prompt' ? form.agentId : undefined
  });
}
</script>

<template>
  <BaseModal v-if="open" title="Create Project" panel-class="max-w-4xl max-h-[calc(100dvh-2rem)] overflow-y-auto" @close="$emit('close')">
    <form class="space-y-4 px-4 py-4" @submit.prevent="submit">
      <div class="grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          class="flex items-center gap-2 border px-3 py-2 text-left text-sm"
          :class="source === 'blank' ? 'border-ide-accent bg-ide-accent/15 text-ide-text' : 'border-ide-border bg-ide-panel text-ide-muted hover:text-ide-text'"
          @click="source = 'blank'"
        >
          <PackagePlus :size="16" />
          Blank project
        </button>
        <button
          type="button"
          class="flex items-center gap-2 border px-3 py-2 text-left text-sm"
          :class="source === 'git' ? 'border-ide-accent bg-ide-accent/15 text-ide-text' : 'border-ide-border bg-ide-panel text-ide-muted hover:text-ide-text'"
          @click="source = 'git'"
        >
          <GitBranch :size="16" />
          Import from Git
        </button>
        <button
          type="button"
          class="flex items-center gap-2 border px-3 py-2 text-left text-sm"
          :class="source === 'prompt' ? 'border-ide-accent bg-ide-accent/15 text-ide-text' : 'border-ide-border bg-ide-panel text-ide-muted hover:text-ide-text'"
          @click="source = 'prompt'"
        >
          <Sparkles :size="16" />
          From prompt
        </button>
      </div>

      <label class="block">
        <span class="mb-1 block text-xs uppercase tracking-wide text-ide-muted">Project name</span>
        <input
          v-model="form.name"
          class="h-9 w-full border border-ide-border bg-ide-panel px-3 outline-none focus:border-ide-accent"
          placeholder="My Project"
          required
        />
      </label>

      <label class="block">
        <span class="mb-1 block text-xs uppercase tracking-wide text-ide-muted">Folder name</span>
        <input
          v-model="form.folderName"
          class="h-9 w-full border bg-ide-panel px-3 font-mono outline-none focus:border-ide-accent"
          :class="folderChanged ? 'border-yellow-500/70' : 'border-ide-border'"
          placeholder="my-project"
          required
          @input="touchedFolder = true"
          @blur="normalizeFolderName"
        />
        <p class="mt-1 text-xs text-ide-muted">
          Spaces and unsafe symbols are converted to safe characters. Final folder:
          <span class="font-mono text-ide-text">{{ normalizedFolderName || 'project-folder' }}</span>
        </p>
      </label>

      <label class="block">
        <span class="mb-1 block text-xs uppercase tracking-wide text-ide-muted">Description</span>
        <textarea
          v-model="form.description"
          class="min-h-20 w-full resize-none border border-ide-border bg-ide-panel px-3 py-2 outline-none focus:border-ide-accent"
          placeholder="Optional project description"
        />
      </label>

      <label v-if="source === 'git'" class="block">
        <span class="mb-1 block text-xs uppercase tracking-wide text-ide-muted">Repository URL</span>
        <input
          v-model="form.repositoryUrl"
          class="h-9 w-full border border-ide-border bg-ide-panel px-3 font-mono outline-none focus:border-ide-accent"
          placeholder="https://github.com/user/repo.git"
          required
        />
        <p class="mt-1 text-xs text-ide-muted">Supports GitHub, GitLab, HTTPS, SSH, and git@host:path URLs.</p>
      </label>

      <div v-if="source === 'prompt'" class="space-y-3">
        <label class="block">
          <span class="mb-1 block text-xs uppercase tracking-wide text-ide-muted">Agent</span>
          <select
            v-model="form.agentId"
            class="h-9 w-full border border-ide-border bg-ide-panel px-3 outline-none focus:border-ide-accent"
            required
          >
            <option value="" disabled>Select agent</option>
            <option v-for="agent in availableAgents" :key="agent.id" :value="agent.id">{{ agent.name }}</option>
          </select>
          <p v-if="availableAgents.length === 0" class="mt-1 text-xs text-yellow-300">No installed agents are available.</p>
        </label>

        <label class="block">
          <span class="mb-1 block text-xs uppercase tracking-wide text-ide-muted">Project prompt</span>
          <textarea
            v-model="form.prompt"
            class="min-h-32 w-full resize-none border border-ide-border bg-ide-panel px-3 py-2 outline-none focus:border-ide-accent"
            placeholder="Describe what the selected agent should build in this project..."
            required
          />
        </label>
      </div>

      <p v-if="error" class="border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{{ error }}</p>

      <footer class="flex justify-end gap-2 border-t border-ide-border pt-4">
        <button type="button" class="desktop-action-button h-9 px-3" :disabled="loading" @click="$emit('close')">Cancel</button>
        <button
          type="submit"
          class="h-9 bg-ide-accent px-4 font-medium text-white hover:bg-[#0b86d1] disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!canCreate"
        >
          {{
            loading
              ? source === 'git'
                ? 'Importing...'
                : 'Creating...'
              : source === 'git'
                ? 'Import Project'
                : source === 'prompt'
                  ? 'Create & Run Agent'
                  : 'Create Project'
          }}
        </button>
      </footer>
    </form>
  </BaseModal>
</template>
