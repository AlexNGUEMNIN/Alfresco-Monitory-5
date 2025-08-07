
import { Component, importProvidersFrom } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { HeaderComponent } from './shared/components/header/header.component';
import { routes } from './app.routes';
import { AuthService } from './core/services/auth.service';
import { CommonModule } from '@angular/common';
import { HttpClientModule, provideHttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, HeaderComponent, CommonModule],
  template: `
    <div class="app-container">
      <ng-container *ngIf="authService.isAuthenticated()">
        <app-sidebar></app-sidebar>
        <div class="main-content">
          <app-header></app-header>
          <div class="page-container">
            <router-outlet></router-outlet>
          </div>
        </div>
      </ng-container>
      
      <ng-container *ngIf="!authService.isAuthenticated()">
        <router-outlet></router-outlet>
      </ng-container>
    </div>
  `,
  styles: [`
    .app-container {
      display: flex;
      height: 100vh;
      overflow: hidden;
      background-color: var(--color-gray-100);
    }
    
    .main-content {
      flex: 1;
      margin-left: 250px;
      display: flex;
      flex-direction: column;
      transition: all 0.3s ease;
      background-color: var(--color-gray-100);
    }
    
    .page-container {
      padding: 80px var(--spacing-6) var(--spacing-6);
      flex: 1;
      overflow-y: auto;
    }
    
    @media (max-width: 768px) {
      .main-content {
        margin-left: 60px;
      }
    }
  `]
})
export class App {
  constructor(public authService: AuthService) {}
}

bootstrapApplication(App, {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    { provide: 'Window', useValue: window },
    importProvidersFrom(HttpClientModule)
  ],
});
