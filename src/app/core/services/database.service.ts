import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { DatabaseMetric, DatabaseTable, SlowQuery, TableGrowthData } from '../models/database.model';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  // Mock data - would be replaced with actual API calls
  private mockTables: DatabaseTable[] = [
    {
      name: 'ACT_RU_VARIABLE',
      size: 245.8,
      rows: 125870,
      growth: 12.5,
      lastUpdated: new Date('2025-04-12T08:15:00'),
      status: 'warning'
    },
    {
      name: 'ACT_HI_VARINST',
      size: 528.3,
      rows: 267490,
      growth: 8.2,
      lastUpdated: new Date('2025-04-12T08:15:00'),
      status: 'critical'
    },
    {
      name: 'ACT_RU_TASK',
      size: 89.4,
      rows: 34682,
      growth: 3.7,
      lastUpdated: new Date('2025-04-12T08:15:00'),
      status: 'normal'
    },
    {
      name: 'ACT_HI_PROCINST',
      size: 156.2,
      rows: 75321,
      growth: 5.1,
      lastUpdated: new Date('2025-04-12T08:15:00'),
      status: 'normal'
    },
    {
      name: 'ACT_RU_EXECUTION',
      size: 78.5,
      rows: 42867,
      growth: 4.3,
      lastUpdated: new Date('2025-04-12T08:15:00'),
      status: 'normal'
    }
  ];

  private mockMetrics: DatabaseMetric[] = [
    {
      name: 'Database Size',
      value: 1256.4,
      unit: 'MB',
      trend: 7.8,
      status: 'warning'
    },
    {
      name: 'Total Rows',
      value: 546230,
      unit: '',
      trend: 6.2,
      status: 'normal'
    },
    {
      name: 'Avg. Query Time',
      value: 145.3,
      unit: 'ms',
      trend: 12.5,
      status: 'critical'
    },
    {
      name: 'Connections',
      value: 28,
      unit: '',
      trend: 0,
      status: 'normal'
    }
  ];

  private mockGrowthData: TableGrowthData = {
    table: 'Database Growth',
    series: [
      {
        name: 'ACT_RU_VARIABLE',
        series: [
          { name: new Date('2025-04-06'), value: 210.5 },
          { name: new Date('2025-04-07'), value: 215.8 },
          { name: new Date('2025-04-08'), value: 223.1 },
          { name: new Date('2025-04-09'), value: 228.7 },
          { name: new Date('2025-04-10'), value: 233.2 },
          { name: new Date('2025-04-11'), value: 238.9 },
          { name: new Date('2025-04-12'), value: 245.8 }
        ]
      },
      {
        name: 'ACT_HI_VARINST',
        series: [
          { name: new Date('2025-04-06'), value: 475.2 },
          { name: new Date('2025-04-07'), value: 484.7 },
          { name: new Date('2025-04-08'), value: 492.1 },
          { name: new Date('2025-04-09'), value: 501.8 },
          { name: new Date('2025-04-10'), value: 509.4 },
          { name: new Date('2025-04-11'), value: 518.9 },
          { name: new Date('2025-04-12'), value: 528.3 }
        ]
      }
    ]
  };

  private mockSlowQueries: SlowQuery[] = [
    {
      id: 'Q1',
      query: 'SELECT * FROM ACT_HI_VARINST WHERE PROC_INST_ID_ IN (SELECT ID_ FROM ACT_HI_PROCINST WHERE END_TIME_ IS NULL)',
      avgExecutionTime: 2345,
      executions: 156,
      lastExecuted: new Date('2025-04-12T07:45:23'),
      status: 'critical'
    },
    {
      id: 'Q2',
      query: 'SELECT COUNT(*) FROM ACT_RU_VARIABLE GROUP BY PROC_INST_ID_',
      avgExecutionTime: 1256,
      executions: 278,
      lastExecuted: new Date('2025-04-12T08:12:09'),
      status: 'warning'
    },
    {
      id: 'Q3',
      query: 'SELECT * FROM ACT_RU_TASK WHERE ASSIGNEE_ IS NULL',
      avgExecutionTime: 578,
      executions: 342,
      lastExecuted: new Date('2025-04-12T08:05:47'),
      status: 'normal'
    }
  ];

  constructor() { }

  getTables(): Observable<DatabaseTable[]> {
    return of(this.mockTables).pipe(delay(400));
  }

  getMetrics(): Observable<DatabaseMetric[]> {
    return of(this.mockMetrics).pipe(delay(300));
  }

  getTableGrowthData(): Observable<TableGrowthData> {
    return of(this.mockGrowthData).pipe(delay(500));
  }

  getSlowQueries(): Observable<SlowQuery[]> {
    return of(this.mockSlowQueries).pipe(delay(350));
  }

  optimizeTable(tableName: string): Observable<boolean> {
    // This would call an API to optimize the table
    console.log(`Optimizing table: ${tableName}`);
    return of(true).pipe(delay(1500));
  }
}