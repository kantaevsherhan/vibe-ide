<script setup lang="ts">
import { X } from '@lucide/vue';
import { onMounted, ref } from 'vue';

defineProps<{
  title: string;
  panelClass?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();
const dialog = ref<HTMLDialogElement | null>(null);
onMounted(() => dialog.value?.showModal());
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" :aria-label="title" class="m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-black/60 p-4 text-ide-text open:grid open:place-items-center" @cancel.prevent="emit('close')" @mousedown.self="emit('close')">
      <section class="w-full border border-ide-border bg-ide-sidebar text-ide-text shadow-2xl" :class="panelClass ?? 'max-w-md'">
        <header class="flex items-center justify-between border-b border-ide-border px-4 py-3">
          <h2 class="text-base font-semibold">{{ title }}</h2>
          <button class="grid h-11 w-11 place-items-center text-ide-muted hover:bg-white/10 hover:text-ide-text" aria-label="Close dialog" title="Close" @click="emit('close')">
            <X :size="17" />
          </button>
        </header>
        <slot />
      </section>
    </dialog>
  </Teleport>
</template>
