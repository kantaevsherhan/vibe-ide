export type NoteNode = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  hasChildren?: boolean;
};

export type NotesChildrenResponse = {
  path: string;
  items: NoteNode[];
};

export type NotesSearchResult = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  match: 'name' | 'content';
  excerpt?: string;
};
