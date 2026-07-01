<script setup lang="ts">
import BaseModal from './BaseModal.vue';

defineProps<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}>();

defineEmits<{
  close: [];
  confirm: [];
}>();
</script>

<template>
  <BaseModal v-if="open" :title="title" @close="$emit('close')">
    <div class="grid gap-4 p-4">
      <p class="text-sm leading-5 text-ide-muted">{{ message }}</p>
      <footer class="flex justify-end gap-2">
        <button class="h-8 border border-ide-border px-4 text-sm text-ide-muted hover:bg-white/10 hover:text-ide-text" @click="$emit('close')">
          Cancel
        </button>
        <button
          class="h-8 px-4 text-sm font-medium text-white"
          :class="danger ? 'bg-red-600 hover:bg-red-500' : 'bg-ide-accent hover:bg-[#0b86d1]'"
          @click="$emit('confirm')"
        >
          {{ confirmLabel ?? 'Confirm' }}
        </button>
      </footer>
    </div>
  </BaseModal>
</template>
