export type FileNode = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
};

export type OpenFile = {
  path: string;
  name: string;
  content: string;
  savedContent: string;
};
