export interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  totalProcesses: number;
  longRunningProcesses: number;
  failedProcessesWithExceptions: number;
  processesWithoutTasks: number;
  initiatorOnlyProcesses: number;
  [key: string]: number; // for future extensibility
}

export interface ProcessStatusCount {
  status: string;
  count: number;
  percentage: number;
}