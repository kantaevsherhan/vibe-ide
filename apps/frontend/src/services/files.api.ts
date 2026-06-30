import { apiRequest } from './api';
import type { FileNode } from '../types/file';

export const filesApi = {
  async tree() {
    return apiRequest<{ tree: FileNode[] }>('/api/files/tree');
  },
  async read(path: string) {
    return apiRequest<{ content: string }>(`/api/files/read?path=${encodeURIComponent(path)}`);
  },
  async write(path: string, content: string) {
    return apiRequest<{ ok: true }>('/api/files/write', {
      method: 'POST',
      body: JSON.stringify({ path, content })
    });
  },
  async createFile(path: string) {
    return apiRequest<{ ok: true }>('/api/files/create-file', {
      method: 'POST',
      body: JSON.stringify({ path })
    });
  },
  async createFolder(path: string) {
    return apiRequest<{ ok: true }>('/api/files/create-folder', {
      method: 'POST',
      body: JSON.stringify({ path })
    });
  },
  async delete(path: string) {
    return apiRequest<{ ok: true }>(`/api/files/delete?path=${encodeURIComponent(path)}`, {
      method: 'DELETE'
    });
  }
};
