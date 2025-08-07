import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { map, catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';
import { environment } from '../../../environments/environment';

interface TokenResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
    private tokenExpiryTimer?: any;
    private currentUserSubject = new BehaviorSubject<TokenResponse | null>(null);

    constructor(private http: HttpClient, private router: Router) {
        const saved = localStorage.getItem('auth_tokens');
        if (saved) this.currentUserSubject.next(JSON.parse(saved));
    }

    login(username: string, password: string): Observable<TokenResponse> {
        const loginPayload = { username, password };

        return this.http
            .post<TokenResponse>(`${environment.api2Url}/users/login`, loginPayload)
            .pipe(
                map(tokens => {
                    this.storeTokens(tokens);
                    this.scheduleRefresh(tokens.expires_in);
                    return tokens;
                }),
                catchError((err: HttpErrorResponse) => throwError(() => err))
            );
    }

    logout() {
        const current = this.currentUserSubject.value;
        if (!current) {
            this.clearSession();
            return;
        }

        const body = { refreshToken: current.refresh_token };

        this.http.post(`${environment.api2Url}/users/logout`, body).subscribe({
            next: () => {
                this.clearSession();
                this.router.navigate(['/login']);
            },
            error: err => {
                console.error('Logout API failed:', err);
                this.clearSession();
                this.router.navigate(['/login']);
            }
        });
    }

    get accessToken(): string | null {
        return this.currentUserSubject.value?.access_token ?? null;
    }

    private clearSession() {
        localStorage.removeItem('auth_tokens');
        this.currentUserSubject.next(null);
        clearTimeout(this.tokenExpiryTimer);
    }

    private storeTokens(tokens: TokenResponse) {
        localStorage.setItem('auth_tokens', JSON.stringify(tokens));
        this.currentUserSubject.next(tokens);
    }

    private scheduleRefresh(expiresInSec: number) {
        if (this.tokenExpiryTimer) clearTimeout(this.tokenExpiryTimer);
        const refreshTime = (expiresInSec - 60) * 1000;
        // Example logic to refresh token automatically before expiration
        // this.tokenExpiryTimer = setTimeout(() => this.refreshToken().subscribe(), refreshTime);
    }

    isLoggedIn(): boolean {
        return !!this.currentUserSubject.value?.access_token;
    }

    getDecodedToken(): any | null {
        const accessToken = this.accessToken;
        if (!accessToken) return null;
        try {
            return jwtDecode(accessToken);
        } catch (e) {
            return null;
        }
    }

    // If needed in future:
    // private refreshToken(): Observable<TokenResponse> {
    //   ...
    // }
}
