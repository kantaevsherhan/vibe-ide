import type { NoteNode, NotesChildrenResponse, NotesSearchResult } from '../types/notes';
import { apiRequest } from './api';

export const notesApi = {
  tree(projectName: string, path = '') {
    return apiRequest<NotesChildrenResponse>(`/api/notes/tree?projectName=${encodeURIComponent(projectName)}&path=${encodeURIComponent(path)}`);
  },
  read(projectName: string, path: string) {
    return apiRequest<{ content: string }>(`/api/notes/file?projectName=${encodeURIComponent(projectName)}&path=${encodeURIComponent(path)}`);
  },
  createFile(projectName: string, path: string, content = '') {
    return apiRequest<{ ok: true }>('/api/notes/file', {
      method: 'POST',
      body: JSON.stringify({ projectName, path, content })
    });
  },
  write(projectName: string, path: string, content: string) {
    return apiRequest<{ ok: true }>('/api/notes/file', {
      method: 'PUT',
      body: JSON.stringify({ projectName, path, content })
    });
  },
  delete(projectName: string, path: string) {
    return apiRequest<{ ok: true }>(`/api/notes/file?projectName=${encodeURIComponent(projectName)}&path=${encodeURIComponent(path)}`, {
      method: 'DELETE'
    });
  },
  createFolder(projectName: string, path: string) {
    return apiRequest<{ ok: true }>('/api/notes/folder', {
      method: 'POST',
      body: JSON.stringify({ projectName, path })
    });
  },
  rename(projectName: string, from: string, to: string) {
    return apiRequest<{ ok: true }>('/api/notes/rename', {
      method: 'PUT',
      body: JSON.stringify({ projectName, from, to })
    });
  },
  duplicate(projectName: string, from: string, to: string) {
    return apiRequest<{ ok: true }>('/api/notes/duplicate', {
      method: 'POST',
      body: JSON.stringify({ projectName, from, to })
    });
  },
  search(projectName: string, query: string) {
    return apiRequest<{ results: NotesSearchResult[] }>(`/api/notes/search?projectName=${encodeURIComponent(projectName)}&query=${encodeURIComponent(query)}`);
  }
};
