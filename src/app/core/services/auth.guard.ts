import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean {
    if (this.authService.isLoggedIn()) {
      const decoded = this.authService.getDecodedToken();
      if (decoded && !this.isTokenExpired(decoded)) {
        return true;
      }
    }

    this.authService.logout();
    this.router.navigate(['/login']);
    return false;
  }

  private isTokenExpired(decodedToken: any): boolean {
    const exp = decodedToken?.exp;
    if (!exp) return true;
    const now = Math.floor(Date.now() / 1000);
    return exp < now;
  }
}
