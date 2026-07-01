<script setup lang="ts">
export type ContextMenuItem = {
  label: string;
  action: () => void;
  danger?: boolean;
  disabled?: boolean;
};

defineProps<{
  x: number;
  y: number;
  items: ContextMenuItem[];
}>();

defineEmits<{
  close: [];
}>();
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[1500]" @mousedown="$emit('close')" @contextmenu.prevent="$emit('close')">
      <div class="fixed min-w-40 border border-ide-border bg-ide-panel py-1 text-xs shadow-xl" :style="{ left: `${x}px`, top: `${y}px` }" @mousedown.stop>
        <button
          v-for="item in items"
          :key="item.label"
          class="block w-full px-3 py-1.5 text-left hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
          :class="item.danger ? 'text-red-300' : 'text-ide-text'"
          :disabled="item.disabled"
          @click="item.action(); $emit('close')"
        >
          {{ item.label }}
        </button>
      </div>
    </div>
  </Teleport>
</template>
