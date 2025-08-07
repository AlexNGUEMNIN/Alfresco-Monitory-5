import { Injectable } from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpHeaders} from '@angular/common/http';
import {Observable, catchError, throwError, of, switchMap} from 'rxjs';
import { User } from '../models/user.model';
import {TaskAssignment} from "../models/task.model";
import {map} from "rxjs/operators";
import {AuthService} from "./auth.service";  // Fixed import path (changed from task.model)
import { environment } from '../../../environments/environment'; // <-- Import environment

@Injectable({ providedIn: 'root' })
export class TasksService {
    private readonly apiUrl = `${environment.api2Url}/users`;  // Use environment variable

    constructor(private http: HttpClient,private authService: AuthService) { }

    getUsers(): Observable<User[]> {
        const token = this.authService.accessToken;
        if (!token) return throwError(() => new Error('No access token found'));

        const headers = new HttpHeaders({
            Authorization: `Bearer ${token}`
        });

        return this.http.get<User[]>(this.apiUrl, { headers }).pipe(
            catchError(this.handleError)
        );
    }

    private handleError(error: HttpErrorResponse): Observable<never> {
        let errorMessage = 'An unknown error occurred!';

        if (error.error instanceof ErrorEvent) {
            // Client-side error
            errorMessage = `Error: ${error.error.message}`;
        } else {
            // Server-side error
            errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;

            // You can add more specific error messages based on status code
            if (error.status === 404) {
                errorMessage = 'Resource not found';
            } else if (error.status === 403) {
                errorMessage = 'Access forbidden';
            }
        }

        console.error(errorMessage);
        return throwError(() => new Error(errorMessage));
    }

    SuspendProcess(processId: string, originalInitiatorId: string): Observable<boolean> {
        const headers = new HttpHeaders({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authService.accessToken}`
        });

        const originalInitiatorKey = `proc_initiator_${processId}`;
        const suspendUrl = `${environment.BASE_URL}/activiti-app/api/enterprise/process-instances/${processId}/suspend`;

        return this.http.get<{ id: number }>(`${environment.api2Url}/current-user`, { headers }).pipe(
            switchMap(currentUser => {
                const currentUserId = currentUser.id;

                // Save original initiator in localStorage
                localStorage.setItem(originalInitiatorKey, originalInitiatorId);

                // Step 1: Update initiator to current user
                const updateInitiatorUrl = `${environment.api2Url}/procinst/update-start-user?id=${processId}&startUserId=${currentUserId}`;
                return this.http.put(updateInitiatorUrl, null, { headers }).pipe(
                    switchMap(() => {
                        // Step 2: Suspend the process
                        return this.http.put(suspendUrl, null, { headers, observe: 'response' }).pipe(
                            switchMap(response => {
                                if (response.status === 200) {
                                    // Step 3: Wait before restoring
                                    return new Observable<boolean>(observer => {
                                        setTimeout(() => {
                                            const storedInitiator = localStorage.getItem(originalInitiatorKey);

                                            if (storedInitiator) {
                                                const restoreUrl = `${environment.api2Url}/procinst/update-start-user?id=${processId}&startUserId=${storedInitiator}`;
                                                this.http.put(restoreUrl, null, { headers }).subscribe({
                                                    next: () => {
                                                        console.log('✅ Original initiator restored.');
                                                        localStorage.removeItem(originalInitiatorKey);
                                                        observer.next(true);
                                                        observer.complete();
                                                    },
                                                    error: err => {
                                                        console.error('❌ Failed to restore original initiator:', err);
                                                        observer.next(false);
                                                        observer.complete();
                                                    }
                                                });
                                            } else {
                                                console.warn('⚠️ Original initiator not found in localStorage.');
                                                observer.next(false);
                                                observer.complete();
                                            }
                                        }, 1000); // 1 second delay
                                    });
                                } else {
                                    return of(false);
                                }
                            }),
                            catchError(err => {
                                console.error('❌ Error suspending process:', err);
                                return of(false);
                            })
                        );
                    }),
                    catchError(err => {
                        console.error('❌ Error updating start user before suspend:', err);
                        return of(false);
                    })
                );
            }),
            catchError(err => {
                console.error('❌ Error fetching current user:', err);
                return of(false);
            })
        );
    }

    ResumeProcess(processId: string, originalInitiatorId: string): Observable<boolean> {
        const headers = new HttpHeaders({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authService.accessToken}`
        });

        const originalInitiatorKey = `proc_initiator_${processId}`;
        const resumeUrl = `${environment.BASE_URL}/activiti-app/api/enterprise/process-instances/${processId}/activate`;

