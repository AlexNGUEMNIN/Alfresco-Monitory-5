import {
  Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subscription } from 'rxjs';

import { TasksService } from '../../../core/services/tasks.service';
import { AuthService } from '../../../core/services/auth.service';
import { Task, User, TaskAssignment } from '../../../core/models/task.model';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-task-transfer-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './task-transfer-modal.component.html',
  styleUrls: ['./task-transfer-modal.component.scss']
})
export class TaskTransferModalComponent implements OnInit, OnChanges, OnDestroy {
  @Input() isOpen = false;
  @Input() taskData: Task | Task[] | null = null;
  @Output() closeModal = new EventEmitter<void>();
  @Output() taskTransferred = new EventEmitter<TaskAssignment[]>();

  currentStep = 1;
  selectedAssigneeType: 'manager' | 'group' | 'user' | null = null;
  selectedUserId: string | null = null;
  selectedGroupTransferType: 'itsGroup' | 'otherGroup' | null = null;
  selectedOtherGroupId: string | null = null;

  users: User[] = [];
  filteredUsers: User[] = [];
  searchTerm = '';
  loadingUsers = false;
  transferring = false;
  transferError = false;
  errorMessage = '';
  availableGroups: { id: string, name: string }[] = [];
  filteredGroups: { id: string, name: string }[] = [];
  loadingGroups = false;
  groupSearchTerm = '';

  managers: User[] = [];
  filteredManagers: User[] = [];
  managerSearchTerm = '';
  loadingManagers = false;
  selectedManagerId: string | null = null;
  selectedManagerTransferType: 'itsManager' | 'otherManager' | null = null;
  selectedManager: User | null = null;

  showGroupModal = false;
  showManagerConfirmationModal = false;
  showGroupConfirmationModal = false;
  selectedGroup: { id: string, name: string } | null = null;

  private wsSubscription?: Subscription;
  private currentUserId: string;

  constructor(
      private taskService: TasksService,
      private authService: AuthService,
      private http: HttpClient,
  ) {
    this.currentUserId = this.authService.getDecodedToken()?.sub || '';
  }

