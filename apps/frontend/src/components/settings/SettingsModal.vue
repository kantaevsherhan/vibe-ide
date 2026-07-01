<script setup lang="ts">
import { ref } from 'vue';
import BaseModal from '../ui/BaseModal.vue';

defineProps<{
  open: boolean;
}>();

defineEmits<{
  close: [];
}>();

const sections = ['General', 'Appearance', 'Editor', 'Explorer', 'Terminal', 'Agents', 'Workspace'];
const active = ref('General');
</script>

<template>
  <BaseModal v-if="open" title="Settings" @close="$emit('close')">
    <div class="grid min-h-80 grid-cols-[140px_minmax(0,1fr)]">
      <aside class="border-r border-ide-border bg-ide-panel/60 py-2">
        <button
          v-for="section in sections"
          :key="section"
          class="block w-full px-3 py-2 text-left text-sm hover:bg-white/10"
          :class="active === section ? 'text-ide-text bg-white/5' : 'text-ide-muted'"
          @click="active = section"
        >
          {{ section }}
        </button>
      </aside>
      <section class="p-4">
        <h3 class="mb-2 text-sm font-semibold">{{ active }}</h3>
        <p class="text-sm text-ide-muted">Settings for this section will be available here.</p>
      </section>
    </div>
  </BaseModal>
</template>
