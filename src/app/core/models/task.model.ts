export interface Task {
  id: string;
  processInstanceId: string;
  processDefinitionId: string;
  name: string;
  description?: string;
  assignee?: string;
  candidateGroups?: string[];
  created: Date;
  dueDate?: Date;
  priority: number;
  status: 'pending' | 'assigned' | 'overdue' | 'completed';
  formKey?: string;
  variables?: { [key: string]: any };
  // ✅ Add these optional fields:
  managerId?: string | null;
  managerEmail?: string | null;
  groupId?: string | null;
  groupName?: string | null;
}

export interface TaskFilter {
  status?: 'pending' | 'assigned' | 'overdue';
  assignee?: string;
  candidateGroup?: string;
  processDefinitionId?: string;
  dueDate?: {
    from?: Date;
    to?: Date;
  };
}

export interface TaskAssignment {
  taskId: string;
  assigneeType: 'manager' | 'group' | 'user';
  assigneeId?: string;
  reason?: string;
}

export interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
  groupName: string;
}

export interface TaskNotification {
  id: string;
  type: 'task_transferred' | 'task_assigned' | 'task_completed';
  taskId: string;
  processId: string;
  fromUser?: string;
  toUser?: string;
  message: string;
  timestamp: Date;
  read: boolean;
}