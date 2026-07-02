<script setup lang="ts">
defineProps<{
  projectName: string;
}>();
</script>

<template>
  <header class="title-bar">
    <img class="title-bar-logo" src="/logo.png" alt="VibeIDE" />
    <div class="title-bar-text">
      <span class="title-bar-app">
        VibeIDE by
        <a class="title-bar-link" href="https://kansherhan.vercel.app/" target="_blank" rel="noopener noreferrer">SHRK</a>
      </span>
      <span class="title-bar-separator">—</span>
      <span class="title-bar-project" :title="projectName">{{ projectName }}</span>
    </div>
  </header>
</template>
