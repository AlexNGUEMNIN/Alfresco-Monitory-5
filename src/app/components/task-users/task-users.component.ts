import { Component, OnInit, OnDestroy, ChangeDetectorRef } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from "rxjs";
import {
  ProcessData,
  ProcessResponse,
} from "../../core/services/process.service";

// Services
import { TasksService } from "../../core/services/tasks.service";
import { ToastService } from "../../core/services/toast.service";

// Models
import { User } from "../../core/models/user.model";
import { Task, TaskAssignment } from "../../core/models/task.model";

// Components
import { EnhancedBulkActionsModalComponent } from "../../shared/components/enhanced-bulk-actions-modal/enhanced-bulk-actions-modal.component";
import { TaskTransferModalComponent } from "../../shared/components/task-transfer-modal/task-transfer-modal.component";
import { MatIconButton } from "@angular/material/button";
import { MatIcon } from "@angular/material/icon";
import { MatTooltip } from "@angular/material/tooltip";
import { AdvancedFilterModalComponent } from "../../shared/components/app-advanced-filter-modal/app-advanced-filter-modal.component";
import { HttpClient } from "@angular/common/http";
import { ActivatedRoute } from "@angular/router";
import { environment } from "../../../environments/environment";
import { ToastNotificationComponent } from "../../shared/components/toast-notification/toast-notification.component";
import {BulkActionsModalComponent} from "../../shared/components/bulk-actions-modal/bulk-actions-modal.component";

// Interfaces
interface UserApplication {
  id: string;
  name: string;
  type: string;
  status: "active" | "inactive" | "maintenance";
  icon?: string;
  processCount: number;
  taskCount: number;
}

interface ExtendedUser extends User {
  tasksCount: number;
  lastActivity?: Date;
  avatar?: string;
}

interface ExtendedTask extends Task {
  workflowName: string;
  applicationName: string;
  processName: string;
  assigneeName?: string;
  type: string;
  suspensionState?: number; // <-- Add this line
}

interface Toast {
  title: string;
  duration: number;
  id: string;
  type: "success" | "error" | "warning" | "info";
  message: string;
}

interface BulkActionResult {
  action: string;
  selectedItems: any[];
  success: boolean;
  message: string;
}

@Component({
  selector: "app-task-users",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    EnhancedBulkActionsModalComponent,
    TaskTransferModalComponent,
    BulkActionsModalComponent,
    MatIcon,
    MatIconButton,
    MatTooltip,
    MatIcon,
    AdvancedFilterModalComponent,
    ToastNotificationComponent,
  ],
  templateUrl: "./task-users.component.html",
  styleUrls: ["./task-users.component.scss"],
})
export class TaskUsersComponent implements OnInit, OnDestroy {
  [x: string]: any;
  // goToPage(arg0: number) {
  //   throw new Error("Method not implemented.");
  // }
  // previousPage() {
  //   throw new Error("Method not implemented.");
  // }
  // nextPage() {
  //   throw new Error("Method not implemented.");
  // }
  // onPageSizeChange() {
  //   throw new Error("Method not implemented.");
  // }
  private destroy$ = new Subject<void>();
  private userSearchSubject = new Subject<string>();
  private taskSearchSubject = new Subject<string>();
  private appSearchSubject = new Subject<string>();
  private appTaskSearchSubject = new Subject<string>();

  // ===== API CONFIGURATION =====
  private readonly API_BASE_URL = environment.api2Url; // <-- use environment

  // ===== DATA PROPERTIES =====
  users: ExtendedUser[] = [];
  filteredUsers: ExtendedUser[] = [];
  selectedUser: ExtendedUser | null = null;

  userTasks: ExtendedTask[] = [];
  filteredUserTasks: ExtendedTask[] = [];
  selectedUserTasks: ExtendedTask[] = [];
  selectedUserTasksIds = new Set<string>();

  userApplications: UserApplication[] = [];
  filteredUserApplications: UserApplication[] = [];
  selectedApplication: UserApplication | null = null;

  appTasks: ExtendedTask[] = [];
  filteredAppTasks: ExtendedTask[] = [];
  selectedAppTasks: ExtendedTask[] = [];
  selectedAppTasksIds = new Set<string>();

  availableProcesses: { id: string; name: string }[] = [];
  availableAssignees: { id: string; name: string }[] = [];

  // ===== SEARCH & FILTER PROPERTIES =====
  userSearchTerm = "";
  userSearchHistory: string[] = [];
  showUserSearchHistory = false;
  userStatusFilter = "";
  userTasksFilter = "";
  userSortBy = "name-asc";

  taskSearchTerm = "";
  taskStatusFilter = "";
  taskPriorityFilter = "";
  taskSortBy = "created-desc";

  appSearchTerm = "";
  appStatusFilter = "";
  appTasksFilter = "";
  appSearchHistory: string[] = [];
  showAppSearchHistory: boolean = false;

  appTaskSearchTerm = "";
  appTaskProcessFilter = "";
  appTaskAssigneeFilter = "";
  appTaskStatusFilter = "";

  // ===== UI STATE PROPERTIES =====
  loadingUsers = false;
  loadingUserTasks = false;
  loadingUserApplications = false;
  loadingAppTasks = false;

  activeColumn = "users";
  showBulkActionsModal = false;
  bulkActionContext = "";
  showTransferModal = false;
  taskToTransfer: ExtendedTask | ExtendedTask[] | null = null;
  showTaskDetailsModal = false;
  selectedTaskDetails: ExtendedTask | null = null;
  showAdvancedFilterModal = false;

  toasts: Toast[] = [];

