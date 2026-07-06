<script setup lang="ts">
import { Bot, ChevronRight, ClipboardList, ExternalLink, Folder, GitBranch, MapPin, TerminalSquare, Trash2 } from '@lucide/vue';
import { computed, ref } from 'vue';
import type { Project } from '../../services/projects.api';

const props = defineProps<{
  project: Project;
}>();

defineEmits<{
  open: [folderName: string];
  delete: [project: Project];
}>();

const expanded = ref(false);

const gitLabel = computed(() => {
  if (props.project.health.gitClean) return 'Clean';
  return `${props.project.health.gitChangedFiles} changes`;
});

const updatedLabel = computed(() => formatDate(props.project.updatedAt));
const createdLabel = computed(() => formatDate(props.project.createdAt));

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusClass(status: string) {
  if (status === 'running' || status === 'active') return 'text-ide-accent';
  if (status === 'waiting') return 'text-yellow-300';
  if (status === 'error') return 'text-red-300';
  return 'text-ide-muted';
}
</script>

<template>
  <article class="border-b border-ide-border bg-ide-sidebar/80 text-sm last:border-b-0 hover:bg-[#2a2a2b]">
    <div class="grid min-h-12 grid-cols-[32px_minmax(180px,1.5fr)_minmax(120px,1fr)_minmax(120px,0.9fr)_minmax(160px,1fr)_100px_auto] items-center gap-3 px-3 max-lg:grid-cols-[32px_minmax(0,1fr)_auto] max-lg:gap-2">
      <button
        class="grid h-7 w-7 place-items-center text-ide-muted hover:text-ide-text"
        :title="expanded ? 'Collapse project' : 'Expand project'"
        @click="expanded = !expanded"
      >
        <ChevronRight :size="16" class="transition-transform" :class="{ 'rotate-90': expanded }" />
      </button>

      <button class="min-w-0 py-2 text-left" @click="expanded = !expanded">
        <div class="flex min-w-0 items-center gap-2">
          <Folder :size="15" class="shrink-0 text-ide-accent" />
          <span class="truncate font-medium text-ide-text">{{ project.name }}</span>
        </div>
        <div class="truncate text-xs text-ide-muted">{{ project.description || 'No description' }}</div>
      </button>

      <div class="min-w-0 text-xs text-ide-muted max-lg:hidden">
        <div class="flex min-w-0 items-center gap-1.5">
          <MapPin :size="13" class="shrink-0" />
          <span class="truncate font-mono">{{ project.folderName }}</span>
        </div>
      </div>

      <div class="min-w-0 text-xs max-lg:hidden" :class="project.health.gitClean ? 'text-green-300' : 'text-ide-accent'">
        <div class="flex min-w-0 items-center gap-1.5">
          <GitBranch :size="13" class="shrink-0" />
          <span class="truncate">{{ project.health.gitBranch || gitLabel }}</span>
        </div>
      </div>

      <div class="flex min-w-0 items-center gap-3 text-xs text-ide-muted max-lg:hidden">
        <span class="inline-flex items-center gap-1" title="Active terminals"><TerminalSquare :size="13" />{{ project.runtime.activeTerminals }}</span>
        <span class="inline-flex items-center gap-1" title="Running agents"><Bot :size="13" />{{ project.runtime.runningAgents }}</span>
        <span class="inline-flex items-center gap-1" title="Active tasks"><ClipboardList :size="13" />{{ project.runtime.activeTasks }}</span>
      </div>

      <div class="text-xs text-ide-muted max-lg:hidden">{{ updatedLabel }}</div>

      <div class="flex items-center justify-end gap-1">
        <button class="desktop-action-button h-8 gap-1.5 px-2" title="Open Project" @click="$emit('open', project.folderName)">
          <ExternalLink :size="14" />
          <span class="max-sm:hidden">Open</span>
        </button>
        <button
          class="grid h-8 w-8 place-items-center border border-ide-border text-ide-muted hover:border-red-500/60 hover:text-red-200"
          title="Delete project"
          @click="$emit('delete', project)"
        >
          <Trash2 :size="14" />
        </button>
      </div>
    </div>

    <div v-if="expanded" class="grid gap-4 border-t border-ide-border bg-[#1f1f1f] px-11 py-4 text-xs text-ide-muted md:grid-cols-[minmax(0,1fr)_260px]">
      <div class="min-w-0 space-y-3">
        <div>
          <div class="mb-1 uppercase tracking-wide">Description</div>
          <p class="whitespace-pre-wrap text-sm leading-5 text-ide-text">{{ project.description || 'No description.' }}</p>
        </div>
        <div>
          <div class="mb-1 uppercase tracking-wide">Location</div>
          <div class="flex min-w-0 items-center gap-2 border border-ide-border bg-ide-panel px-2 py-1.5 font-mono text-[11px] text-ide-accent">
            <MapPin :size="13" class="shrink-0 text-ide-muted" />
            <span class="truncate">{{ project.location }}</span>
          </div>
        </div>
      </div>

      <div class="grid gap-2">
        <div class="flex items-center justify-between gap-3">
          <span class="inline-flex items-center gap-1.5"><GitBranch :size="13" />Git</span>
          <span :class="project.health.gitClean ? 'text-green-300' : 'text-ide-accent'">{{ gitLabel }}</span>
        </div>
        <div class="flex items-center justify-between gap-3">
          <span class="inline-flex items-center gap-1.5"><TerminalSquare :size="13" />Terminals</span>
          <span :class="statusClass(project.health.terminalStatus)">{{ project.health.terminalStatus === 'active' ? 'Active' : 'Inactive' }}</span>
        </div>
        <div class="flex items-center justify-between gap-3">
          <span class="inline-flex items-center gap-1.5"><Bot :size="13" />Agents</span>
          <span :class="statusClass(project.health.agentStatus)">{{ project.health.agentStatus }}</span>
        </div>
        <div class="flex items-center justify-between gap-3">
          <span>Created</span>
          <span class="text-ide-text">{{ createdLabel }}</span>
        </div>
        <div class="flex items-center justify-between gap-3">
          <span>Updated</span>
          <span class="text-ide-text">{{ updatedLabel }}</span>
        </div>
      </div>
    </div>
  </article>
</template>
