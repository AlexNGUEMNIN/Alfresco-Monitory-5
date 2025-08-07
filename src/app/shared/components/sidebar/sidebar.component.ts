import { Component, OnInit, Input } from "@angular/core";
import { RouterModule } from "@angular/router";
import { CommonModule } from "@angular/common";
import { AuthService } from "../../../core/services/auth.service";

@Component({
  selector: "app-sidebar",
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: "./sidebar.component.html",
  styleUrls: ["./sidebar.component.scss"],
})
export class SidebarComponent implements OnInit {
  menuItems = [
    {
      label: "Dashboard",
      icon: "dashboard",
      route: "/dashboard",
    },
    {
      label: "Process Management",
      icon: "settings_suggest",
      route: "/processes",
    },
    {
      label: "Process Dynamics",
      icon: "dynamic_feed",
      route: "/process-dynamics",
    },
    {
      label: "Database Supervision",
      icon: "storage",
      route: "/database",
    },
    {
      label: "Administration",
      icon: "admin_panel_settings",
      route: "/admin",
    },
    {
      label: "User Tasks",
      icon: "assignment_ind",
      route: "/task-users",
    },
    {
      label: "Historiques",
      icon: "history",
      route: "/historiques",
    },
    {
      label: "Failures",
      icon: "error_outline",
      route: "/failures",
    },
  ];

  @Input() sidebarCollapsed: boolean = false;

  constructor(private authService: AuthService) {}

  ngOnInit() {}

  onLogout() {
    this.authService.logout();
  }

  trackByRoute(index: number, item: any): string {
    return item.route;
  }
}
