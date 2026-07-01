<script setup lang="ts">
import { DownloadCloud, FolderPlus, LogOut } from '@lucide/vue';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.store';
import { useProjectsStore } from '../stores/projects.store';
import { useSystemStore } from '../stores/system.store';
import ProjectCard from '../components/projects/ProjectCard.vue';
import DeleteProjectModal from '../components/projects/DeleteProjectModal.vue';
import CreateProjectModal from '../components/projects/CreateProjectModal.vue';
import type { CreateProjectInput, Project } from '../services/projects.api';

const projects = useProjectsStore();
const system = useSystemStore();
const auth = useAuthStore();
const router = useRouter();
const creating = ref(false);
const creatingProject = ref(false);
const projectToDelete = ref<Project | null>(null);
const searchQuery = ref('');

onMounted(() => {
  void projects.loadProjects();
});

const filteredProjects = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return projects.projects;
  return projects.projects.filter((project) => project.name.toLowerCase().includes(query));
});

async function createProject(input: CreateProjectInput) {
  creatingProject.value = true;
  try {
    const project = await projects.createProject(input);
    creating.value = false;
    await projects.openProject(project.folderName);
  } finally {
    creatingProject.value = false;
  }
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
          <button class="desktop-action-button h-9 gap-2 px-3" @click="creating = true">
            <FolderPlus :size="16" />
            Add Project
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

      <label class="block">
        <span class="mb-1 block text-xs uppercase tracking-wide text-ide-muted">Search Projects</span>
        <input
          v-model="searchQuery"
          class="h-9 w-full border border-ide-border bg-ide-panel px-3 outline-none focus:border-ide-accent"
          placeholder="Search Projects..."
        />
      </label>

      <p v-if="projects.error" class="border border-red-500/40 bg-red-500/10 p-3 text-red-200">{{ projects.error }}</p>

      <section v-if="!projects.loading && projects.projects.length === 0" class="grid min-h-72 place-items-center border border-dashed border-ide-border bg-ide-sidebar/60 text-center">
        <div>
          <h2 class="mb-2 text-lg font-semibold">You do not have any projects yet</h2>
          <p class="mb-4 text-ide-muted">Create your first project to start working with VibeIDE.</p>
          <button class="bg-ide-accent px-4 py-2 font-medium text-white hover:bg-[#0b86d1]" @click="creating = true">Create Project</button>
        </div>
      </section>

      <section v-else-if="filteredProjects.length === 0" class="grid min-h-56 place-items-center border border-dashed border-ide-border bg-ide-sidebar/60 text-center text-ide-muted">
        No projects match your search.
      </section>

      <section v-else class="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ProjectCard
          v-for="project in filteredProjects"
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
    <CreateProjectModal
      :open="creating"
      :loading="creatingProject"
      :error="projects.error"
      @close="creating = false"
      @create="createProject"
    />
  </main>
</template>
