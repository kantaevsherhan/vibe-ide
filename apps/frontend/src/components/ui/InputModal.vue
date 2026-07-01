<script setup lang="ts">
import { ref, watch } from 'vue';
import BaseModal from './BaseModal.vue';

const props = defineProps<{
  open: boolean;
  title: string;
  label: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel: string;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [value: string];
}>();

const value = ref('');

watch(
  () => props.open,
  () => {
    value.value = props.initialValue ?? '';
  },
  { immediate: true }
);

function confirm() {
  const trimmed = value.value.trim();
  if (!trimmed) return;
  emit('confirm', trimmed);
}
</script>

<template>
  <BaseModal v-if="open" :title="title" @close="$emit('close')">
    <form class="grid gap-4 p-4" @submit.prevent="confirm">
      <label class="block">
        <span class="mb-2 block text-sm text-ide-text">{{ label }}</span>
        <input
          v-model="value"
          class="h-9 w-full border border-ide-border bg-ide-panel px-3 text-sm outline-none focus:border-ide-accent"
          :placeholder="placeholder"
          autocomplete="off"
          autofocus
        />
      </label>
      <footer class="flex justify-end gap-2">
        <button type="button" class="h-8 border border-ide-border px-4 text-sm text-ide-muted hover:bg-white/10 hover:text-ide-text" @click="$emit('close')">
          Cancel
        </button>
        <button class="h-8 bg-ide-accent px-4 text-sm font-medium text-white hover:bg-[#0b86d1] disabled:cursor-not-allowed disabled:opacity-45" :disabled="!value.trim()">
          {{ confirmLabel }}
        </button>
      </footer>
    </form>
  </BaseModal>
</template>
