import {Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild} from "@angular/core";
import { CommonModule } from "@angular/common";
// import { WebSocketService } from "../../../core/services/websocket.service";
import { AuthService } from "../../../core/services/auth.service";
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ToastNotificationComponent } from '../toast-notification/toast-notification.component';

interface Notification {
  id: string;
  type: "process" | "task";
  title: string;
  description: string;
  timestamp: Date;
  priority: "high" | "medium" | "low";
  status: string;
  read: boolean;
}

@Component({
  selector: "app-notifications-modal",
  standalone: true,
  imports: [CommonModule, ToastNotificationComponent],
  templateUrl: "./notifications-modal.component.html",
  styleUrls: ["./notifications-modal.component.scss"],
})
export class NotificationsModalComponent implements OnInit, OnDestroy {
  @Input() isOpen = false;
  @Output() closeModal = new EventEmitter<void>();
  @ViewChild(ToastNotificationComponent, { static: true }) toast!: ToastNotificationComponent;

  notifications: Notification[] = [];
  loading = true;
  private notificationSub?: Subscription;
  private userId: string;
  private localStorageKey: string;

  constructor(
      // private websocketService: WebSocketService,
      private authService: AuthService
  ) {
    this.userId = this.authService.getDecodedToken()?.sub || '';
    this.localStorageKey = `notifications_${this.userId}`;
  }

  ngOnInit(): void {
    if (!this.userId) {
      console.error('User ID not found, cannot connect to WebSocket.');
      this.loading = false;
      return;
    }
    this.loadNotificationsFromStorage();
    // this.connectToWebSocket();
  }

  private loadNotificationsFromStorage(): void {
    const stored = localStorage.getItem(this.localStorageKey);
    if (stored) {
      try {
        this.notifications = JSON.parse(stored) as Notification[];
      } catch {
        this.notifications = [];
      }
    }
  }

  private saveNotificationsToStorage(): void {
    localStorage.setItem(this.localStorageKey, JSON.stringify(this.notifications));
  }

  // private connectToWebSocket(): void {
  //   this.websocketService.connect(environment.websocketUrl, this.userId).subscribe({
  //     next: (connected) => {
  //       if (connected) {
  //         this.loading = false;
  //         this.notificationSub = this.websocketService.notifications$.subscribe({
  //           next: (notification) => this.handleNewNotification(notification),
  //           error: (err) => console.error('Notification stream error:', err)
  //         });
  //       }
  //     },
  //     error: (err) => {
  //       console.error('WebSocket connection error:', err);
  //       this.loading = false;
  //     }
  //   });
  // }

  private handleNewNotification(notification: any): void {
    const newNotification: Notification = {
      id: notification.id || Date.now().toString(),
      type: notification.type || 'task',
      title: notification.title || 'New Notification',
      description: notification.message || notification.description || '',
      timestamp: new Date(notification.timestamp || Date.now()),
      priority: notification.priority || 'medium',
      status: notification.status || 'unread',
      read: false
    };

    if (!this.notifications.some(n => n.id === newNotification.id)) {
      this.notifications.unshift(newNotification);
      this.saveNotificationsToStorage();
      this.playNotificationSound();

      // Show toast notification
      this.showToast(newNotification);
    }
  }

  private showToast(notification: Notification): void {
    if (this.toast) {
      this.toast.show({
        title: notification.title,
        message: notification.description,
        type: 'info', // or 'success', 'warning', 'error' based on priority
        duration: 5000 // 5 seconds
      });
    }
  }
  private playNotificationSound(): void {
    const audio = new Audio('assets/sounds/notification.wav');
    audio.play().catch(e => console.warn('Sound playback failed:', e));
  }

  markAsRead(notification: Notification): void {
    notification.read = true;
    this.saveNotificationsToStorage();
    // Optionally send update to backend here
  }

  markAllAsRead(): void {
    this.notifications.forEach(n => n.read = true);
    this.saveNotificationsToStorage();
  }

  ngOnDestroy(): void {
    this.notificationSub?.unsubscribe();
    // this.websocketService.disconnect();
  }

  onClose(): void {
    this.markAllAsRead();
    this.closeModal.emit();
  }
}
