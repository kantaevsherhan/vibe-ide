export type Project = {
  name: string;
  folderName: string;
  description?: string;
  location: string;
  createdAt: string;
  updatedAt: string;
  activeTerminalsCount: number;
  runtime: {
    activeTerminals: number;
    runningAgents: number;
    activeTasks: number;
  };
  health: {
    gitChangedFiles: number;
    gitClean: boolean;
    gitBranch?: string | null;
    terminalStatus: 'inactive' | 'active';
    agentStatus: 'idle' | 'running' | 'waiting' | 'error';
  };
};

export type ProjectMetadata = Pick<Project, 'name' | 'folderName' | 'description' | 'createdAt' | 'updatedAt'>;

export type CreateProjectInput = {
  name: string;
  folderName: string;
  description?: string;
};
