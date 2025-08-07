export interface DatabaseTable {
  name: string;
  size: number; // in MB
  rows: number;
  growth: number; // percentage
  lastUpdated: Date;
  status: 'normal' | 'warning' | 'critical';
}

export interface DatabaseMetric {
  name: string;
  value: number;
  unit: string;
  trend: number; // percentage change
  status: 'normal' | 'warning' | 'critical';
}

export interface TableGrowthData {
  table: string;
  series: {
    name: string;
    series: {
      name: Date;
      value: number;
    }[];
  }[];
}

export interface SlowQuery {
  id: string;
  query: string;
  avgExecutionTime: number; // in ms
  executions: number;
  lastExecuted: Date;
  status: 'normal' | 'warning' | 'critical';
}