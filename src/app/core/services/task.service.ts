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

  // Mock data pour les tâches
  private mockTasks: Task[] = [
    {
      id: 'TASK-001',
      processInstanceId: 'PROC-001',
      processDefinitionId: 'loan-approval',
      name: 'Validation demande de prêt',
      description: 'Valider les documents de la demande de prêt personnel',
      assignee: 'user123',
      created: new Date(Date.now() - 2 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      priority: 50,
      status: 'assigned'
    },
    {
      id: 'TASK-002',
      processInstanceId: 'PROC-002',
      processDefinitionId: 'account-opening',
      name: 'Vérification KYC',
      description: 'Vérifier les documents KYC du nouveau client',
      candidateGroups: ['managers', 'kyc-team'],
      created: new Date(Date.now() - 4 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() - 2 * 60 * 60 * 1000),
      priority: 75,
      status: 'overdue'
    },
    {
      id: 'TASK-003',
      processInstanceId: 'PROC-003',
      processDefinitionId: 'card-request',
      name: 'Approbation carte bancaire',
      description: 'Approuver la demande de carte bancaire premium',
      created: new Date(Date.now() - 1 * 60 * 60 * 1000),
      priority: 25,
      status: 'pending'
    }
  ];

  // Mock data pour les utilisateurs
  private mockUsers: User[] = [
    {
      id: 'user001',
      username: 'jdupont',
      firstName: 'Jean',
      lastName: 'Dupont',
      email: 'jean.dupont@afriland.com',
      role: 'Analyste',
      isActive: true
    },
    {
      id: 'user002',
      username: 'mmartin',
      firstName: 'Marie',
      lastName: 'Martin',
      email: 'marie.martin@afriland.com',
      role: 'Manager',
      isActive: true
    },
    {
      id: 'user003',
      username: 'pdurand',
      firstName: 'Pierre',
      lastName: 'Durand',
      email: 'pierre.durand@afriland.com',
      role: 'Superviseur',
      isActive: true
    },
    {
      id: 'user004',
      username: 'slegrand',
      firstName: 'Sophie',
      lastName: 'Legrand',
      email: 'sophie.legrand@afriland.com',
      role: 'Analyste Senior',
      isActive: true
    }
  ];

  constructor() {}

  getTasks(filter?: TaskFilter): Observable<Task[]> {
    let filteredTasks = [...this.mockTasks];

    if (filter) {
      if (filter.status) {
        filteredTasks = filteredTasks.filter(task => task.status === filter.status);
      }
      if (filter.assignee) {
        filteredTasks = filteredTasks.filter(task => task.assignee === filter.assignee);
      }
    }

    return of(filteredTasks).pipe(delay(300));
  }

  getUsers(): Observable<User[]> {
    return of(this.mockUsers).pipe(delay(200));
  }

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