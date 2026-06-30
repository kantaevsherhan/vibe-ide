<script setup lang="ts">
import { LockKeyhole } from '@lucide/vue';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.store';

const router = useRouter();
const auth = useAuthStore();
const username = ref('admin');
const password = ref('');

async function submit() {
  await auth.login(username.value, password.value);
  await router.push('/');
}
</script>

<template>
  <main class="grid h-screen place-items-center bg-ide-main px-4 text-ide-text">
    <form class="w-full max-w-sm border border-ide-border bg-ide-sidebar p-6 shadow-2xl" @submit.prevent="submit">
      <div class="mb-6 flex items-center gap-3">
        <div class="grid h-10 w-10 place-items-center bg-ide-accent/15 text-ide-accent">
          <LockKeyhole :size="22" />
        </div>
        <div>
          <h1 class="text-lg font-semibold">Sign in to VibeIDE</h1>
          <p class="text-sm text-ide-muted">Access to files, Git and terminal is protected.</p>
        </div>
      </div>

      <label class="mb-3 block">
        <span class="mb-1 block text-xs uppercase tracking-wide text-ide-muted">Username</span>
        <input
          v-model="username"
          class="h-9 w-full border border-ide-border bg-ide-panel px-3 text-ide-text outline-none focus:border-ide-accent"
          autocomplete="username"
          required
        />
      </label>

      <label class="mb-4 block">
        <span class="mb-1 block text-xs uppercase tracking-wide text-ide-muted">Password</span>
        <input
          v-model="password"
          class="h-9 w-full border border-ide-border bg-ide-panel px-3 text-ide-text outline-none focus:border-ide-accent"
          type="password"
          autocomplete="current-password"
          required
        />
      </label>

      <p v-if="auth.error" class="mb-4 border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-200">
        {{ auth.error }}
      </p>

      <button
        class="h-9 w-full bg-ide-accent font-medium text-white hover:bg-[#0b86d1] disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="auth.loading"
      >
        {{ auth.loading ? 'Signing in...' : 'Sign in' }}
      </button>
    </form>
  </main>
</template>
