<script setup lang="ts">
import { X } from '@lucide/vue';

defineProps<{
  title: string;
  panelClass?: string;
}>();

defineEmits<{
  close: [];
}>();
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[2000] grid place-items-center bg-black/60 px-4" @mousedown.self="$emit('close')">
      <section class="w-full border border-ide-border bg-ide-sidebar text-ide-text shadow-2xl" :class="panelClass ?? 'max-w-md'">
        <header class="flex items-center justify-between border-b border-ide-border px-4 py-3">
          <h2 class="text-base font-semibold">{{ title }}</h2>
          <button class="grid h-7 w-7 place-items-center text-ide-muted hover:bg-white/10 hover:text-ide-text" title="Close" @click="$emit('close')">
            <X :size="17" />
          </button>
        </header>
        <slot />
      </section>
    </div>
  </Teleport>
</template>
