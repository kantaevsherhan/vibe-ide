import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { projectsApi, type CreateProjectInput, type Project } from '../services/projects.api';

export const useProjectsStore = defineStore('projects', () => {
  const projects = ref<Project[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const router = useRouter();

  async function loadProjects() {
    loading.value = true;
    error.value = null;
    try {
      projects.value = (await projectsApi.list()).projects;
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Failed to load projects.';
    } finally {
      loading.value = false;
    }
  }

  async function createProject(input: CreateProjectInput) {
    const project = (await projectsApi.create(input)).project;
    projects.value = [project, ...projects.value];
    return project;
  }

  async function deleteProject(projectName: string) {
    await projectsApi.delete(projectName);
    projects.value = projects.value.filter((project) => project.folderName !== projectName);
  }

  async function openProject(projectName: string) {
    await router.push(`/ide/${encodeURIComponent(projectName)}`);
  }

  return { projects, loading, error, loadProjects, createProject, deleteProject, openProject };
});
