export type NoteNodeType = 'file' | 'directory';

export interface NoteNodeDto {
  name: string;
  path: string;
  type: NoteNodeType;
  size?: number;
  hasChildren?: boolean;
}

export interface NotesChildrenResponse {
  path: string;
  items: NoteNodeDto[];
}

export interface NotesSearchResult {
  name: string;
  path: string;
  type: NoteNodeType;
  match: 'name' | 'content';
  excerpt?: string;
}
