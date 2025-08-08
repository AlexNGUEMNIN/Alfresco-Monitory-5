import { Injectable } from '@angular/core';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { Task, TaskFilter, TaskAssignment, User, TaskNotification } from '../models/task.model';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private notificationsSubject = new BehaviorSubject<TaskNotification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();


  constructor() {}


  stopProcess(processId: string): Observable<boolean> {
    console.log(`Arrêt du processus: ${processId}`);
    return of(true).pipe(delay(500));
  }

  transferTask(assignment: TaskAssignment): Observable<boolean> {
    console.log('Transfert de tâche:', assignment);
    
    // Créer une notification
    const notification: TaskNotification = {
      id: `NOTIF-${Date.now()}`,
      type: 'task_transferred',
      taskId: assignment.taskId,
      processId: `PROC-${assignment.taskId.split('-')[1]}`,
      fromUser: 'current-user',
      toUser: assignment.assigneeId || assignment.assigneeType,
      message: `Tâche ${assignment.taskId} transférée manuellement à ${assignment.assigneeId || assignment.assigneeType}`,
      timestamp: new Date(),
      read: false
    };

    // Ajouter la notification
    const currentNotifications = this.notificationsSubject.value;
    this.notificationsSubject.next([notification, ...currentNotifications]);

    return of(true).pipe(delay(800));
  }

  getNotifications(): Observable<TaskNotification[]> {
    return this.notifications$;
  }

  markNotificationAsRead(notificationId: string): void {
    const notifications = this.notificationsSubject.value.map(notif => 
      notif.id === notificationId ? { ...notif, read: true } : notif
    );
    this.notificationsSubject.next(notifications);
  }

  getUnreadNotificationCount(): Observable<number> {
    return this.notifications$.pipe(
      map(notifications => notifications.filter(n => !n.read).length)
    );
  }
}