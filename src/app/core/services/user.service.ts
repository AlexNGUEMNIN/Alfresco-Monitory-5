import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { AuditLog, User, UserPermission } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  // Mock data - would be replaced with actual API calls
  private mockUsers: User[] = [
    {
      id: 'USER001',
      username: 'admin',
      email: 'admin@afriland.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      lastLogin: new Date('2025-04-12T08:30:00'),
      isActive: true
    },
    {
      id: 'USER002',
      username: 'supervisor1',
      email: 'supervisor1@afriland.com',
      firstName: 'Alex',
      lastName: 'Doe',
      role: 'supervisor',
      lastLogin: new Date('2025-04-11T14:15:00'),
      isActive: true
    },
    {
      id: 'USER003',
      username: 'operator1',
      email: 'operator1@afriland.com',
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'operator',
      lastLogin: new Date('2025-04-12T09:45:00'),
      isActive: true
    },
    {
      id: 'USER004',
      username: 'operator2',
      email: 'operator2@afriland.com',
      firstName: 'Robert',
      lastName: 'Johnson',
      role: 'operator',
      lastLogin: new Date('2025-04-10T11:20:00'),
      isActive: false
    }
  ];

  private mockPermissions: UserPermission[] = [
    {
      id: 'PERM001',
      name: 'VIEW_DASHBOARD',
      description: 'View main dashboard'
    },
    {
      id: 'PERM002',
      name: 'MANAGE_PROCESSES',
      description: 'View and manage processes'
    },
    {
      id: 'PERM003',
      name: 'VIEW_ANALYSIS',
      description: 'View process analysis'
    },
    {
      id: 'PERM004',
      name: 'MANAGE_DATABASE',
      description: 'View and manage database'
    },
    {
      id: 'PERM005',
      name: 'MANAGE_USERS',
      description: 'Manage users and permissions'
    }
  ];

  private mockAuditLogs: AuditLog[] = [
    {
      id: 'LOG001',
      userId: 'USER001',
      username: 'admin',
      action: 'LOGIN',
      details: 'User logged in successfully',
      timestamp: new Date('2025-04-12T08:30:00'),
      ipAddress: '192.168.1.10'
    },
    {
      id: 'LOG002',
      userId: 'USER001',
      username: 'admin',
      action: 'TERMINATE_PROCESS',
      details: 'Terminated process PROC-003',
      timestamp: new Date('2025-04-12T09:15:00'),
      ipAddress: '192.168.1.10'
    },
    {
      id: 'LOG003',
      userId: 'USER002',
      username: 'supervisor1',
      action: 'LOGIN',
      details: 'User logged in successfully',
      timestamp: new Date('2025-04-11T14:15:00'),
      ipAddress: '192.168.1.15'
    },
    {
      id: 'LOG004',
      userId: 'USER003',
      username: 'operator1',
      action: 'LOGIN',
      details: 'User logged in successfully',
      timestamp: new Date('2025-04-12T09:45:00'),
      ipAddress: '192.168.1.20'
    },
    {
      id: 'LOG005',
      userId: 'USER003',
      username: 'operator1',
      action: 'RESTART_PROCESS',
      details: 'Restarted process PROC-002',
      timestamp: new Date('2025-04-12T10:05:00'),
      ipAddress: '192.168.1.20'
    }
  ];

  constructor() { }

  getUsers(): Observable<User[]> {
    return of(this.mockUsers).pipe(delay(300));
  }

  getUserById(id: string): Observable<User | undefined> {
    const user = this.mockUsers.find(u => u.id === id);
    return of(user).pipe(delay(200));
  }

  getPermissions(): Observable<UserPermission[]> {
    return of(this.mockPermissions).pipe(delay(250));
  }

  getAuditLogs(): Observable<AuditLog[]> {
    return of(this.mockAuditLogs).pipe(delay(400));
  }

  createUser(user: Omit<User, 'id'>): Observable<User> {
    // This would call an API to create a user
    const newUser: User = {
      ...user,
      id: `USER${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      lastLogin: undefined
    };
    
    return of(newUser).pipe(delay(800));
  }

  updateUser(user: User): Observable<User> {
    // This would call an API to update a user
    return of(user).pipe(delay(700));
  }

  deleteUser(id: string): Observable<boolean> {
    // This would call an API to delete a user
    return of(true).pipe(delay(600));
  }
}