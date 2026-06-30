export type GitFileStatus = {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed' | 'unknown';
  raw: string;
};

export type GitStatusResponse = {
  isRepository: boolean;
  message?: string;
  files: GitFileStatus[];
};
