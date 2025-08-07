import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
// import { intercepteurRequeteInterceptor } from './intercepteurs/intercepteur-requete.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient() ,provideZoneChangeDetection({ eventCoalescing: true }), provideRouter(routes)]
};