  ngOnInit(): void {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue) {
      this.loadUsers();
      this.resetTransferState();
      this.selectedGroupTransferType = null;
      this.selectedOtherGroupId = null;
    }
  }

  ngOnDestroy(): void {
    this.wsSubscription?.unsubscribe();
  }

  protected getTasksArray(): Task[] {
    if (!this.taskData) return [];
    return Array.isArray(this.taskData) ? this.taskData : [this.taskData];
  }


  private resetTransferState(): void {
    this.currentStep = 1;
    this.selectedAssigneeType = null;
    this.selectedUserId = null;
    this.searchTerm = '';
    this.transferring = false;
    this.transferError = false;
    this.errorMessage = '';
    this.selectedGroupTransferType = null;
    this.selectedOtherGroupId = null;
  }

  loadUsers(): void {
    this.loadingUsers = true;

    // Fetch users from API - using /users endpoint
    this.http.get<any[]>(`${environment.api2Url}`).subscribe({
      next: (data) => {
        // Map API users to User[] format
        this.users = data.map((user) => {
          const nameParts = (user.fullName || "").split(" ");
          const firstName = nameParts[0] || "";
          const lastName = nameParts.slice(1).join(" ") || "";
          return {
            id: user.id?.toString(),
            username: user.email || "",
            firstName: firstName,
            lastName: lastName,
            email: user.email || "",
            role: user.role || "user",
            isActive: true,
            lastActivity: undefined,
            avatar: undefined,
          } as User;
        });
        this.filteredUsers = []; // Only show users after search
        this.loadingUsers = false;
      },
      error: () => {
        this.users = [];
        this.filteredUsers = [];
        this.loadingUsers = false;
      }
    });
  }

  loadManagers(): void {
    this.loadingManagers = true;
    this.http.get<any[]>(`${environment.api2Url}/groups/with-managers`).subscribe({
      next: (groups) => {
        // Deduplicate managers by managerUserId
        const seen = new Set();
        this.managers = groups
            .filter(g => g.managerUserId && !seen.has(g.managerUserId) && !!g.email)
            .map(g => {
              seen.add(g.managerUserId);
              const [firstName, ...lastNameArr] = (g.managerFullName || '').split(' ');
              return {
                id: g.managerUserId?.toString(),
                username: g.email || '',
                firstName: firstName || '',
                lastName: lastNameArr.join(' ') || '',
                email: g.email || '',
                role: 'manager',
                isActive: true,
                lastActivity: undefined,
                avatar: undefined,
              } as User;
            });
        this.filteredManagers = [];
        this.loadingManagers = false;
      },
      error: () => {
        this.managers = [];
        this.filteredManagers = [];
        this.loadingManagers = false;
      }
    });
  }

  selectAssigneeType(type: 'manager' | 'group' | 'user'): void {
    this.selectedAssigneeType = type;
    if (type !== 'group') {
      this.selectedGroupTransferType = null;
      this.selectedOtherGroupId = null;
    }
  }

  selectGroupTransferType(type: 'itsGroup' | 'otherGroup'): void {
    this.selectedGroupTransferType = type;
    if (type === 'otherGroup') {
      this.loadGroups();
    }
  }

  selectUser(userId: string): void {
    this.selectedUserId = userId;
  }

  selectOtherGroup(groupId: string): void {
    this.selectedOtherGroupId = groupId;
  }

  selectManager(managerId: string): void {
    this.selectedManagerId = managerId;
    this.selectedManager = this.managers.find(m => m.id === managerId) || null;
    // Do NOT send or open modal here, just select
  }

  selectManagerTransferType(type: 'itsManager' | 'otherManager'): void {
    this.selectedManagerTransferType = type;
  }

  filterUsers(): void {
    const term = this.searchTerm?.toLowerCase().trim();
    if (term) {
      this.filteredUsers = this.users.filter(user =>
          (user.firstName?.toLowerCase().includes(term) || '') ||
          (user.lastName?.toLowerCase().includes(term) || '') ||
          (user.email?.toLowerCase().includes(term) || '') ||
          (user.role?.toLowerCase().includes(term) || '')
      );
    } else {
      this.filteredUsers = []; // Show nothing if search is empty
    }
  }

  loadGroups(): void {
    this.loadingGroups = true;
    this.http.get<any[]>(`${environment.api2Url}/groups/with-managers`).subscribe({
      next: (groups) => {
        this.availableGroups = groups.map(g => ({
          id: g.groupId?.toString(),
          name: g.groupName || ''
        }));
        this.filteredGroups = []; // Only show groups after search
        this.loadingGroups = false;
      },
      error: () => {
        this.availableGroups = [];
        this.filteredGroups = [];
        this.loadingGroups = false;
      }
    });
  }

  filterGroups(): void {
    const term = this.groupSearchTerm?.toLowerCase().trim();
    if (term) {
      this.filteredGroups = this.availableGroups.filter(group =>
          group.name.toLowerCase().includes(term)
      );
    } else {
      this.filteredGroups = [];
    }
  }

  filterManagers(): void {
    const term = this.managerSearchTerm?.toLowerCase().trim();
    if (term) {
      this.filteredManagers = this.managers.filter(manager =>
          (manager.firstName?.toLowerCase().includes(term) || '') ||
          (manager.lastName?.toLowerCase().includes(term) || '') ||
          (manager.email?.toLowerCase().includes(term) || '')
      );
    } else {
      this.filteredManagers = [];
    }
  }

  goBack(): void {
    this.currentStep = 1;
    this.selectedUserId = null;
  }

  goToManagerSelectionStep(): void {
    this.currentStep = 2;
    this.selectedManagerId = null;
    this.managerSearchTerm = '';
    this.filteredManagers = [];
    this.loadManagers();
    this.loadGroups(); // Also load groups as requested
  }

  goToGroupSelectionStep(): void {
    this.currentStep = 2;
    this.selectedOtherGroupId = null;
    this.groupSearchTerm = '';
    this.filteredGroups = [];
    this.loadGroups();
  }

  canProceed(): boolean {
    if (this.currentStep === 1) {
      return this.selectedAssigneeType !== null;
    }
    if (this.currentStep === 2) {
      if (this.selectedAssigneeType === 'user') {
        return this.selectedUserId !== null;
      }
      if (this.selectedAssigneeType === 'group') {
        if (this.selectedGroupTransferType === 'itsGroup') return true;
        if (this.selectedGroupTransferType === 'otherGroup') return this.selectedOtherGroupId !== null;
      }
    }
    return false;
  }

  async onTransfer(): Promise<void> {
    if (!this.canProceed()) {
      console.warn('⚠️ Transfert impossible: condition non remplie.');
      return;
    }

    if (this.selectedAssigneeType === 'user' && this.currentStep === 1) {
      this.currentStep = 2;
      return;
    }

    this.transferring = true;
    this.transferError = false;
    const tasks = this.getTasksArray();
    console.log('📝 Tâches à transférer (utilisateur spécifique) :', tasks);

    const successfulTransfers: TaskAssignment[] = [];

    try {
      const assigneeEmail = this.users.find(u => u.id === this.selectedUserId)?.email || '';
      if (!this.currentUserId || !assigneeEmail) {
        throw new Error('🔍 Informations utilisateur manquantes.');
      }

      const fetchedUserId = await this.http
          .get<string>(`${environment.api2Url}/db-id-by-email?email=${encodeURIComponent(assigneeEmail)}`, { responseType: 'text' as 'json' })
          .toPromise();

      if (!fetchedUserId || fetchedUserId.trim() === '') {
        throw new Error(`🛑 ID introuvable pour l'email: ${assigneeEmail}`);
      }

      const trimmedUserId = fetchedUserId.trim();

      for (const task of tasks) {
        try {
          const assignment: TaskAssignment = {
            taskId: task.id,
            assigneeType: this.selectedAssigneeType!,
            assigneeId: this.selectedUserId || undefined
          };

          await this.http.put(
              `${environment.BASE_URL}/activiti-app/api/enterprise/tasks/${assignment.taskId}/action/assign`,
              {
                assignee: trimmedUserId,
                email: assigneeEmail
              },
              {
                headers: new HttpHeaders({
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': `Bearer ${this.authService.accessToken}`
                })
              }
          ).toPromise();

          // Removed: sendHttpNotification
          successfulTransfers.push(assignment);
        } catch (taskError) {
          console.error(`❌ Erreur durant le transfert de la tâche ${task.id}:`, taskError);
        }
      }

      if (successfulTransfers.length > 0) {
        await this.sendEmailNotification(
            assigneeEmail,
            'Nouvelle(s) tâche(s) assignée(s)',
            `Bonjour,\n\n${successfulTransfers.length} tâche(s) vous a/ont été assignée(s) dans le système.\nMerci de les traiter dès que possible.`
        );
      }

      if (successfulTransfers.length === tasks.length) {
        this.taskTransferred.emit(successfulTransfers);
        this.onClose();
      } else if (successfulTransfers.length > 0) {
        this.taskTransferred.emit(successfulTransfers);
        this.handleTransferError(`Seules ${successfulTransfers.length} tâche(s) sur ${tasks.length} ont été transférées.`);
      } else {
        throw new Error('Aucune tâche n\'a pu être transférée.');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Échec du transfert.';
      this.handleTransferError(msg);
      console.error('❌ Erreur durant le transfert:', error);
    } finally {
      this.transferring = false;
    }
  }

  async onManagerTransfer(): Promise<void> {
    const tasks = this.getTasksArray();
    console.log('📝 Tâches à transférer (manager) :', tasks); // ✅

    if (tasks.length === 0) {
      console.warn('⚠️ Aucune tâche disponible.');
      return;
    }

    this.transferring = true;
    this.transferError = false;
    const successfulTransfers: TaskAssignment[] = [];

    try {
      // 1. Get the assignee userId for the first task (or fallback to current user)
      let assigneeUserId: string | undefined = (tasks[0] as any).assignee || (tasks[0] as any).assigneeId || (tasks[0] as any).userId;

      // If not present, try to fetch from API using email
      let assigneeEmail: string | undefined = (tasks[0] as any).assigneeEmail || (tasks[0] as any).email;
      if (!assigneeUserId && assigneeEmail) {
        assigneeUserId = await this.http
          .get<string>(`${environment.api2Url}/db-id-by-email?email=${encodeURIComponent(assigneeEmail)}`, { responseType: 'text' as 'json' })
          .toPromise();
        assigneeUserId = assigneeUserId?.trim();
      }

      if (!assigneeUserId) {
        throw new Error('Impossible de déterminer l\'utilisateur pour trouver son manager.');
      }

      // 2. Fetch manager info from API
      let managerInfo: any;
      try {
        managerInfo = await this.http.get<any>(`${environment.api2Url}/manager-info/${assigneeUserId}`).toPromise();
      } catch (err: any) {
        if (err && err.status === 400) {
          this.handleTransferError(
            "Cet utilisateur n'a pas de manager défini. Veuillez utiliser l'option 'Transférer à un autre manager'.",
          );
          // Display a notification in the UI (optional: you can use a toast/snackbar service here)
          alert("Aucun manager trouvé pour cet utilisateur. Veuillez utiliser l'option 'Transférer à un autre manager'.");
          return;
        }
        throw err;
      }

      if (!managerInfo || !managerInfo.managerUserId || !managerInfo.managerEmail) {
        throw new Error('Impossible de trouver le manager responsable pour cet utilisateur.');
      }
      const managerId = managerInfo.managerUserId.toString();
      const managerEmail = managerInfo.managerEmail;

      // 3. Assign each task to the manager using the same logic as onTransfer (user)
      for (const task of tasks) {
        try {
          const assignment: TaskAssignment = {
            taskId: task.id,
            assigneeType: 'manager',
            assigneeId: managerId
          };

          await this.http.put(
            `${environment.BASE_URL}/activiti-app/api/enterprise/tasks/${assignment.taskId}/action/assign`,
            {
              assignee: managerId,
              email: managerEmail
            },
            {
              headers: new HttpHeaders({
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${this.authService.accessToken}`
              })
            }
          ).toPromise();

          // Send email notification for each task (or you can send once after all)
          await this.sendEmailNotification(
            managerEmail,
            'Nouvelle tâche transférée au Manager',
            `Bonjour,\n\nVous avez reçu une nouvelle tâche à valider dans le système.\nMerci de la traiter dès que possible.`
          );

          successfulTransfers.push(assignment);
        } catch (taskError) {
          console.error(`❌ Erreur durant le transfert de la tâche ${task.id} au manager:`, taskError);
        }
      }

      // Optionally, send a summary email after all tasks (uncomment if you want only one email)
      /*
      if (successfulTransfers.length > 0) {
        await this.sendEmailNotification(
          managerEmail,
          'Tâche(s) transférée(s) au Manager',
          `Bonjour,\n\n${successfulTransfers.length} tâche(s) vous a/ont été transférée(s) pour validation dans le système.\nVeuillez les consulter rapidement.`
        );
      }
      */
      
      if (successfulTransfers.length === tasks.length) {
        this.taskTransferred.emit(successfulTransfers);
        this.onClose();
      } else if (successfulTransfers.length > 0) {
        this.taskTransferred.emit(successfulTransfers);
        this.handleTransferError(`Seules ${successfulTransfers.length} tâche(s) sur ${tasks.length} ont été transférées.`);
      } else {
        throw new Error('Aucune tâche n\'a pu être transférée au manager.');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Échec du transfert vers le manager.';
      this.handleTransferError(msg);
      console.error('❌ Erreur transfert manager :', error);
    } finally {
      this.transferring = false;
    }
  }

  async onTransferGroup(): Promise<void> {
    const tasks = this.getTasksArray();
    console.log('📝 Tâches à transférer (groupe) :', tasks); // ✅

    if (tasks.length === 0) {
      console.warn('⚠️ Aucune tâche disponible.');
      this.handleTransferError('Aucune tâche disponible.');
      return;
    }

    this.transferring = true;
    this.transferError = false;
    const successfulTransfers: TaskAssignment[] = [];

    try {
      const groupId = (tasks[0] as any).groupId;

      // Remove the call to get group emails
      // const userEmails = await this.http
      //     .get<string[]>
      //         `${environment.api2Url}/group/${encodeURIComponent(groupId)}/emails`,
      //         {
      //           headers: new HttpHeaders({
      //             'Content-Type': 'application/json',
      //             'Authorization': `Bearer ${this.authService.accessToken}`
      //           })
      //         }
      //     )
      //     .toPromise() ?? [];


      for (const task of tasks) {
        try {
          await this.http.put(
              `${environment.BASE_URL}/activiti-app/api/enterprise/tasks/${task.id}/action/unclaim`,
              null,
              {
                headers: new HttpHeaders({
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${this.authService.accessToken}`
                })
              }
          ).toPromise();


          // If you want to notify group members, implement your own logic here

          successfulTransfers.push({
            taskId: task.id,
            assigneeType: 'group',
            assigneeId: groupId
          });
        } catch (taskError) {
          console.error(`❌ Erreur durant le transfert de la tâche ${task.id} au groupe:`, taskError);
        }
      }

      if (successfulTransfers.length === tasks.length) {
        this.taskTransferred.emit(successfulTransfers);
        this.onClose();
      } else if (successfulTransfers.length > 0) {
        this.taskTransferred.emit(successfulTransfers);
        this.handleTransferError(`Seules ${successfulTransfers.length} tâche(s) sur ${tasks.length} ont été transférées.`);
      } else {
        throw new Error('Aucune tâche n\'a pu être transférée au groupe.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Échec du transfert au groupe.';
      this.handleTransferError(message);
      console.error('❌ Erreur transfert groupe :', error);
    } finally {
      this.transferring = false;
    }
  }


  private async sendEmailNotification(to: string, subject: string, body: string): Promise<void> {
    try {
      await this.http.post(
          `${environment.api2Url}/notifications/send-email`,
          { to, subject, body },
          {
            responseType: 'text' as 'json'
          }
      ).toPromise();
      console.log(`📧 Email envoyé à ${to}`);
    } catch (error) {
      console.warn('❌ Échec de l\'envoi de l\'email:', error);
    }
  }



  private handleTransferError(message: string): void {
    this.transferError = true;
    this.errorMessage = message;
    setTimeout(() => {
      this.transferError = false;
      this.errorMessage = '';
    }, 5000);
  }

  onClose(): void {
    this.resetTransferState();
    this.closeModal.emit();
  }

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  openGroupModal(): void {
    this.selectedGroupTransferType = 'otherGroup';
    this.showGroupModal = true;
    this.loadGroups();
  }

  closeGroupModal(): void {
    this.showGroupModal = false;
    this.selectedGroupTransferType = null;
    this.selectedOtherGroupId = null;
    this.groupSearchTerm = '';
    this.filteredGroups = [];
  }

  openManagerConfirmationModal(): void {
    this.showManagerConfirmationModal = true;
  }

  openGroupConfirmationModal(): void {
    // Set selectedGroup for confirmation modal
    if (this.selectedGroupTransferType === 'otherGroup' && this.selectedOtherGroupId) {
      this.selectedGroup = this.availableGroups.find(g => g.id === this.selectedOtherGroupId) || null;
    } else if (this.selectedGroupTransferType === 'itsGroup') {
      const tasks = this.getTasksArray();
      this.selectedGroup = tasks.length > 0 ? { id: (tasks[0] as any).groupId, name: (tasks[0] as any).groupName } : null;
    }
    this.showGroupConfirmationModal = true;
  }

  closeConfirmationModal(): void {
    this.showManagerConfirmationModal = false;
    this.showGroupConfirmationModal = false;
  }

  onConfirmationBackdrop(event: Event): void {
    if (event.target === event.currentTarget) {
      this.closeConfirmationModal();
    }
  }

  onConfirmManagerTransfer(): void {
    this.showManagerConfirmationModal = false;
    if (this.selectedManagerId && this.selectedManager) {
      this.sendTaskToManager(this.selectedManagerId, this.selectedManager.email);
    }
  }

  onConfirmGroupTransfer(): void {
    this.showGroupConfirmationModal = false;
    this.onTransferGroup();
  }

  async selectManagerAndSend(managerId: string): Promise<void> {
    this.selectedManagerId = managerId;
    this.selectedManager = this.managers.find(m => m.id === managerId) || null;
    // Do NOT send or open modal here, just select
  }

  private async sendTaskToSelectedManager(): Promise<void> {
    const managerId = this.selectedManagerId;
    if (!managerId) return;
    try {
      const groups = await this.http.get<any[]>(`${environment.api2Url}/groups/with-managers`).toPromise();
      const group = Array.isArray(groups) ? groups.find(g => g.managerUserId?.toString() === managerId) : null;
      if (!group || !group.email || !group.managerUserId) {
        this.handleTransferError('Impossible de trouver le manager sélectionné.');
        return;
      }
      await this.sendTaskToManager(managerId, group.email);
    } catch (err) {
      this.handleTransferError('Erreur lors de la récupération du manager.');
      console.error('Erreur lors de la récupération du manager:', err);
    }
  }

  private async sendTaskToManager(managerId: string, managerEmail: string): Promise<void> {
    const tasks = this.getTasksArray();
    if (tasks.length === 0) {
      this.handleTransferError('Aucune tâche disponible.');
      return;
    }
    this.transferring = true;
    this.transferError = false;
    const successfulTransfers: TaskAssignment[] = [];
    try {
      for (const task of tasks) {
        try {
          const assignment: TaskAssignment = {
            taskId: task.id,
            assigneeType: 'manager',
            assigneeId: managerId
          };

          console.log(`Envoi de la tâche ${task.id} au manager ${managerId} (${managerEmail})`);
          await this.http.put(
              `${environment.BASE_URL}/activiti-app/api/enterprise/tasks/${assignment.taskId}/action/assign`,
              { assignee: managerId, email: managerEmail },
              {
                headers: new HttpHeaders({
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': `Bearer ${this.authService.accessToken}`
                })
              }
          ).toPromise();

          successfulTransfers.push(assignment);
        } catch (taskError) {
          console.error(`❌ Erreur durant le transfert de la tâche ${task.id} au manager:`, taskError);
        }
      }

      if (successfulTransfers.length > 0) {
        try {
          await this.sendEmailNotification(
              managerEmail,
              'Tâche(s) transférée(s) au Manager',
              `Bonjour,\n\n${successfulTransfers.length} tâche(s) vous a/ont été transférée(s) pour validation dans le système.\nVeuillez les consulter rapidement.`
          );
          console.log(`📧 Email envoyé à ${managerEmail}`);
        } catch (emailError) {
          console.warn('❌ Erreur lors de l\'envoi de l\'email au manager:', emailError);
        }
      }

      if (successfulTransfers.length === tasks.length) {
        this.taskTransferred.emit(successfulTransfers);
        this.onClose();
      } else if (successfulTransfers.length > 0) {
        this.taskTransferred.emit(successfulTransfers);
        this.handleTransferError(`Seules ${successfulTransfers.length} tâche(s) sur ${tasks.length} ont été transférées.`);
      } else {
        throw new Error('Aucune tâche n\'a pu être transférée au manager.');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Échec du transfert vers le manager.';
      this.handleTransferError(msg);
      console.error('❌ Erreur transfert manager :', error);
    } finally {
      this.transferring = false;
    }
  }
}