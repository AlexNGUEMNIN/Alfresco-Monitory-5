import { Component, OnInit, OnDestroy } from '@angular/core';
import { WebSocketSubject } from 'rxjs/webSocket';
import { ProcessStatus } from '../../core/models/process.model';
import {MatProgressSpinner} from "@angular/material/progress-spinner";
import {DatePipe, NgIf} from "@angular/common";
import { environment } from '../../../environments/environment';

interface ProcessStatusData {
  timestamp: number;
  totalProcesses: number;
  statusCounts: {
    actif: number;
    suspendu: number;
    terminé: number;
    job_exceptions: number;
  };
  statusDetails: {
    status: string;
    label: string;
    count: number;
    percentage: number;
  }[];
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  standalone: true,
  imports: [
    MatProgressSpinner,
    DatePipe,
    NgIf,
  ],
  styleUrls: ['./dashboard.component.scss'],
  providers: [DatePipe]
})
export class DashboardComponent implements OnInit, OnDestroy {
  private socket$!: WebSocketSubject<ProcessStatusData>;
  processData: ProcessStatusData | null = null;
  loading = true;
  lastUpdated: Date | null = null;

  ngOnInit(): void {
    this.connectWebSocket();
  }

  ngOnDestroy(): void {
    this.socket$.complete();
  }

  private connectWebSocket(): void {
    const wsUrl = `${environment.websocket2Url}/process-status`;
    this.socket$ = new WebSocketSubject(wsUrl);

    this.socket$.subscribe({
      next: (data) => {
        this.processData = data;
        this.lastUpdated = new Date(data.timestamp);
        this.loading = false;
      },
      error: (err) => {
        console.error('WebSocket error:', err);
        this.loading = false;
        // Implement reconnect logic here if needed
      },
      complete: () => console.log('WebSocket connection closed')
    });
  }

  // dashboard.component.ts
  getStatusCount(status: ProcessStatus): number {
    return this.processData?.statusCounts[status] || 0;
  }

  getStatusPercentage(status: ProcessStatus): number {
    if (!this.processData) return 0;
    const detail = this.processData.statusDetails.find(d => d.status === status);
    return detail?.percentage || 0;
  }

  getTrendIcon(status: ProcessStatus): string {
    // Implement your actual trend logic here
    return 'trending_up';
  }
}