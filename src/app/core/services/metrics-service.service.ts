import { Injectable } from '@angular/core';
import { webSocket } from 'rxjs/webSocket';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MetricsService {
  private socket$ = webSocket<any>('ws://localhost:8082/ws/resource');

  getMetrics(): Observable<any> {
    return this.socket$;
  }
}
