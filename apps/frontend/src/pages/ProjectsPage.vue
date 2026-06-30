<script setup lang="ts">
import { FolderPlus, LogOut, Trash2 } from '@lucide/vue';
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.store';
import { useProjectsStore } from '../stores/projects.store';

const projects = useProjectsStore();
const auth = useAuthStore();
const router = useRouter();
const creating = ref(false);
const form = reactive({
  name: '',
  folderName: '',
  description: ''
});

onMounted(() => {
  void projects.loadProjects();
});

function normalizeFolderName() {
  form.folderName = form.folderName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '');
}

async function submit() {
  normalizeFolderName();
  const project = await projects.createProject({
    name: form.name,
    folderName: form.folderName,
    description: form.description
  });
  form.name = '';
  form.folderName = '';
  form.description = '';
  creating.value = false;
  await projects.openProject(project.folderName);
}

async function logout() {
  await auth.logout();
  await router.push('/login');
}
</script>

<template>
  <main class="min-h-screen overflow-auto bg-ide-main px-5 py-5 text-ide-text thin-scrollbar">
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <header class="flex flex-wrap items-center justify-between gap-3 border-b border-ide-border pb-4">
        <div>
          <h1 class="text-xl font-semibold">VibeIDE Projects</h1>
          <p class="text-sm text-ide-muted">Each folder inside workspace is a separate project.</p>
        </div>
        <div class="flex gap-2">
          <button class="desktop-action-button h-9 gap-2 px-3" @click="creating = !creating">
            <FolderPlus :size="16" />
            Create Project
          </button>
          <button class="desktop-action-button h-9 gap-2 px-3" @click="logout">
            <LogOut :size="16" />
            Logout
          </button>
        </div>
      </header>

      <form v-if="creating" class="grid gap-3 border border-ide-border bg-ide-sidebar p-4 md:grid-cols-[1fr_1fr] md:items-end" @submit.prevent="submit">
        <label class="block">
          <span class="mb-1 block text-xs uppercase tracking-wide text-ide-muted">Project name</span>
          <input v-model="form.name" class="h-9 w-full border border-ide-border bg-ide-panel px-3 outline-none focus:border-ide-accent" required />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs uppercase tracking-wide text-ide-muted">Folder name</span>
          <input
            v-model="form.folderName"
            class="h-9 w-full border border-ide-border bg-ide-panel px-3 font-mono outline-none focus:border-ide-accent"
            pattern="[A-Za-z0-9_-]+"
            required
            @blur="normalizeFolderName"
          />
        </label>
        <label class="block md:col-span-2">
          <span class="mb-1 block text-xs uppercase tracking-wide text-ide-muted">Description</span>
          <input v-model="form.description" class="h-9 w-full border border-ide-border bg-ide-panel px-3 outline-none focus:border-ide-accent" />
        </label>
        <button class="h-9 bg-ide-accent px-4 font-medium text-white hover:bg-[#0b86d1] md:col-span-2">Create project</button>
      </form>

      <p v-if="projects.error" class="border border-red-500/40 bg-red-500/10 p-3 text-red-200">{{ projects.error }}</p>

      <section v-if="!projects.loading && projects.projects.length === 0" class="grid min-h-72 place-items-center border border-dashed border-ide-border bg-ide-sidebar/60 text-center">
        <div>
          <h2 class="mb-2 text-lg font-semibold">У вас пока нет проектов</h2>
          <p class="mb-4 text-ide-muted">Создайте первый проект, чтобы начать работу</p>
          <button class="bg-ide-accent px-4 py-2 font-medium text-white hover:bg-[#0b86d1]" @click="creating = true">Создать проект</button>
        </div>
      </section>

      <section v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article v-for="project in projects.projects" :key="project.folderName" class="border border-ide-border bg-ide-sidebar p-4">
          <div class="mb-3">
            <h2 class="truncate text-base font-semibold">{{ project.name }}</h2>
            <p class="truncate font-mono text-xs text-ide-accent">{{ project.folderName }}</p>
          </div>
          <p class="mb-4 min-h-10 text-sm text-ide-muted">{{ project.description || 'No description.' }}</p>
          <div class="mb-4 space-y-1 text-xs text-ide-muted">
            <div>Created: {{ new Date(project.createdAt).toLocaleString() }}</div>
            <div>Active terminals: {{ project.activeTerminalsCount }}</div>
          </div>
          <div class="flex gap-2">
            <button class="h-8 flex-1 bg-ide-accent font-medium text-white hover:bg-[#0b86d1]" @click="projects.openProject(project.folderName)">Open</button>
            <button class="grid h-8 w-9 place-items-center border border-ide-border text-ide-muted hover:border-red-500/60 hover:text-red-200" @click="projects.deleteProject(project.folderName)">
              <Trash2 :size="15" />
            </button>
          </div>
        </article>
      </section>
    </div>
  </main>
</template>
