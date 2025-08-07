import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ToastType } from '../../shared/components/toast-notification/toast-notification.component';

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: ToastType;
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastsSubject = new BehaviorSubject<ToastMessage[]>([]);
  public toasts$ = this.toastsSubject.asObservable();

  show(title: string, message: string, type: ToastType = 'info', duration = 5000): void {
    const toast: ToastMessage = {
      id: Date.now().toString(),
      title,
      message,
      type,
      duration
    };

    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next([...currentToasts, toast]);
  }

  remove(id: string): void {
    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next(currentToasts.filter(toast => toast.id !== id));
  }

  success(title: string, message: string, duration = 5000): void {
    this.show(title, message, 'success', duration);
  }

  error(title: string, message: string, duration = 7000): void {
    this.show(title, message, 'error', duration);
  }

  warning(title: string, message: string, duration = 6000): void {
    this.show(title, message, 'warning', duration);
  }

  info(title: string, message: string, duration = 5000): void {
    this.show(title, message, 'info', duration);
  }
}