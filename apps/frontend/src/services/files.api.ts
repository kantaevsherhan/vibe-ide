import { apiRequest } from './api';
import type { FileNode } from '../types/file';

export const filesApi = {
  async tree(projectName: string) {
    return apiRequest<{ tree: FileNode[] }>(`/api/files/tree?projectName=${encodeURIComponent(projectName)}`);
  },
  async read(projectName: string, path: string) {
    return apiRequest<{ content: string }>(
      `/api/files/read?projectName=${encodeURIComponent(projectName)}&path=${encodeURIComponent(path)}`
    );
  },
  async write(projectName: string, path: string, content: string) {
    return apiRequest<{ ok: true }>('/api/files/write', {
      method: 'POST',
      body: JSON.stringify({ projectName, path, content })
    });
  },
  async createFile(projectName: string, path: string) {
    return apiRequest<{ ok: true }>('/api/files/create-file', {
      method: 'POST',
      body: JSON.stringify({ projectName, path })
    });
  },
  async createFolder(projectName: string, path: string) {
    return apiRequest<{ ok: true }>('/api/files/create-folder', {
      method: 'POST',
      body: JSON.stringify({ projectName, path })
    });
  },
  async delete(projectName: string, path: string) {
    return apiRequest<{ ok: true }>(
      `/api/files/delete?projectName=${encodeURIComponent(projectName)}&path=${encodeURIComponent(path)}`,
      {
        method: 'DELETE'
      }
    );
  }
};
