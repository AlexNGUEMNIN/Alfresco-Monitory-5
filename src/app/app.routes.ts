import { Routes } from "@angular/router";
import { AuthLayoutComponent } from "./layouts/auth-layout/auth-layout.component";
import { MainLayoutComponent } from "./layouts/main-layout/main-layout.component";
import { LoginComponent } from "./components/auth/login/login.component";
import { AuthGuard } from "./core/services/auth.guard";

export const routes: Routes = [
  {
    path: "",
    component: AuthLayoutComponent,
    children: [
      {
        path: "login",
        component: LoginComponent,
      },
      {
        path: "verification",
        loadComponent: () =>
          import("./components/auth/verification/verification.component").then(
            (m) => m.VerificationComponent
          ),
      },
      {
        path: "resetMdp",
        loadComponent: () =>
          import("./components/auth/resetmdp/resetmdp.component").then(
            (m) => m.ResetmdpComponent
          ),
      },
      {
        path: "emailVerif",
        loadComponent: () =>
          import(
            "./components/auth/emailverification/emailverification.component"
          ).then((m) => m.EmailverificationComponent),
      },
      {
        path: "",
        redirectTo: "login",
        pathMatch: "full",
      },
    ],
  },
  {
    path: "",
    component: MainLayoutComponent,
    canActivate: [AuthGuard],
    children: [
      {
        path: "dashboard",
        loadComponent: () =>
          import("./components/dashboard/dashboard.component").then(
            (m) => m.DashboardComponent
          ),
      },
      {
        path: "processes",
        loadComponent: () =>
          import("./components/processes/processes.component").then(
            (m) => m.ProcessesComponent
          ),
      },
      {
        path: "process-dynamics",
        loadComponent: () =>
          import(
            "./components/process-dynamics/process-dynamics.component"
          ).then((m) => m.ProcessDynamicsComponent),
      },
      {
        path: "analysis",
        loadComponent: () =>
          import("./components/analysis/analysis.component").then(
            (m) => m.AnalysisComponent
          ),
      },
      {
        path: "database",
        loadComponent: () =>
          import("./components/database/database.component").then(
            (m) => m.DatabaseComponent
          ),
      },
      {
        path: "admin",
        loadComponent: () =>
          import("./components/admin/admin.component").then(
            (m) => m.AdminComponent
          ),
      },
 
      {
        path: "task-users",
        loadComponent: () =>
          import("./components/task-users/task-users.component").then(
            (m) => m.TaskUsersComponent
          ),
      },
      {
        path: "historiques",
        loadComponent: () =>
          import("./components/historique/historique.component").then(
            (m) => m.HistoriqueComponent
          ),
      },
      {
        path: "failures",
        loadComponent: () =>
          import("./components/failure/failure.component").then(
            (m) => m.FailureComponent
          ),
      },
      {
        path: "",
        redirectTo: "dashboard",
        pathMatch: "full",
      },
    ],
  },
  { path: "**", redirectTo: "/login" },
];
