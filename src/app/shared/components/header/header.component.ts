import {Component, EventEmitter, Input, OnInit, Output, signal} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskService } from '../../../core/services/task.service';
import { HelpService } from '../../../core/services/help.service';
import { NotificationsModalComponent } from '../notifications-modal/notifications-modal.component';
import { SettingsModalComponent } from '../settings-modal/settings-modal.component';
import { combineLatest } from 'rxjs';
import { AuthService } from "../../../core/services/auth.service";
import { jwtDecode } from "jwt-decode";

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, NotificationsModalComponent, SettingsModalComponent],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  @Input() sidebarCollapsed: boolean = false;
  @Output() toggleSidebar = new EventEmitter<void>();

  currentDate = new Date();
  notificationCount = signal(0);
  showNotificationsModal = signal(false);
  showSettingsModal = signal(false);

  userName = signal('User');
  userRole = signal('Utilisateur');

  constructor(
      private taskService: TaskService,
      private authService: AuthService,
      private helpService: HelpService
  ) {}

  ngOnInit(): void {
    this.initializeUserData();
    this.startTimeUpdater();
    // this.loadNotificationCount();
  }

  private initializeUserData(): void {
    const tokenData = this.authService.getDecodedToken();
    if (tokenData) {
      this.userName.set(tokenData.name || tokenData.preferred_username || 'User');
      this.userRole.set(tokenData.realm_access?.roles?.[0] || 'Utilisateur');
    }
  }

  private startTimeUpdater(): void {
    setInterval(() => {
      this.currentDate = new Date();
    }, 60000);
  }

  // private loadNotificationCount(): void {
  //   combineLatest([
  //     this.taskService.getUnreadNotificationCount()
  //   ]).subscribe(([taskCount]) => {
  //     this.notificationCount.set(taskCount);
  //   });
  // }

  onNotificationsClick(): void {
    this.showNotificationsModal.set(true);
  }

  onHelpClick(): void {
    this.helpService.downloadUserGuide();
  }

  onSettingsClick(): void {
    this.showSettingsModal.set(true);
  }

  onCloseNotificationsModal(): void {
    this.showNotificationsModal.set(false);
  }

  onCloseSettingsModal(): void {
    this.showSettingsModal.set(false);
  }

  onToggleSidebar(): void {
    this.toggleSidebar.emit();
  }
}