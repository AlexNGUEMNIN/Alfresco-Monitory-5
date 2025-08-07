export interface Process {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'abandoned' | 'terminated';
  startDate: Date;
  lastActivity: Date;
  variables?: ProcessVariable[];
  steps?: ProcessStep[];
}

export interface ProcessVariable {
  name: string;
  value: any;
  type: string;
}

export interface ProcessStep {
  id: string;
  name: string;
  status: 'completed' | 'active' | 'error';
  startTime: Date;
  endTime?: Date;
  error?: string;
}

export interface ProcessFilter {
  status?: 'active' | 'abandoned' | 'terminated';
  type?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchTerm?: string;
}

export interface ProcessStatistics {
  active: number;
  abandoned: number;
  terminated: number;
  total: number;
  abandonedTrend: TrendPoint[];
}

export interface TrendPoint {
  date: Date;
  value: number;
}

export interface ProcessData {
  processInstanceId: string;
  processDefinitionId: string;
  processStartTime: Date;
  processInitiator: string;
}

// process.model.ts
export type ProcessStatus = 'actif' | 'suspendu' | 'terminé' | 'job_exceptions';

export interface StatusDetail {
  status: ProcessStatus;
  label: string;
  count: number;
  percentage: number;
}

export interface ProcessStatusData {
  timestamp: number;
  totalProcesses: number;
  statusCounts: Record<ProcessStatus, number>;
  statusDetails: StatusDetail[];
}