        return this.http.get<{ id: number }>(`${environment.api2Url}/current-user`, { headers }).pipe(
            switchMap(currentUser => {
                const currentUserId = currentUser.id;

                // Save original initiator in localStorage
                localStorage.setItem(originalInitiatorKey, originalInitiatorId);

                // Step 1: Update initiator to current user
                const updateInitiatorUrl = `${environment.api2Url}/procinst/update-start-user?id=${processId}&startUserId=${currentUserId}`;
                return this.http.put(updateInitiatorUrl, null, { headers }).pipe(
                    switchMap(() => {
                        // Step 2: Resume the process
                        return this.http.put(resumeUrl, null, { headers, observe: 'response' }).pipe(
                            switchMap(response => {
                                if (response.status === 200) {
                                    // Step 3: Wait before restoring original initiator
                                    return new Observable<boolean>(observer => {
                                        setTimeout(() => {
                                            const storedInitiator = localStorage.getItem(originalInitiatorKey);

                                            if (storedInitiator) {
                                                const restoreUrl = `${environment.api2Url}/procinst/update-start-user?id=${processId}&startUserId=${storedInitiator}`;
                                                this.http.put(restoreUrl, null, { headers }).subscribe({
                                                    next: () => {
                                                        console.log('✅ Original initiator restored.');
                                                        localStorage.removeItem(originalInitiatorKey);
                                                        observer.next(true);
                                                        observer.complete();
                                                    },
                                                    error: err => {
                                                        console.error('❌ Failed to restore original initiator:', err);
                                                        observer.next(false);
                                                        observer.complete();
                                                    }
                                                });
                                            } else {
                                                console.warn('⚠️ Original initiator not found in localStorage.');
                                                observer.next(false);
                                                observer.complete();
                                            }
                                        }, 1000); // Delay before restoring initiator
                                    });
                                } else {
                                    return of(false);
                                }
                            }),
                            catchError(err => {
                                console.error('❌ Error resuming process:', err);
                                return of(false);
                            })
                        );
                    }),
                    catchError(err => {
                        console.error('❌ Error updating start user before resume:', err);
                        return of(false);
                    })
                );
            }),
            catchError(err => {
                console.error('❌ Error fetching current user:', err);
                return of(false);
            })
        );
    }

    TerminateProcess(processId: string, originalInitiatorId: string): Observable<boolean> {
        const headers = new HttpHeaders({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authService.accessToken}`
        });

        const originalInitiatorKey = `proc_initiator_${processId}`;
        const terminateUrl = `${environment.BASE_URL}/activiti-app/api/enterprise/process-instances/${processId}`;

        return this.http.get<{ id: number }>(`${environment.api2Url}/current-user`, { headers }).pipe(
            switchMap(currentUser => {
                const currentUserId = currentUser.id;

                // Save original initiator in localStorage
                localStorage.setItem(originalInitiatorKey, originalInitiatorId);

                // Step 1: Update initiator to current user
                const updateInitiatorUrl = `${environment.api2Url}/procinst/update-start-user?id=${processId}&startUserId=${currentUserId}`;
                return this.http.put(updateInitiatorUrl, null, { headers }).pipe(
                    switchMap(() => {
                        // Step 2: Terminate the process
                        return this.http.delete(terminateUrl, { headers, observe: 'response' }).pipe(
                            switchMap(response => {
                                if (response.status === 200 || response.status === 204) {
                                    // Step 3: Wait before restoring
                                    return new Observable<boolean>(observer => {
                                        setTimeout(() => {
                                            const storedInitiator = localStorage.getItem(originalInitiatorKey);

                                            if (storedInitiator) {
                                                const restoreUrl = `${environment.api2Url}/procinst/update-start-user?id=${processId}&startUserId=${storedInitiator}`;
                                                this.http.put(restoreUrl, null, { headers }).subscribe({
                                                    next: () => {
                                                        console.log('✅ Original initiator restored.');
                                                        localStorage.removeItem(originalInitiatorKey);
                                                        observer.next(true);
                                                        observer.complete();
                                                    },
                                                    error: err => {
                                                        console.error('❌ Failed to restore original initiator:', err);
                                                        observer.next(true); // Process is terminated, so still return true
                                                        observer.complete();
                                                    }
                                                });
                                            } else {
                                                console.warn('⚠️ Original initiator not found in localStorage.');
                                                observer.next(true);
                                                observer.complete();
                                            }
                                        }, 1000); // 1 second delay
                                    });
                                } else {
                                    return of(false);
                                }
                            }),
                            catchError(err => {
                                console.error('❌ Error terminating process:', err);
                                return of(false);
                            })
                        );
                    }),
                    catchError(err => {
                        console.error('❌ Error updating start user before terminate:', err);
                        return of(false);
                    })
                );
            }),
            catchError(err => {
                console.error('❌ Error fetching current user:', err);
                return of(false);
            })
        );
    }
}