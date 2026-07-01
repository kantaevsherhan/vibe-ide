<script setup lang="ts">
import { DownloadCloud, FolderPlus, LogOut } from '@lucide/vue';
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.store';
import { useProjectsStore } from '../stores/projects.store';
import { useSystemStore } from '../stores/system.store';
import ProjectCard from '../components/projects/ProjectCard.vue';
import DeleteProjectModal from '../components/projects/DeleteProjectModal.vue';
import type { Project } from '../services/projects.api';

const projects = useProjectsStore();
const system = useSystemStore();
const auth = useAuthStore();
const router = useRouter();
const creating = ref(false);
const projectToDelete = ref<Project | null>(null);
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

async function confirmDeleteProject(folderName: string) {
  await projects.deleteProject(folderName);
  projectToDelete.value = null;
}
</script>

<template>
  <main class="min-h-screen overflow-auto bg-ide-main px-5 py-5 text-ide-text thin-scrollbar">
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <header class="flex flex-wrap items-center justify-between gap-3 border-b border-ide-border pb-4">
        <div>
          <h1 class="text-xl font-semibold">VibeIDE Projects</h1>
          <p class="text-sm text-ide-muted">Persistent AI workspaces on your server.</p>
        </div>
        <div class="flex gap-2">
          <button class="desktop-action-button h-9 gap-2 px-3" :disabled="system.loading" @click="system.checkUpdate">
            <DownloadCloud :size="16" />
            {{ system.buttonLabel }}
          </button>
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

      <section v-if="system.logs.length > 0 || system.message" class="border border-ide-border bg-ide-sidebar p-3">
        <div class="mb-2 flex items-center justify-between gap-3">
          <span class="text-xs uppercase tracking-wide text-ide-muted">Manual Update</span>
          <span class="text-xs" :class="system.status === 'failed' ? 'text-red-300' : system.status === 'updated' ? 'text-green-300' : 'text-ide-muted'">
            {{ system.message }}
          </span>
        </div>
        <pre class="max-h-40 overflow-auto whitespace-pre-wrap bg-[#181818] p-3 font-mono text-[11px] leading-5 text-ide-text thin-scrollbar">{{ system.logs.join('\n') }}</pre>
      </section>

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
        <button class="h-9 bg-ide-accent px-4 font-medium text-white hover:bg-[#0b86d1] md:col-span-2">Create Project</button>
      </form>

      <p v-if="projects.error" class="border border-red-500/40 bg-red-500/10 p-3 text-red-200">{{ projects.error }}</p>

      <section v-if="!projects.loading && projects.projects.length === 0" class="grid min-h-72 place-items-center border border-dashed border-ide-border bg-ide-sidebar/60 text-center">
        <div>
          <h2 class="mb-2 text-lg font-semibold">You do not have any projects yet</h2>
          <p class="mb-4 text-ide-muted">Create your first project to start working with VibeIDE.</p>
          <button class="bg-ide-accent px-4 py-2 font-medium text-white hover:bg-[#0b86d1]" @click="creating = true">Create Project</button>
        </div>
      </section>

      <section v-else class="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ProjectCard
          v-for="project in projects.projects"
          :key="project.folderName"
          :project="project"
          @open="projects.openProject"
          @delete="projectToDelete = $event"
        />
      </section>
    </div>
    <DeleteProjectModal
      :project="projectToDelete"
      @close="projectToDelete = null"
      @confirm="confirmDeleteProject"
    />
  </main>
</template>
