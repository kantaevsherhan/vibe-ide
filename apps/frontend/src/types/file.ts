export type FileNode = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  isIgnored: boolean;
  isBinary?: boolean;
  size?: number;
  hasChildren?: boolean;
};

export type FolderChildrenResponse = {
  path: string;
  items: FileNode[];
  limited: boolean;
  total?: number;
  message?: string;
};

export type OpenFile = {
  id: string;
  path?: string;
  name: string;
  content?: string;
  savedContent?: string;
  kind: 'file' | 'note' | 'agent';
  agentId?: string;
};
