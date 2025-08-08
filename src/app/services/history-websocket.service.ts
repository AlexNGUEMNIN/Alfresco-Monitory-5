import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';

export interface ApiHistoryResponse {
  processId: string;
  definitionId: string;
  startTime: number;
  endTime: number;
  status: string;
  deleteReason: string;
  startedByName: string | null;
  startedByEmail: string;
  cancelledByName: string | null;
  cancelledByEmail: string | null;
  cancelledByCompany: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class HistoryWebSocketService {
  private socket: WebSocket | null = null;
  private historyDataSubject = new BehaviorSubject<ApiHistoryResponse[]>([]);
  private connectionStatusSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new Subject<string>();

  public historyData$ = this.historyDataSubject.asObservable();
  public connectionStatus$ = this.connectionStatusSubject.asObservable();
  public error$ = this.errorSubject.asObservable();

  connect(): void {
    try {
      this.socket = new WebSocket('ws://localhost:8082/ws/history');
      
      this.socket.onopen = () => {
        console.log('WebSocket connected to history service');
        this.connectionStatusSubject.next(true);
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (Array.isArray(data)) {
            this.historyDataSubject.next(data);
          } else {
            console.warn('Received non-array data from WebSocket:', data);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          this.errorSubject.next('Erreur lors de l\'analyse des données reçues');
        }
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.errorSubject.next('Erreur de connexion WebSocket');
        this.connectionStatusSubject.next(false);
      };

      this.socket.onclose = () => {
        console.log('WebSocket connection closed');
        this.connectionStatusSubject.next(false);
        // Auto-reconnect after 5 seconds
        setTimeout(() => this.connect(), 5000);
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      this.errorSubject.next('Impossible de se connecter au service d\'historique');
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  getCurrentData(): ApiHistoryResponse[] {
    return this.historyDataSubject.value;
  }
}