  // ===== ADVANCED FILTERS =====
  advancedFilters: any = {
    processCase: "",
    processDefinitionId: "",
    processInstanceId: "",
    periodInDays: null,
    sortOrder: "ASC",
    assigneeId: "",
  };
  Math = Math;
  paginatedTasks: ExtendedTask[] = []; // Typed array for better type safety
  totalPages: number = 1;
  paginationInfo: string = "";
  currentPage: number = 1;
  visiblePageNumbers: number[] = [];
  pageSize: number = 5; // Default to 5 items per page
  // ===== COMPUTED PROPERTIES =====
  get totalUsers(): number {
    return this.users.length;
  }

  get totalTasks(): number {
    return this.users.reduce((sum, user) => sum + user.tasksCount, 0);
  }

  get totalApplications(): number {
    return this.userApplications.length;
  }

  constructor(
      private tasksService: TasksService,
      private toastService: ToastService,
      private cdr: ChangeDetectorRef,
      private route: ActivatedRoute,
      private http: HttpClient
  ) {
    this.setupSearchDebouncing();
    // Initialize pagination defaults
    this.currentPage = 1;
    this.pageSize = 5;
  }

  ngOnInit(): void {
    this.loadUsers();
    this.route.queryParams.subscribe((params) => {
      if (params["userEmail"]) {
        this.userSearchTerm = params["userEmail"];
        this.onUserSearch();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ===== DATA LOADING METHODS =====
  private loadUsers(): void {
    this.loadingUsers = true;

    // Fetch users from API - using /users endpoint
    this.http.get<any[]>(`${this.API_BASE_URL}`).subscribe({
      next: (data) => {
        console.log("API Response:", data); // For debugging
        this.users = this.mapApiUsersToExtendedUsers(data);
        this.filteredUsers = []; // Only show users after search
        this.loadingUsers = false;
        this.cdr.detectChanges();
        this.showToast(
          "success",
          `${this.users.length} utilisateurs chargés depuis l'API`
        );
        // Do NOT show users until a search is performed
      },
      error: (error) => {
        console.error("Erreur lors du chargement des utilisateurs:", error);
        this.loadingUsers = false;
        this.showToast(
          "error",
          "Erreur lors du chargement des utilisateurs depuis l'API"
        );

        // Show empty state instead of fallback
        this.users = [];
        this.filteredUsers = [];
        this.cdr.detectChanges();
      },
    });
  }
  // ===== API DATA MAPPING METHODS =====
  private mapApiUsersToExtendedUsers(apiUsers: any[]): ExtendedUser[] {
    return apiUsers.map((user) => {
      // Split fullName into firstName and lastName
      const nameParts = (user.fullName || "").split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      return {
        id: user.id.toString(),
        username: user.email || "",
        firstName: firstName,
        lastName: lastName,
        email: user.email || "",
        role: "user" as any, // Use 'as any' to bypass type checking temporarily
        isActive: true,
        tasksCount: 0,
        lastActivity: undefined,
        avatar: undefined,
      };
    });
  }

  // ===== SETUP METHODS =====
  private setupSearchDebouncing(): void {
    this.userSearchSubject
        .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
        .subscribe((term) => {
          this.performUserSearch(term);
        });

    this.taskSearchSubject
        .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
        .subscribe((term) => {
          this.performTaskSearch(term);
        });

    this.appSearchSubject
        .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
        .subscribe((term) => {
          this.performAppSearch(term);
        });

    this.appTaskSearchSubject
        .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
        .subscribe((term) => {
          this.performAppTaskSearch(term);
        });
  }

  // ===== ADVANCED FILTERS =====
  applyAdvancedFilters(filters: any): void {
    console.log("Applied filters:", filters);

    // Ensure the selected user's ID is always included
    if (this.selectedUser) {
      filters.assigneeId = this.selectedUser.id;
    }

    this.advancedFilters = filters;

    // Show loading state
    this.loadingUserTasks = true;

    this.http
        .post<ProcessData[]>(
            `${environment.api2Url}/monitoring/processes`,
            filters
        )
        .subscribe({
          next: (data: ProcessData[]) => {
            console.log("Filtered processes for user:", data);

            // Map ProcessData response to ExtendedTask format
            this.userTasks = data.map((processData: ProcessData) => ({
              id:
                  processData.taskId ||
                  processData.processInstanceId ||
                  `task-${this.selectedUser?.id}-${Math.random()}`,
              processInstanceId: processData.processInstanceId,
              processDefinitionId: processData.processDefinitionId,
              name: `Task for ${processData.processDefinitionId}`,
              description: `Process initiated by ${processData.processInitiator}`,
              assignee: processData.assigneeId || this.selectedUser?.id || "",
              created: new Date(processData.processStartTime),
              dueDate: undefined,
              priority: 50,
              status: this.mapSuspensionStateToTaskStatus(
                  processData.suspensionState
              ),
              workflowName: processData.processDefinitionId,
              applicationName: processData.groupName || "N/A",
              processName: processData.processDefinitionId,
              assigneeName: processData.processInitiator,
              suspensionState: processData.suspensionState,

              type: "filtered",
              groupId: processData.groupId,
            }));

            this.filteredUserTasks = [...this.userTasks];
            this.selectedUserTasks = [];
            this.selectedUserTasksIds.clear();

            this.loadingUserTasks = false;
            this.showAdvancedFilterModal = false;
            this.updatePagination(); // Mettre à jour la pagination

            const userName = this.selectedUser
                ? `${this.selectedUser.firstName} ${this.selectedUser.lastName}`
                : "l'utilisateur";
            this.showToast(
                "success",
                `Filtres appliqués pour ${userName}: ${data.length} tâche(s) trouvée(s)`
            );
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error("Erreur lors du filtrage avancé :", err);
            this.loadingUserTasks = false;
            this.showAdvancedFilterModal = false;
            this.showToast("error", "Erreur lors de l'application des filtres");
            this.cdr.detectChanges();
          },
        });
  }

  // private loadUserTasks(userId: string): void {
  //   this.loadingUserTasks = true;
  //
  //   setTimeout(() => {
  //     this.userTasks = this.generateMockUserTasks(userId);
  //     this.filteredUserTasks = [...this.userTasks];
  //     this.selectedUserTasks = [];
  //     this.selectedUserTasksIds.clear();
  //     this.loadingUserTasks = false;
  //     this.cdr.detectChanges();
  //   }, 600);
  // }

  private loadUserApplications(userId: string): void {
    this.loadingUserApplications = true;

    setTimeout(() => {
      this.userApplications = this.generateMockUserApplications(userId);
      this.filteredUserApplications = [...this.userApplications];
      this.loadingUserApplications = false;
      this.cdr.detectChanges();
    }, 500);
  }

  private loadAppTasks(appId: string): void {
    this.loadingAppTasks = true;

    setTimeout(() => {
      this.appTasks = this.generateMockAppTasks(appId);
      this.filteredAppTasks = [...this.appTasks];
      this.selectedAppTasks = [];
      this.selectedAppTasksIds.clear();
      this.availableProcesses = this.extractAvailableProcesses();
      this.availableAssignees = this.extractAvailableAssignees();
      this.loadingAppTasks = false;
      this.cdr.detectChanges();
    }, 600);
  }

  // ===== MOCK DATA GENERATORS =====
  private generateMockUserTasks(userId: string): ExtendedTask[] {
    const taskTypes = [
      "approval",
      "review",
      "validation",
      "processing",
      "analysis",
    ];
    const statuses: Array<"assigned" | "pending" | "overdue" | "completed"> = [
      "assigned",
      "pending",
      "overdue",
      "completed",
    ];
    const workflows = [
      "Loan Approval",
      "Account Opening",
      "Document Review",
      "Risk Assessment",
    ];
    const applications = [
      "Banking App",
      "Loan System",
      "CRM",
      "Risk Management",
    ];

    const tasks: ExtendedTask[] = [];
    const taskCount = Math.floor(Math.random() * 10) + 5;

    for (let i = 0; i < taskCount; i++) {
      const task: ExtendedTask = {
        id: `task-${userId}-${i + 1}`,
        processInstanceId: `proc-${userId}-${i + 1}`,
        processDefinitionId: `def-${i + 1}`,
        name: `Tâche ${i + 1} - ${
            taskTypes[Math.floor(Math.random() * taskTypes.length)]
        }`,
        description: `Description de la tâche ${i + 1}`,
        assignee: userId,
        created: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        dueDate:
            Math.random() > 0.5
                ? new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000)
                : undefined,
        priority: Math.floor(Math.random() * 100),
        status: statuses[Math.floor(Math.random() * statuses.length)],
        workflowName: workflows[Math.floor(Math.random() * workflows.length)],
        applicationName:
            applications[Math.floor(Math.random() * applications.length)],
        processName: `Process ${i + 1}`,
        type: taskTypes[Math.floor(Math.random() * taskTypes.length)],
      };

      tasks.push(task);
    }

    return tasks;
  }

  private generateMockUserApplications(userId: string): UserApplication[] {
    const applications: UserApplication[] = [
      {
        id: "app-1",
        name: "Banking Operations",
        type: "workflow",
        status: "active",
        processCount: 15,
        taskCount: 8,
      },
      {
        id: "app-2",
        name: "Loan Management",
        type: "approval",
        status: "active",
        processCount: 12,
        taskCount: 5,
      },
      {
        id: "app-3",
        name: "Customer Onboarding",
        type: "form",
        status: "maintenance",
        processCount: 8,
        taskCount: 3,
      },
      {
        id: "app-4",
        name: "Risk Assessment",
        type: "processing",
        status: "active",
        processCount: 20,
        taskCount: 12,
      },
    ];

    return applications;
  }

  private generateMockAppTasks(appId: string): ExtendedTask[] {
    const taskTypes = [
      "approval",
      "review",
      "validation",
      "processing",
      "analysis",
    ];
    const statuses: Array<"assigned" | "pending" | "overdue" | "completed"> = [
      "assigned",
      "pending",
      "overdue",
      "completed",
    ];
    const processes = ["Process A", "Process B", "Process C", "Process D"];
    const assignees = [
      "Jean Dupont",
      "Marie Martin",
      "Pierre Durand",
      "Sophie Legrand",
    ];

    const tasks: ExtendedTask[] = [];
    const taskCount = Math.floor(Math.random() * 15) + 10;

    for (let i = 0; i < taskCount; i++) {
      const task: ExtendedTask = {
        id: `app-task-${appId}-${i + 1}`,
        processInstanceId: `proc-${appId}-${i + 1}`,
        processDefinitionId: `def-${i + 1}`,
        name: `Tâche App ${i + 1} - ${
            taskTypes[Math.floor(Math.random() * taskTypes.length)]
        }`,
        description: `Description de la tâche d'application ${i + 1}`,
        assignee: `user-${Math.floor(Math.random() * 4) + 1}`,
        created: new Date(
            Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000
        ),
        dueDate:
            Math.random() > 0.3
                ? new Date(Date.now() + Math.random() * 14 * 24 * 60 * 60 * 1000)
                : undefined,
        priority: Math.floor(Math.random() * 100),
        status: statuses[Math.floor(Math.random() * statuses.length)],
        workflowName: `Workflow ${Math.floor(Math.random() * 3) + 1}`,
        applicationName: `Application ${appId}`,
        processName: processes[Math.floor(Math.random() * processes.length)],
        assigneeName: assignees[Math.floor(Math.random() * assignees.length)],
        type: taskTypes[Math.floor(Math.random() * taskTypes.length)],
      };

      tasks.push(task);
    }

    return tasks;
  }

  private extractAvailableProcesses(): { id: string; name: string }[] {
    const processes = new Set<string>();
    this.appTasks.forEach((task) => processes.add(task.processName));
    return Array.from(processes).map((name, index) => ({
      id: `proc-${index}`,
      name,
    }));
  }

  private extractAvailableAssignees(): { id: string; name: string }[] {
    const assignees = new Set<string>();
    this.appTasks.forEach((task) => {
      if (task.assigneeName) assignees.add(task.assigneeName);
    });
    return Array.from(assignees).map((name, index) => ({
      id: `user-${index}`,
      name,
    }));
  }

  // ===== SEARCH METHODS =====

  onUserSearch(): void {
    this.userSearchSubject.next(this.userSearchTerm);
    this.showUserSearchHistory =
        this.userSearchTerm.length === 0 && this.userSearchHistory.length > 0;
  }

  private performUserSearch(term: string): void {
    if (term.trim()) {
      this.addToSearchHistory(term);
      this.filteredUsers = this.users.filter(
        (user) =>
          user.firstName.toLowerCase().includes(term.toLowerCase()) ||
          user.lastName.toLowerCase().includes(term.toLowerCase()) ||
          user.email.toLowerCase().includes(term.toLowerCase())
      );
    } else {
      this.filteredUsers = []; // Show nothing if search is empty
    }
    this.applyUserFilters();
  }

  onTaskSearch(): void {
    this.taskSearchSubject.next(this.taskSearchTerm);
  }

  private performTaskSearch(term: string): void {
    if (term.trim()) {
      this.filteredUserTasks = this.userTasks.filter(
          (task) =>
              task.name.toLowerCase().includes(term.toLowerCase()) ||
              task.workflowName.toLowerCase().includes(term.toLowerCase()) ||
              task.applicationName.toLowerCase().includes(term.toLowerCase())
      );
    } else {
      this.filteredUserTasks = [...this.userTasks];
    }
    this.applyTaskFilters();
    this.currentPage = 1;
    this.updatePagination();
  }

  onAppSearch(): void {
    this.appSearchSubject.next(this.appSearchTerm);
  }

  private performAppSearch(term: string): void {
    if (term.trim()) {
      this.filteredUserApplications = this.userApplications.filter((app) =>
          app.name.toLowerCase().includes(term.toLowerCase())
      );
    } else {
      this.filteredUserApplications = [...this.userApplications];
    }
    this.applyAppFilters();
  }

  onAppTaskSearch(): void {
    this.appTaskSearchSubject.next(this.appTaskSearchTerm);
  }

  private performAppTaskSearch(term: string): void {
    if (term.trim()) {
      this.filteredAppTasks = this.appTasks.filter(
          (task) =>
              task.name.toLowerCase().includes(term.toLowerCase()) ||
              task.processName.toLowerCase().includes(term.toLowerCase()) ||
              (task.assigneeName &&
                  task.assigneeName.toLowerCase().includes(term.toLowerCase()))
      );
    } else {
      this.filteredAppTasks = [...this.appTasks];
    }
    this.applyAppTaskFilters();
  }

  clearUserSearch(): void {
    this.userSearchTerm = "";
    this.showUserSearchHistory = false;
    this.performUserSearch("");
  }

  selectSearchHistory(term: string): void {
    this.userSearchTerm = term;
    this.showUserSearchHistory = false;
    this.performUserSearch(term);
  }

  clearAppSearch() {
    this.appSearchTerm = "";
    this.onAppSearch();
    this.showAppSearchHistory = false;
  }

  selectAppSearchHistory(term: string) {
    this.appSearchTerm = term;
    this.onAppSearch();
    this.showAppSearchHistory = false;
  }

  private addToSearchHistory(term: string): void {
    if (!this.userSearchHistory.includes(term)) {
      this.userSearchHistory.unshift(term);
      if (this.userSearchHistory.length > 5) {
        this.userSearchHistory.pop();
      }
      this.saveUserSearchHistory();
    }
  }

  private loadUserSearchHistory(): void {
    const saved = localStorage.getItem("user-search-history");
    if (saved) {
      this.userSearchHistory = JSON.parse(saved);
    }
  }

  private saveUserSearchHistory(): void {
    localStorage.setItem(
        "user-search-history",
        JSON.stringify(this.userSearchHistory)
    );
  }

  // ===== FILTER METHODS =====
  applyUserFilters(): void {
    let filtered = [...this.filteredUsers];

    if (this.userStatusFilter) {
      filtered = filtered.filter((user) =>
          this.userStatusFilter === "active" ? user.isActive : !user.isActive
      );
    }

    if (this.userTasksFilter) {
      filtered = filtered.filter((user) => {
        const count = user.tasksCount;
        switch (this.userTasksFilter) {
          case "0":
            return count === 0;
          case "1-5":
            return count >= 1 && count <= 5;
          case "6-10":
            return count >= 6 && count <= 10;
          case "10+":
            return count > 10;
          default:
            return true;
        }
      });
    }

    this.filteredUsers = filtered;
    this.sortUsers();
  }

  applyTaskFilters(): void {
    let filtered = [...this.filteredUserTasks];

    if (this.taskStatusFilter) {
      filtered = filtered.filter(
          (task) => task.status === this.taskStatusFilter
      );
    }

    if (this.taskPriorityFilter) {
      filtered = filtered.filter(
          (task) =>
              this.getPriorityFromNumber(task.priority) === this.taskPriorityFilter
      );
    }

    this.filteredUserTasks = filtered; // Always assign, never push/concat
    this.sortTasks();
    this.currentPage = 1;
    this.updatePagination();
  }

  applyAppFilters(): void {
    let filtered = [...this.filteredUserApplications];

    if (this.appStatusFilter) {
      filtered = filtered.filter((app) => app.status === this.appStatusFilter);
    }

    if (this.appTasksFilter) {
      filtered = filtered.filter((app) => {
        const count = app.taskCount;
        switch (this.appTasksFilter) {
          case "0":
            return count === 0;
          case "1-5":
            return count >= 1 && count <= 5;
          case "6-10":
            return count >= 6 && count <= 10;
          case "10+":
            return count > 10;
          default:
            return true;
        }
      });
    }

    this.filteredUserApplications = filtered;
  }

  applyAppTaskFilters(): void {
    let filtered = [...this.filteredAppTasks];

    if (this.appTaskProcessFilter) {
      const processName = this.availableProcesses.find(
          (p) => p.id === this.appTaskProcessFilter
      )?.name;
      if (processName) {
        filtered = filtered.filter((task) => task.processName === processName);
      }
    }

    if (this.appTaskAssigneeFilter) {
      const assigneeName = this.availableAssignees.find(
          (a) => a.id === this.appTaskAssigneeFilter
      )?.name;
      if (assigneeName) {
        filtered = filtered.filter(
            (task) => task.assigneeName === assigneeName
        );
      }
    }

    if (this.appTaskStatusFilter) {
      if (this.appTaskStatusFilter === "overdue") {
        filtered = filtered.filter(
            (task) => task.dueDate && this.isOverdue(task.dueDate)
        );
      } else {
        filtered = filtered.filter(
            (task) => task.status === this.appTaskStatusFilter
        );
      }
    }

    this.filteredAppTasks = filtered;
  }

  // ===== SORT METHODS =====
  sortUsers(): void {
    this.filteredUsers.sort((a, b) => {
      switch (this.userSortBy) {
        case "name-asc":
          return `${a.firstName} ${a.lastName}`.localeCompare(
              `${b.firstName} ${b.lastName}`
          );
        case "name-desc":
          return `${b.firstName} ${b.lastName}`.localeCompare(
              `${a.firstName} ${a.lastName}`
          );
        case "tasks-desc":
          return b.tasksCount - a.tasksCount;
        case "tasks-asc":
          return a.tasksCount - b.tasksCount;
        case "activity-desc":
          return (
              (b.lastActivity?.getTime() || 0) - (a.lastActivity?.getTime() || 0)
          );
        default:
          return 0;
      }
    });
  }

  sortTasks(): void {
    this.filteredUserTasks.sort((a, b) => {
      switch (this.taskSortBy) {
        case "created-desc":
          return b.created.getTime() - a.created.getTime();
        case "created-asc":
          return a.created.getTime() - b.created.getTime();
        case "priority-desc":
          return b.priority - a.priority;
        case "name-asc":
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
  }

  // ===== SELECTION METHODS =====
  selectUser(user: ExtendedUser): void {
    this.selectedUser = user;
    this.selectedApplication = null;

    // Automatically set the user ID in advanced filters
    this.advancedFilters = {
      ...this.advancedFilters,
      assigneeId: user.id,
    };

    // Load user tasks with the API using the user ID
    this.loadUserTasksFromAPI(user.id);
    this.loadUserApplications(user.id);
  }
  private loadUserTasksFromAPI(userId: string): void {
    this.loadingUserTasks = true;

    // Prepare filters with the user ID
    const filters = {
      ...this.advancedFilters,
      assigneeId: userId,
    };

    this.http
        .post<ProcessData[]>(
            `${environment.api2Url}/monitoring/processes`,
            filters
        )
        .subscribe({
          next: (data: ProcessData[]) => {
            console.log("User tasks from API:", data);

            // Map the ProcessData response to ExtendedTask format
            this.userTasks = data.map((processData: ProcessData) => ({
              id:
                  processData.taskId ||
                  processData.processInstanceId ||
                  `task-${userId}-${Math.random()}`,
              processInstanceId: processData.processInstanceId,
              processDefinitionId: processData.processDefinitionId,
              name: `Task for ${processData.processDefinitionId}`,
              description: `Process task initiated by ${processData.processInitiator}`,
              assignee: processData.assigneeId || userId,
              created: new Date(processData.processStartTime),
              dueDate: undefined, // ProcessData doesn't have dueDate, you might need to calculate or set default
              priority: 50, // Default priority as ProcessData doesn't have this field
              status: this.mapSuspensionStateToTaskStatus(
                  processData.suspensionState
              ),
              workflowName: processData.processDefinitionId,
              applicationName: "Process Application", // Default value as ProcessData doesn't have this
              processName: processData.processDefinitionId,
              assigneeName: processData.processInitiator,
              type: "processing",
              suspensionState: processData.suspensionState,

              groupId: processData.groupId,
            }));

            this.filteredUserTasks = [...this.userTasks]; // Always assign, never push/concat
            this.selectedUserTasks = [];
            this.selectedUserTasksIds.clear();
            this.loadingUserTasks = false;

            this.currentPage = 1;
            this.updatePagination();

            this.showToast(
                "success",
                `${this.userTasks.length} tâche(s) chargée(s) pour ${this.selectedUser?.firstName} ${this.selectedUser?.lastName}`
            );
            this.cdr.detectChanges();
          },
          error: (error) => {
            console.error(
                "Erreur lors du chargement des tâches utilisateur:",
                error
            );
            this.loadingUserTasks = false;

            // Fallback to empty state
            this.userTasks = [];
            this.filteredUserTasks = [];
            this.selectedUserTasks = [];
            this.selectedUserTasksIds.clear();

            this.showToast(
                "error",
                "Erreur lors du chargement des tâches utilisateur depuis l'API"
            );
            this.cdr.detectChanges();
          },
        });
  }
  private mapSuspensionStateToTaskStatus(
      suspensionState?: number
  ): "assigned" | "pending" | "overdue" | "completed" {
    if (suspensionState === undefined || suspensionState === null) {
      return "assigned"; // Default to assigned if no suspension state
    }

    switch (suspensionState) {
      case 1:
        return "pending"; // Suspended
      case 2:
        return "completed"; // Completed
      case 0:
      default:
        return "assigned"; // Active/Running
    }
  }

  selectApplication(app: UserApplication): void {
    this.selectedApplication = app;
    this.loadAppTasks(app.id);
  }

  selectTask(task: ExtendedTask): void {
    this.selectedTaskDetails = task;
    this.showTaskDetailsModal = true;
  }

  // ===== BULK SELECTION METHODS =====
  toggleUserTaskSelection(taskId: string): void {
    if (this.selectedUserTasksIds.has(taskId)) {
      this.selectedUserTasksIds.delete(taskId);
    } else {
      this.selectedUserTasksIds.add(taskId);
    }
    this.updateSelectedUserTasks();
  }

  toggleAllUserTasks(): void {
    if (this.isAllUserTasksSelected()) {
      this.selectedUserTasksIds.clear();
    } else {
      this.filteredUserTasks.forEach((task) =>
          this.selectedUserTasksIds.add(task.id)
      );
    }
    this.updateSelectedUserTasks();
  }

  isAllUserTasksSelected(): boolean {
    return (
        this.filteredUserTasks.length > 0 &&
        this.filteredUserTasks.every((task) =>
            this.selectedUserTasksIds.has(task.id)
        )
    );
  }

  isSomeUserTasksSelected(): boolean {
    return this.selectedUserTasksIds.size > 0 && !this.isAllUserTasksSelected();
  }

  private updateSelectedUserTasks(): void {
    this.selectedUserTasks = this.filteredUserTasks.filter((task) =>
        this.selectedUserTasksIds.has(task.id)
    );
  }

  toggleAppTaskSelection(taskId: string): void {
    if (this.selectedAppTasksIds.has(taskId)) {
      this.selectedAppTasksIds.delete(taskId);
    } else {
      this.selectedAppTasksIds.add(taskId);
    }
    this.updateSelectedAppTasks();
  }

  toggleAllAppTasks(): void {
    if (this.isAllAppTasksSelected()) {
      this.selectedAppTasksIds.clear();
    } else {
      this.filteredAppTasks.forEach((task) =>
          this.selectedAppTasksIds.add(task.id)
      );
    }
    this.updateSelectedAppTasks();
  }

  isAllAppTasksSelected(): boolean {
    return (
        this.filteredAppTasks.length > 0 &&
        this.filteredAppTasks.every((task) =>
            this.selectedAppTasksIds.has(task.id)
        )
    );
  }

  isSomeAppTasksSelected(): boolean {
    return this.selectedAppTasksIds.size > 0 && !this.isAllAppTasksSelected();
  }

  private updateSelectedAppTasks(): void {
    this.selectedAppTasks = this.filteredAppTasks.filter((task) =>
        this.selectedAppTasksIds.has(task.id)
    );
  }

  // ===== BULK ACTIONS METHODS =====
  openBulkActionsModal(context: string): void {
    this.bulkActionContext = context;
    this.showBulkActionsModal = true;
  }

  closeBulkActionsModal(): void {
    this.showBulkActionsModal = false;
    this.bulkActionContext = "";
  }

  getSelectedItems(): any[] {
    switch (this.bulkActionContext) {
      case "user-tasks":
        return this.selectedUserTasks;
      case "app-tasks":
        return this.selectedAppTasks;
      default:
        return [];
    }
  }

  getAvailableActions(): string[] {
    return [
      "resume",
      "suspend",
      "stop",
      "transfer",
      "change-priority",
      "set-due-date",
    ];
  }
  openBulkTransferModal(): void {
    this.taskToTransfer = this.selectedUserTasks; // All selected tasks
    this.showTransferModal = true;
  }
  // ...existing code...
  onBulkActionExecuted(action: string): void {
    const selectedTasks = this.selectedUserTasks;
    let completed = 0;
    const afterAll = () => {
      if (++completed === selectedTasks.length) {
        this.selectedUserTasksIds.clear();
        this.updateSelectedUserTasks();
        this.refreshCurrentData();
        this.closeBulkActionsModal();
      }
    };

    selectedTasks.forEach((task) => {
      switch (action) {
        case "resume":
          this.tasksService
              .ResumeProcess(task.processInstanceId, task.assignee || "")
              .subscribe({
                next: (success) => {
                  this.showToast(
                      success ? "success" : "error",
                      success
                          ? `Processus ${task.processInstanceId} repris`
                          : `Échec de la reprise du processus ${task.processInstanceId}`
                  );
                  afterAll();
                },
                error: () => {
                  this.showToast(
                      "error",
                      `Erreur lors de la reprise du processus ${task.processInstanceId}`
                  );
                  afterAll();
                },
              });
          break;
        case "suspend":
          this.tasksService
              .SuspendProcess(task.processInstanceId, task.assignee || "")
              .subscribe({
                next: (success) => {
                  this.showToast(
                      success ? "success" : "error",
                      success
                          ? `Processus ${task.processInstanceId} suspendu`
                          : `Échec de la suspension du processus ${task.processInstanceId}`
                  );
                  afterAll();
                },
                error: () => {
                  this.showToast(
                      "error",
                      `Erreur lors de la suspension du processus ${task.processInstanceId}`
                  );
                  afterAll();
                },
              });
          break;
        case "terminate":
          this.tasksService.TerminateProcess(task.processInstanceId, task.assignee || "").subscribe({
            next: (success) => {
              this.showToast(
                  success ? "success" : "error",
                  success
                      ? `Processus ${task.processInstanceId} arrêté`
                      : `Échec de l'arrêt du processus ${task.processInstanceId}`
              );
              afterAll();
            },
            error: () => {
              this.showToast(
                  "error",
                  `Erreur lors de l'arrêt du processus ${task.processInstanceId}`
              );
              afterAll();
            },
          });
          break;
        case "transfer":
          this.taskToTransfer = selectedTasks;
          this.showTransferModal = true;
          afterAll();
          break;
        default:
          afterAll();
          break;
      }
    });
  }
  // ...existing code...

  // ===== INDIVIDUAL TASK ACTIONS =====
  toggleTaskStatus(task: ExtendedTask): void {
    // 2 = suspended, 1 = active
    const isSuspended = task.suspensionState === 2;

    const action$ = isSuspended
        ? this.tasksService.ResumeProcess(
            task.processInstanceId,
            task.assignee || ""
        )
        : this.tasksService.SuspendProcess(
            task.processInstanceId,
            task.assignee || ""
        );

    action$.subscribe({
      next: (success) => {
        const actionText = isSuspended ? "repris" : "suspendu";
        if (success) {
          // Update local state
          task.suspensionState = isSuspended ? 1 : 2;
          task.status = isSuspended ? "assigned" : "pending";
          this.showToast(
              "success",
              `Processus ${actionText} - Tâche ${task.id} mise à jour.`
          );
          if (this.selectedUser) {
            this.loadUserTasksFromAPI(this.selectedUser.id);
          }
        } else {
          this.showToast(
              "error",
              `Échec de la ${actionText} du processus ${task.processInstanceId}.`
          );
        }
      },
      error: (error) => {
        const actionText = isSuspended ? "reprendre" : "suspendre";
        this.showToast(
            "error",
            `Impossible de ${actionText} le processus ${task.processInstanceId}.`
        );
      },
    });
  }
  stopTask(task: ExtendedTask): void {
    if (confirm("Êtes-vous sûr de vouloir arrêter cette tâche ?")) {
      // Use the assignee as the original initiator ID (adjust if you have a more accurate field)
      const originalInitiatorId = task.assignee || "";

      this.tasksService.TerminateProcess(task.processInstanceId, originalInitiatorId).subscribe({
        next: (success) => {
          if (success) {
            // Update the task status locally
            task.status = "completed";

            this.showToast(
                "success",
                `Processus terminé - Tâche ${task.id} arrêtée avec succès.`
            );

            // Optionally refresh the user tasks data
            if (this.selectedUser) {
              this.loadUserTasksFromAPI(this.selectedUser.id);
            }
          } else {
            this.showToast(
                "error",
                `Échec de la terminaison du processus ${task.processInstanceId}.`
            );
          }
        },
        error: (error) => {
          console.error("Error terminating task:", error);
          this.showToast(
              "error",
              `Impossible de terminer le processus ${task.processInstanceId}.`
          );
        },
      });
    }
  }
  transferTask(task: ExtendedTask): void {
    this.taskToTransfer = [task]; // Only one instance
    this.showTransferModal = true;
  }

  viewTaskDetails(task: ExtendedTask): void {
    this.selectedTaskDetails = task;
    this.showTaskDetailsModal = true;
  }

  viewTaskHistory(task: ExtendedTask): void {
    this.showToast(
        "info",
        "Fonctionnalité d'historique en cours de développement"
    );
  }

  // ===== TRANSFER MODAL METHODS =====
  closeTransferModal(): void {
    this.showTransferModal = false;
    this.taskToTransfer = null;
  }

  onTaskTransferred(assignment: TaskAssignment | TaskAssignment[]): void {
    const assignments = Array.isArray(assignment) ? assignment : [assignment];

    assignments.forEach((a) => {
      const assignee = a.assigneeId || a.assigneeType;
      this.showToast("success", `Tâche ${a.taskId} transférée à ${assignee}`);
    });

    this.closeTransferModal();
    this.refreshCurrentData();
  }

  // ===== TASK DETAILS MODAL METHODS =====
  closeTaskDetailsModal(): void {
    this.showTaskDetailsModal = false;
    this.selectedTaskDetails = null;
  }

  // ===== MOBILE NAVIGATION =====
  setActiveColumn(column: string): void {
    this.activeColumn = column;

    // Update CSS classes for mobile view
    const columnsContainer = document.querySelector(".monitoring-columns");
    if (columnsContainer) {
      columnsContainer.className = `monitoring-columns show-${column}`;
    }
  }

  // ===== UTILITY METHODS =====
  trackByUserId(index: number, user: ExtendedUser): string {
    return user.id;
  }

  trackByTaskId(index: number, task: ExtendedTask): string {
    return task.id;
  }

  trackByAppId(index: number, app: UserApplication): string {
    return app.id;
  }

  getInitials(firstName: string, lastName: string): string {
    const first = firstName ? firstName.charAt(0).toUpperCase() : "";
    const last = lastName ? lastName.charAt(0).toUpperCase() : "";

    if (first && last) {
      return first + last;
    } else if (first) {
      return first + first;
    } else if (last) {
      return last + last;
    } else {
      return "U";
    }
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  isOverdue(dueDate: Date): boolean {
    return dueDate < new Date();
  }

  getTaskIcon(type: string): string {
    const icons: { [key: string]: string } = {
      approval: "check_circle",
      review: "rate_review",
      validation: "verified",
      processing: "settings",
      analysis: "analytics",
    };
    return icons[type] || "assignment";
  }

  getAppIcon(type: string): string {
    const icons: { [key: string]: string } = {
      workflow: "account_tree",
      form: "description",
      approval: "approval",
      processing: "settings_applications",
    };
    return icons[type] || "apps";
  }

  getPriorityLabel(priority: number): string {
    if (priority >= 75) return "Haute";
    if (priority >= 50) return "Moyenne";
    return "Basse";
  }

  private getPriorityFromNumber(priority: number): string {
    if (priority >= 75) return "high";
    if (priority >= 50) return "medium";
    return "low";
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      assigned: "Assigné",
      pending: "En attente",
      completed: "Terminé",
      overdue: "En retard",
    };
    return labels[status] || status;
  }

  getAppStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      active: "Active",
      inactive: "Inactive",
      maintenance: "Maintenance",
    };
    return labels[status] || status;
  }

  getToastIcon(type: string): string {
    const icons: { [key: string]: string } = {
      success: "check_circle",
      error: "error",
      warning: "warning",
      info: "info",
    };
    return icons[type] || "info";
  }

  // ===== TOAST METHODS =====
  showToast(
      type: "success" | "error" | "warning" | "info",
      message: string
  ): void {
    const toast: Toast = {
      id: Date.now().toString(),
      type,
      message,
      title: "",
      duration: 0,
    };

    this.toasts.push(toast);

    // Auto remove after 5 seconds
    setTimeout(() => {
      this.removeToast(toast.id);
    }, 5000);
  }

  removeToast(id: string): void {
    this.toasts = this.toasts.filter((toast) => toast.id !== id);
  }

  // ===== REFRESH METHODS =====
  private refreshCurrentData(): void {
    if (this.selectedUser) {
      this.loadUserTasksFromAPI(this.selectedUser.id);
    }
    if (this.selectedApplication) {
      this.loadAppTasks(this.selectedApplication.id);
    }
  }

  // ===== REFRESH USERS METHOD =====
  refreshUsers(): void {
    this.loadUsers();
  }

  // ===== PAGINATION METHODS =====
  /**
   * Met à jour la pagination après changement de données
   */
  updatePagination(): void {
    // Ensure pageSize is at least 1
    if (!this.pageSize || this.pageSize < 1) {
      this.pageSize = 5; // Default to 5 if invalid
    }

    // Calculate total pages
    this.totalPages = Math.max(
        1,
        Math.ceil(this.filteredUserTasks.length / this.pageSize)
    );

    // Ensure current page is valid
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }

    // Calculate tasks to display for current page
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = Math.min(
        startIndex + this.pageSize,
        this.filteredUserTasks.length
    );

    // Create a new array with only the tasks for the current page
    this.paginatedTasks = this.filteredUserTasks.slice(startIndex, endIndex);

    // Update UI elements
    this.calculateVisiblePageNumbers();
    this.updatePaginationInfo();

    // Force change detection
    this.cdr.detectChanges();
  }

  /**
   * Calcule les numéros de pages à afficher
   */
  private calculateVisiblePageNumbers(): void {
    this.visiblePageNumbers = [];

    if (this.totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= this.totalPages; i++) {
        this.visiblePageNumbers.push(i);
      }
    } else {
      // Complex logic for many pages
      if (this.currentPage <= 4) {
        // Beginning: 1 2 3 4 5 ... last
        for (let i = 1; i <= 5; i++) {
          this.visiblePageNumbers.push(i);
        }
        this.visiblePageNumbers.push(-1); // ellipsis
        this.visiblePageNumbers.push(this.totalPages);
      } else if (this.currentPage >= this.totalPages - 3) {
        // End: 1 ... total-4 total-3 total-2 total-1 total
        this.visiblePageNumbers.push(1);
        this.visiblePageNumbers.push(-1); // ellipsis
        for (let i = this.totalPages - 4; i <= this.totalPages; i++) {
          this.visiblePageNumbers.push(i);
        }
      } else {
        // Middle: 1 ... current-1 current current+1 ... last
        this.visiblePageNumbers.push(1);
        this.visiblePageNumbers.push(-1); // ellipsis
        for (let i = this.currentPage - 1; i <= this.currentPage + 1; i++) {
          this.visiblePageNumbers.push(i);
        }
        this.visiblePageNumbers.push(-1); // ellipsis
        this.visiblePageNumbers.push(this.totalPages);
      }
    }
  }

  /**
   * Met à jour le texte d'information de paginationnation
   */
  private updatePaginationInfo(): void {
    if (this.filteredUserTasks.length === 0) {
      this.paginationInfo = "Aucune tâche à afficher";
      return;
    }

    const startItem = (this.currentPage - 1) * this.pageSize + 1;
    let endItem = Math.min(
        this.currentPage * this.pageSize,
        this.filteredUserTasks.length
    );

    this.paginationInfo = `Affichage ${startItem} à ${endItem} sur ${this.filteredUserTasks.length} tâches`;
    this.paginationInfo = `Affichage ${startItem} à ${endItem} sur ${this.filteredUserTasks.length} tâches`;
  }

  /**
   * Navigue vers la page suivante
   */
  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  /**
   * Navigue vers la page précédente
   */
  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  /**
   * Navigue vers une page spécifique
   * @param page - Numéro de la page
   */
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  /**
   * Gère le changement de taille de page
   */
  onPageSizeChange(): void {
    // Preserve position context by tracking the first visible item
    const firstVisibleItemIndex = (this.currentPage - 1) * this.pageSize;

    // Calculate new current page based on the first visible item
    this.currentPage = Math.floor(firstVisibleItemIndex / this.pageSize) + 1;

    // Ensure current page is valid with new page size
    if (
        this.currentPage >
        Math.ceil(this.filteredUserTasks.length / this.pageSize)
    ) {
      this.currentPage = Math.max(
          1,
          Math.ceil(this.filteredUserTasks.length / this.pageSize)
      );
    }

    // Update pagination with new page size and current page
    this.updatePagination();
  }
}

