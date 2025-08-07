import { Component, importProvidersFrom } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { routes } from "./app/app.routes";
import { HttpClientModule } from "@angular/common/http";

// Set global reference before anything else
(window as any).global = window;

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet></router-outlet>`,
})
export class App {}

bootstrapApplication(App, {
  providers: [
    provideRouter(routes),
    importProvidersFrom(HttpClientModule),
  ]
});