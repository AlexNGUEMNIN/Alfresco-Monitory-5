import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { environment } from '../../../environments/environment';

export interface FailureData {
  procInstId: string;
  processName: string;
  startTime: string;
  startUserId: string;
  startUserName: string | null;
  instanceName: string;
  email: string;
  company: string | null;
  endTime: string | null;
  exceptionMsg: string;
  jobType: string;
  deploymentId: string;
  deploymentName: string;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private socket$: WebSocketSubject<any> | null = null;
  private failures$ = new BehaviorSubject<FailureData[]>([]);
  private connectionStatus$ = new BehaviorSubject<boolean>(false);

  constructor() {
    this.connect();
  }

  private connect(): void {
    try {
      this.socket$ = webSocket({
        url: `${environment.websocket2Url}/failures`,
        openObserver: {
          next: () => {
            console.log('WebSocket connection opened');
            this.connectionStatus$.next(true);
          }
        },
        closeObserver: {
          next: () => {
            console.log('WebSocket connection closed');
            this.connectionStatus$.next(false);
            // Attempt to reconnect after 5 seconds
            setTimeout(() => this.connect(), 5000);
          }
        }
      });

      this.socket$.subscribe({
        next: (data: FailureData[]) => {
          console.log('Received failures data:', data);
          this.failures$.next(data);
        },
        error: (error) => {
          console.error('WebSocket error:', error);
          this.connectionStatus$.next(false);
          // Attempt to reconnect after 5 seconds
          setTimeout(() => this.connect(), 5000);
        }
      });
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      this.connectionStatus$.next(false);
    }
  }

  getFailures(): Observable<FailureData[]> {
    return this.failures$.asObservable();
  }

  getConnectionStatus(): Observable<boolean> {
    return this.connectionStatus$.asObservable();
  }

  disconnect(): void {
    if (this.socket$) {
      this.socket$.complete();
      this.socket$ = null;
    }
    this.connectionStatus$.next(false);
  }
}
