<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { X } from '@lucide/vue';
import type { Project } from '../../services/projects.api';

const props = defineProps<{
  project: Project | null;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [folderName: string];
}>();

const confirmation = ref('');
const canDelete = computed(() => Boolean(props.project && confirmation.value === props.project.name));

watch(
  () => props.project,
  () => {
    confirmation.value = '';
  }
);

function confirmDelete() {
  if (!props.project || !canDelete.value) return;
  emit('confirm', props.project.folderName);
}
</script>

<template>
  <Teleport to="body">
    <div v-if="project" class="fixed inset-0 z-[2000] grid place-items-center bg-black/60 px-4">
      <section class="w-full max-w-md border border-ide-border bg-ide-sidebar text-ide-text shadow-2xl">
        <header class="flex items-center justify-between border-b border-ide-border px-4 py-3">
          <h2 class="text-base font-semibold">Delete Project</h2>
          <button class="grid h-7 w-7 place-items-center text-ide-muted hover:bg-white/10 hover:text-ide-text" title="Close" @click="$emit('close')">
            <X :size="17" />
          </button>
        </header>

        <div class="grid gap-4 p-4">
          <p class="text-sm leading-5 text-ide-muted">
            Are you sure you want to delete this project? This action cannot be undone. All project files will be permanently removed.
          </p>

          <div>
            <label class="mb-2 block text-sm text-ide-text">Type the project name to confirm:</label>
            <div class="mb-2 border border-ide-border bg-ide-panel px-3 py-2 font-mono text-sm text-ide-accent">{{ project.name }}</div>
            <input
              v-model="confirmation"
              class="h-9 w-full border border-ide-border bg-ide-panel px-3 text-sm outline-none focus:border-ide-accent"
              placeholder="Enter project name"
              autocomplete="off"
              @keydown.enter="confirmDelete"
            />
          </div>
        </div>

        <footer class="flex justify-end gap-2 border-t border-ide-border px-4 py-3">
          <button class="h-8 border border-ide-border px-4 text-sm text-ide-muted hover:bg-white/10 hover:text-ide-text" @click="$emit('close')">
            Cancel
          </button>
          <button
            class="h-8 bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-45"
            :disabled="!canDelete"
            @click="confirmDelete"
          >
            Delete
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
