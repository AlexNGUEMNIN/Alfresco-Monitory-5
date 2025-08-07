// system-stats.service.ts

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {ProcessStatusCount, SystemStats} from "../models/system-stats.model";
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SystemStatsService {
  constructor(private http: HttpClient) {}

  getSystemStats(): Observable<SystemStats> {
    return this.http.get<SystemStats>(`${environment.api2Url}/system/stats`);
  }

  getThresholds(): Observable<{ thresholdDays: number; process_thresholdDays: number }> {
    return this.http.get<{ thresholdDays: number; process_thresholdDays: number }>(
        `${environment.api2Url}/config/thresholds`
    );
  }

  updateThresholds(inactivityDays: number, processDays: number): Observable<string> {
    return this.http.put(
        `${environment.api2Url}/config/thresholds`,
        null,
        {
          params: { inactivityDays, processDays },
          responseType: 'text'
        }
    );
  }
}

