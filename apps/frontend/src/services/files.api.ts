import { apiRequest } from './api';
import type { FileNode, FolderChildrenResponse } from '../types/file';

export const filesApi = {
  async tree(projectName: string) {
    return apiRequest<{ tree: FileNode[] }>(`/api/files/tree?projectName=${encodeURIComponent(projectName)}`);
  },
  async children(projectName: string, path = '', force = false) {
    return apiRequest<FolderChildrenResponse>(
      `/api/files/children?projectName=${encodeURIComponent(projectName)}&path=${encodeURIComponent(path)}&force=${force}`
    );
  },
  async read(projectName: string, path: string, force = false) {
    return apiRequest<{ content: string }>(
      `/api/files/read?projectName=${encodeURIComponent(projectName)}&path=${encodeURIComponent(path)}&force=${force}`
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
  },
  async rename(projectName: string, from: string, to: string) {
    return apiRequest<{ ok: true }>('/api/files/rename', {
      method: 'PUT',
      body: JSON.stringify({ projectName, from, to })
    });
  },
  async duplicate(projectName: string, from: string, to: string) {
    return apiRequest<{ ok: true }>('/api/files/duplicate', {
      method: 'POST',
      body: JSON.stringify({ projectName, from, to })
    });
  },
  async search(projectName: string, query: string) {
    return apiRequest<{ results: FileNode[] }>(`/api/files/search?projectName=${encodeURIComponent(projectName)}&query=${encodeURIComponent(query)}`);
  }
};
