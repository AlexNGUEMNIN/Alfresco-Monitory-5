export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  lastLogin?: Date;
  isActive: boolean;
}

export type UserRole = 'admin' | 'supervisor' | 'operator';

export interface UserPermission {
  id: string;
  name: string;
  description: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  username: string;
  action: string;
  details: string;
  timestamp: Date;
  ipAddress?: string;
}