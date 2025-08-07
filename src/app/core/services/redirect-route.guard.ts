import { Injectable } from "@angular/core";
import { CanActivate, Router } from "@angular/router";

@Injectable({ providedIn: "root" })
export class RedirectRouteGuard implements CanActivate {
  constructor(private router: Router) {}
  canActivate(): boolean {
    const token = localStorage.getItem("auth_token");
    if (token) {
      this.router.navigate(["/dashboard"]);
      return false;
    }
    return true;
  }
}
