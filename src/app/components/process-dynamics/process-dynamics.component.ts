import { Component, OnInit, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule, ReactiveFormsModule, FormControl } from "@angular/forms";
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from "rxjs";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../../environments/environment";
// Components
import { TaskTransferModalComponent } from "../../shared/components/task-transfer-modal/task-transfer-modal.component";
import { BulkActionsModalComponent } from "../../shared/components/bulk-actions-modal/bulk-actions-modal.component";
import { ConfirmDialogComponent } from "../../shared/components/confirm-dialog/confirm-dialog.component";
import { ToastNotificationComponent } from "../../shared/components/toast-notification/toast-notification.component";
// Models and Services
import { Task, TaskAssignment } from "../../core/models/task.model";
import { ToastService } from "../../core/services/toast.service";
import { TasksService } from "../../core/services/tasks.service";
// Interfaces
interface ProcessItem {
  id: string;
  name: string;
  description: string;
  type: string;
  category: string;
}

interface TaskItem {
  id: string;
  name: string;
  description: string;
  status: "active" | "suspended" | "completed" | "failed" | "pending";
  activeInstances: number;
  processId: string;
}

interface ResultItem {
  id: string;
  deploymentName: string;
  processInstanceIdName: string;
  taskName: string | null;
  taskAssignee: string | null;
  taskStatus: string;
  // Add these fields for actions and transfer
  processInstanceId: string;
  processDefinitionId: string;
  // Add processStartedBy for originalInitiatorId
  processStartedBy: string;
  // Optionally: definitionDescription, startTime, initiator, etc.
}

interface StatusOption {
  value: string;
  label: string;
}

interface Toast {
  id: string;
  title: string;
  message: string;
  type: "success" | "error" | "warning" | "info";
  duration?: number;
}

@Component({
  selector: "app-process-dynamics",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TaskTransferModalComponent,
    BulkActionsModalComponent,
    ConfirmDialogComponent,
    ToastNotificationComponent,
  ],
  templateUrl: "./process-dynamics.component.html",
  styleUrls: ["./process-dynamics.component.scss"],
})
export class ProcessDynamicsComponent implements OnInit, OnDestroy {
  // Expose Math for template
  Math = Math;

  private destroy$ = new Subject<void>();
  private processSearchSubject = new Subject<string>();
  private taskSearchSubject = new Subject<string>();
  private globalSearchSubject = new Subject<string>();
  private processDefinitionsCache: any[] = [];
  private lastDefinitionsFetchTime: number = 0;
  private filterResultsCache = new Map<
    string,
    { results: ResultItem[]; timestamp: number }
  >();
  // ===== LOADING STATE =====
  loading = true;

  // ===== FILTER STATE =====
  filtersApplied = false;
  processSearchTerm = "";
  taskSearchTerm = "";
  globalSearchTerm = "";
  startDate = "";
  endDate = "";
  dateRangeError = "";
  applyingFilters = false;

  // ===== AUTOCOMPLETE STATE =====
  showProcessSuggestions = false;
  showTaskSuggestions = false;
  processSuggestions: ProcessItem[] = [];
  taskSuggestions: TaskItem[] = [];
  filteredProcessInstances: any[] = [];

  // ===== SELECTION STATE =====
  selectedProcess: ProcessItem | null = null;
  selectedTasks: TaskItem[] = [];
  selectedStatuses: string[] = [];
  selectedItems = new Set<string>();

  // ===== RESULTS STATE =====
  allResults: ResultItem[] = [];
  filteredResults: ResultItem[] = [];
  paginatedResults: ResultItem[] = [];
  // Ajout de filteredData pour corriger l'erreur
  filteredData: ResultItem[] = [];

  // ===== PAGINATION STATE =====
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  visiblePageNumbers: number[] = [];

  // ===== SORTING STATE =====
  sortField = "";
  sortDirection: "asc" | "desc" = "asc";

  // ===== MODAL STATE =====
  showTransferModal = false;
  showBulkActionsModal = false;
  showConfirmDialog = false;
  taskToTransfer: Task | Task[] | null = null;
  confirmDialogConfig = {
    title: "",
    message: "",
    confirmText: "Confirmer",
    cancelText: "Annuler",
    icon: "help_outline",
    iconColor: "#f59e0b",
    theme: "",
  };

  // ===== TOAST STATE =====
  toasts: Toast[] = [];

  // ===== FORM CONTROLS =====
  processDefinitionControl = new FormControl("");

  // ===== DROPDOWN STATE =====
  showDefinitionDropdown = false;
  filteredDefs: any[] = [];
  processDefinitions: any[] = [];
  selectedDefinition: any = null; // Add this property

  availableProcesses: ProcessItem[] = [];

  availableTasks: TaskItem[] = [];

  availableStatuses: StatusOption[] = [
    { value: "active", label: "En cours" },
    { value: "suspended", label: "Suspendu" },
    { value: "completed", label: "Terminé" },
  ];

  // ===== UI STATE PROPERTIES =====
  showFilters = true;

  constructor(
    private toastService: ToastService,
    private http: HttpClient,
    private tasksService: TasksService
  ) {
    this.setupSearchDebouncing();
  }

  ngOnInit(): void {
    // Simulate initial loading
    setTimeout(() => {
      this.loading = false;
    }, 1500);

    // Load process definitions
    this.loadProcessDefinitions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ===== SETUP METHODS =====
  private setupSearchDebouncing(): void {
    this.processSearchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((term) => {
        this.onProcessInstanceSearch(term);
      });

    this.taskSearchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((term) => {
        this.onTaskSearch();
      });

    this.globalSearchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((term) => {
        this.performGlobalSearch(term);
      });
  }

  // ===== PAGINATION METHODS =====
  // Méthode complètement revue pour garantir une pagination correcte
  updatePagination(): void {
    // Synchroniser filteredData avec filteredResults
    this.filteredData = [...this.filteredResults];

    // Calculer le nombre total de pages
    this.totalPages = Math.max(
      1,
      Math.ceil(this.filteredData.length / this.pageSize)
    );

    // S'assurer que la page courante est valide
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }

    // Calculer les indices de début et de fin pour la page courante
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = Math.min(
      startIndex + this.pageSize,
      this.filteredData.length
    );

    // Extraire les éléments pour la page courante
    this.paginatedResults = this.filteredData.slice(startIndex, endIndex);

    // Calculer les numéros de page visibles
    this.calculateVisiblePageNumbers();
  }

  // Nouvelle méthode pour calculer les numéros de page visibles
  calculateVisiblePageNumbers(): void {
    this.visiblePageNumbers = [];

    if (this.totalPages <= 7) {
      // Montrer toutes les pages si 7 ou moins
      for (let i = 1; i <= this.totalPages; i++) {
        this.visiblePageNumbers.push(i);
      }
    } else {
      // Logique complexe pour de nombreuses pages
      if (this.currentPage <= 4) {
        // Début: 1 2 3 4 5 ... dernier
        for (let i = 1; i <= 5; i++) {
          this.visiblePageNumbers.push(i);
        }
        this.visiblePageNumbers.push(-1); // ellipsis
        this.visiblePageNumbers.push(this.totalPages);
      } else if (this.currentPage >= this.totalPages - 3) {
        // Fin: 1 ... total-4 total-3 total-2 total-1 total
        this.visiblePageNumbers.push(1);
        this.visiblePageNumbers.push(-1); // ellipsis
        for (let i = this.totalPages - 4; i <= this.totalPages; i++) {
          this.visiblePageNumbers.push(i);
        }
      } else {
        // Milieu: 1 ... current-1 current current+1 ... dernier
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

  // Méthode pour aller à la page suivante
  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  // Méthode pour aller à la page précédente
  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  // Méthode pour aller à une page spécifique
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  // Méthode pour gérer le changement de taille de page
  onPageSizeChange(): void {
    // Mémoriser le premier élément sur la page courante
    const firstItemIndex = (this.currentPage - 1) * this.pageSize;

    // Calculer quelle page contiendra cet élément avec la nouvelle taille de page
    this.currentPage = Math.floor(firstItemIndex / this.pageSize) + 1;

    // Mettre à jour la pagination
    this.updatePagination();
  }

  // ===== SEARCH METHODS =====
  onProcessSearch(): void {
    this.processSearchSubject.next(this.processSearchTerm);
  }

  onProcessInputKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter" && this.processSearchTerm.trim()) {
      // Add manual process entry
      const manualProcess: ProcessItem = {
        id: "manual-" + Date.now(),
        name: this.processSearchTerm.trim(),
        description: "",
        type: "generic",
        category: "",
      };
      this.selectProcess(manualProcess);
      event.preventDefault();
    }
  }

  onTaskSearch(): void {
    // If term is empty, show all proposals for current context
    const term = this.taskSearchTerm;
    if (!term.trim()) {
      // If process instance is selected, show all tasks for that instance
      if (this.selectedProcess && this.selectedProcess.id) {
        let foundInstance: any = null;
        for (const def of this.processDefinitions) {
          foundInstance = def.processInstances?.find(
            (inst: any) => inst.processInstanceId === this.selectedProcess!.id
          );
          if (foundInstance) break;
        }
        if (foundInstance && foundInstance.tasks) {
          this.taskSuggestions = foundInstance.tasks
            .filter(
              (task: any) => !!task.taskName && task.taskName.trim() !== ""
            )
            .map((task: any) => ({
              id: task.taskId,
              name: task.taskName,
              description: task.taskDescription ?? "",
              status: (task.taskStatus ?? "active").toLowerCase(),
              activeInstances: 0,
              processId: foundInstance.processInstanceId,
            }));
          return;
        }
      }
      // If only deployment is selected, show all tasks for that deployment
      if (this.selectedDefinition && this.selectedDefinition.deploymentName) {
        const def = this.processDefinitions.find(
          (d) => d.deploymentName === this.selectedDefinition!.deploymentName
        );
        let allTasks: any[] = [];
        def?.processInstances?.forEach((inst: any) => {
          if (inst.tasks) {
            allTasks = allTasks.concat(
              inst.tasks
                .filter(
                  (task: any) => !!task.taskName && task.taskName.trim() !== ""
                )
                .map((task: any) => ({
                  id: task.taskId,
                  name: task.taskName,
                  description: task.taskDescription ?? "",
                  status: (task.taskStatus ?? "active").toLowerCase(),
                  activeInstances: 0,
                  processId: inst.processInstanceId,
                }))
            );
          }
        });
        this.taskSuggestions = allTasks.slice(0, 10);
        return;
      }
      // Otherwise, show all tasks from all deployments
      let allTasks: any[] = [];
      this.processDefinitions.forEach((def: any) => {
        def.processInstances?.forEach((inst: any) => {
          if (inst.tasks) {
            allTasks = allTasks.concat(
              inst.tasks
                .filter(
                  (task: any) => !!task.taskName && task.taskName.trim() !== ""
                )
                .map((task: any) => ({
                  id: task.taskId,
                  name: task.taskName,
                  description: task.taskDescription ?? "",
                  status: (task.taskStatus ?? "active").toLowerCase(),
                  activeInstances: 0,
                  processId: inst.processInstanceId,
                }))
            );
          }
        });
      });
      this.taskSuggestions = allTasks.slice(0, 10);
      return;
    }

    // If process instance is selected, filter tasks by processId (processInstanceId)
    if (this.selectedProcess && this.selectedProcess.id) {
      let foundInstance: any = null;
      for (const def of this.processDefinitions) {
        foundInstance = def.processInstances?.find(
          (inst: any) => inst.processInstanceId === this.selectedProcess!.id
        );
        if (foundInstance) break;
      }
      if (foundInstance && foundInstance.tasks) {
        this.taskSuggestions = foundInstance.tasks
          .filter(
            (task: any) =>
              !!task.taskName &&
              task.taskName.trim() !== "" &&
              ((task.taskName ?? "")
                .toLowerCase()
                .includes(term.toLowerCase()) ||
                (task.taskDescription ?? "")
                  .toLowerCase()
                  .includes(term.toLowerCase()))
          )
          .map((task: any) => ({
            id: task.taskId,
            name: task.taskName,
            description: task.taskDescription ?? "",
            status: (task.taskStatus ?? "active").toLowerCase(),
            activeInstances: 0,
            processId: foundInstance.processInstanceId,
          }))
          .slice(0, 10);
        return;
      }
    }

    // If only deployment is selected, aggregate all tasks from all process instances under that deployment
    if (this.selectedDefinition && this.selectedDefinition.deploymentName) {
      const def = this.processDefinitions.find(
        (d) => d.deploymentName === this.selectedDefinition!.deploymentName
      );
      let allTasks: any[] = [];
      def?.processInstances?.forEach((inst: any) => {
        if (inst.tasks) {
          allTasks = allTasks.concat(
            inst.tasks
              .filter(
                (task: any) => !!task.taskName && task.taskName.trim() !== ""
              )
              .map((task: any) => ({
                id: task.taskId,
                name: task.taskName,
                description: task.taskDescription ?? "",
                status: (task.taskStatus ?? "active").toLowerCase(),
                activeInstances: 0,
                processId: inst.processInstanceId,
              }))
          );
        }
      });
      this.taskSuggestions = allTasks
        .filter(
          (task: any) =>
            task.name.toLowerCase().includes(term.toLowerCase()) ||
            task.description.toLowerCase().includes(term.toLowerCase())
        )
        .slice(0, 10);
      return;
    }

    // Otherwise, show all tasks matching the term from all deployments
    let allTasks: any[] = [];
    this.processDefinitions.forEach((def: any) => {
      def.processInstances?.forEach((inst: any) => {
        if (inst.tasks) {
          allTasks = allTasks.concat(
            inst.tasks
              .filter(
                (task: any) => !!task.taskName && task.taskName.trim() !== ""
              )
              .map((task: any) => ({
                id: task.taskId,
                name: task.taskName,
                description: task.taskDescription ?? "",
                status: (task.taskStatus ?? "active").toLowerCase(),
                activeInstances: 0,
                processId: inst.processInstanceId,
              }))
          );
        }
      });
    });
    this.taskSuggestions = allTasks.filter(
      (task: any) =>
        task.name.toLowerCase().includes(term.toLowerCase()) ||
        task.description.toLowerCase().includes(term.toLowerCase())
    );
  }

  private performGlobalSearch(term: string): void {
    if (!term.trim()) {
      this.filteredResults = [...this.allResults];
    } else {
      const lowerTerm = term.toLowerCase();
      this.filteredResults = this.allResults.filter(
        (item) =>
          item.deploymentName?.toLowerCase().includes(lowerTerm) ||
          item.processInstanceIdName?.toLowerCase().includes(lowerTerm) ||
          item.taskName?.toLowerCase().includes(lowerTerm) ||
          item.taskAssignee?.toLowerCase().includes(lowerTerm) ||
          item.taskStatus?.toLowerCase().includes(lowerTerm)
      );
    }
    this.updatePagination();
  }

  // ===== SELECTION METHODS =====
  selectProcess(process: ProcessItem): void {
    this.selectedProcess = process;
    this.processSearchTerm = process.name;
    this.showProcessSuggestions = false;

    // Clear task selections when process changes
    this.selectedTasks = [];
    this.taskSearchTerm = "";
  }

  selectTask(task: TaskItem): void {
    if (!this.selectedTasks.find((t) => t.id === task.id)) {
      this.selectedTasks.push(task);
    }
    this.taskSearchTerm = "";
    this.showTaskSuggestions = false;
  }

  removeSelectedTask(task: TaskItem): void {
    this.selectedTasks = this.selectedTasks.filter((t) => t.id !== task.id);
  }

  clearSelectedTasks(): void {
    this.selectedTasks = [];
  }

  toggleStatus(status: string): void {
    const index = this.selectedStatuses.indexOf(status);
    if (index > -1) {
      this.selectedStatuses.splice(index, 1);
    } else {
      this.selectedStatuses.push(status);
    }
  }

  // ===== FILTER METHODS =====
  validateDateRange(): void {
    this.dateRangeError = "";

    if (this.startDate && this.endDate) {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);

      if (start >= end) {
        this.dateRangeError =
          "La date de fin doit être postérieure à la date de début";
      }
    }
  }

  canApplyFilters(): boolean {
    return (
      (this.selectedProcess ||
        this.selectedTasks.length > 0 ||
        this.selectedStatuses.length > 0 ||
        !!this.startDate ||
        !!this.endDate ||
        this.selectedDefinition) &&
      !this.dateRangeError
    );
  }

  hasActiveFilters(): boolean {
    return (
      this.selectedProcess !== null ||
      this.selectedTasks.length > 0 ||
      this.selectedStatuses.length > 0 ||
      this.startDate !== "" ||
      this.endDate !== "" ||
      this.selectedDefinition !== null
    );
  }

  applyFilters(): void {
    if (!this.selectedDefinition || !this.selectedDefinition.deploymentName) {
      this.filteredResults = [];
      this.filteredData = [];
      this.showToast(
        "warning",
        "Filtre requis",
        "Veuillez sélectionner un déploiement."
      );
      return;
    }
    if (!this.canApplyFilters()) {
      console.log("Cannot apply filters: validation failed or no filters.");
      return;
    }

    this.applyingFilters = true;

    // Build dynamic payload
    const payload: any = {
      deploymentNames: this.selectedDefinition
        ? [this.selectedDefinition.deploymentName]
        : [],
      processInstanceIdNames: this.selectedProcess
        ? [this.selectedProcess.name]
        : [],
      taskNames:
        this.selectedTasks.length > 0
          ? this.selectedTasks.map((t) => t.name)
          : [],
      taskStatuses:
        this.selectedStatuses.length > 0
          ? this.selectedStatuses.map((s) => s.toUpperCase())
          : [],
      taskStartFrom: this.startDate ? `${this.startDate}T00:00:00` : undefined,
      taskStartTo: this.endDate ? `${this.endDate}T00:00:00` : undefined,
    };

    // Remove undefined fields
    Object.keys(payload).forEach((key) => {
      if (
        payload[key] === undefined ||
        (Array.isArray(payload[key]) && payload[key].length === 0)
      ) {
        delete payload[key];
      }
    });

    // Create a cache key based on payload
    const cacheKey = JSON.stringify(payload);
    const now = Date.now();
    const cached = this.filterResultsCache.get(cacheKey);
    if (cached && now - cached.timestamp < 7 * 24 * 60 * 60 * 1000) {
      this.allResults = cached.results;
      this.filteredResults = [...cached.results];
      this.filteredData = [...cached.results];
      this.filtersApplied = true;
      this.applyingFilters = false;
      this.currentPage = 1;
      this.updatePagination();
      this.showToast(
        "success",
        "Filtres appliqués (cache)",
        `${this.allResults.length} résultat(s) trouvé(s)`
      );
      return;
    }

    // Call hierarchical API
    this.http
      .post<any[]>(
        `${environment.api2Url}/processes/hierarchical/filter`,
        payload
      )
      .subscribe({
        next: (data) => {
          // Flatten hierarchical response for table display
          const results: ResultItem[] = [];
          data.forEach((proc) => {
            proc.processInstances.forEach((inst: any) => {
              inst.tasks.forEach((task: any) => {
                // Determine task status based on suspensionState
                let taskStatus: string;
                
                if (inst.suspensionState === 2) {
                  taskStatus = "suspended";
                } else if (inst.suspensionState === 1) {
                  // Check if the task itself is completed
                  if (task.taskStatus === "COMPLETED") {
                    taskStatus = "completed";
                  } else {
                    taskStatus = "active";
                  }
                } else if (inst.suspensionState === null) {
                  // Process is completed
                  taskStatus = "completed";
                } else {
                  // Fallback to task status if suspensionState is unexpected
                  taskStatus = (task.taskStatus || "active").toLowerCase();
                }

                results.push({
                  id: `${inst.processInstanceId}-${task.taskId}`,
                  deploymentName: proc.deploymentName,
                  processInstanceIdName: inst.processInstanceIdName,
                  taskName: task.taskName,
                  taskAssignee: task.taskAssignee,
                  taskStatus: taskStatus,
                  processInstanceId: inst.processInstanceId,
                  processDefinitionId: proc.processDefinitionKey,
                  processStartedBy: inst.processStartedBy,
                });
              });
            });
          });

          // Cache results
          this.filterResultsCache.set(cacheKey, { results, timestamp: now });

          this.allResults = results;
          this.filteredResults = [...results];
          this.filteredData = [...results];
          this.filtersApplied = true;
          this.applyingFilters = false;
          this.currentPage = 1;
          this.updatePagination();

          this.showToast(
            "success",
            "Filtres appliqués",
            `${this.allResults.length} résultat(s) trouvé(s)`
          );
        },
        error: (err) => {
          console.error("API error:", err);
          this.applyingFilters = false;
          this.showToast(
            "error",
            "Erreur API",
            "Impossible de charger les résultats"
          );
          this.allResults = [];
          this.filteredResults = [];
          this.filteredData = [];
          this.paginatedResults = [];
        },
      });
  }

  clearAllFilters(): void {
    this.selectedProcess = null;
    this.selectedTasks = [];
    this.selectedStatuses = [];
    this.startDate = "";
    this.endDate = "";
    this.processSearchTerm = "";
    this.taskSearchTerm = "";
    this.globalSearchTerm = "";
    this.dateRangeError = "";
    this.filtersApplied = false;
    this.allResults = [];
    this.filteredResults = [];
    this.filteredData = [];
    this.paginatedResults = [];
    this.selectedItems.clear();

    // Clear definition filter
    this.selectedDefinition = null;
    this.processDefinitionControl.setValue("");

    this.showToast(
      "info",
      "Filtres effacés",
      "Tous les filtres ont été réinitialisés"
    );
  }

  removeProcessFilter(): void {
    this.selectedProcess = null;
    this.processSearchTerm = "";
    this.selectedTasks = [];
    this.taskSearchTerm = "";
  }

  clearDateRange(): void {
    this.startDate = "";
    this.endDate = "";
    this.dateRangeError = "";
  }

  formatDateRange(): string {
    if (this.startDate && this.endDate) {
      return `${this.formatDate(this.startDate)} - ${this.formatDate(
        this.endDate
      )}`;
    } else if (this.startDate) {
      return `Depuis ${this.formatDate(this.startDate)}`;
    } else if (this.endDate) {
      return `Jusqu'au ${this.formatDate(this.endDate)}`;
    }
    return "";
  }

  // ===== TABLE METHODS =====
  trackByItem(index: number, item: ResultItem): string {
    return item.id;
  }

  sortBy(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
    } else {
      this.sortField = field;
      this.sortDirection = "asc";
    }

    this.filteredResults.sort((a, b) => {
      let valueA: any = a[field as keyof ResultItem];
      let valueB: any = b[field as keyof ResultItem];

      if (typeof valueA === "string") {
        valueA = valueA.toLowerCase();
        valueB = valueB.toLowerCase();
      }

      const comparison = valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
      return this.sortDirection === "asc" ? comparison : -comparison;
    });

    this.updatePagination();
  }

  getSortIcon(field: string): string {
    if (this.sortField !== field) return "unfold_more";
    return this.sortDirection === "asc"
      ? "keyboard_arrow_up"
      : "keyboard_arrow_down";
  }

  // ===== SELECTION METHODS =====
  toggleSelectAll(): void {
    if (this.isAllSelected()) {
      this.selectedItems.clear();
    } else {
      this.paginatedResults.forEach((item) => this.selectedItems.add(item.id));
    }
  }

  toggleSelectItem(itemId: string): void {
    if (this.selectedItems.has(itemId)) {
      this.selectedItems.delete(itemId);
    } else {
      this.selectedItems.add(itemId);
    }
  }

  isAllSelected(): boolean {
    return (
      this.paginatedResults.length > 0 &&
      this.paginatedResults.every((item) => this.selectedItems.has(item.id))
    );
  }

  isSomeSelected(): boolean {
    return this.selectedItems.size > 0 && !this.isAllSelected();
  }

  // ===== ACTION METHODS =====
  toggleSuspend(item: ResultItem): void {
    const originalInitiatorId = item.processStartedBy || "";
    // Check suspension based on taskStatus which now reflects suspensionState
    const isSuspended = item.taskStatus === "suspended";
    const action$ = isSuspended
      ? this.tasksService.ResumeProcess(
          item.processInstanceId,
          originalInitiatorId
        )
      : this.tasksService.SuspendProcess(
          item.processInstanceId,
          originalInitiatorId
        );

    action$.subscribe({
      next: (success: boolean) => {
        const actionText = isSuspended ? "repris" : "suspendu";
        if (success) {
          item.taskStatus = isSuspended ? "active" : "suspended";
          this.showToast(
            "success",
            `Processus ${actionText}`,
            `Le processus ${item.processInstanceId} a été ${actionText}.`
          );
          this.updatePagination();
          // Refresh table after action
          this.applyFilters();
        } else {
          this.showToast(
            "error",
            "Erreur",
            `Échec de la ${isSuspended ? "reprise" : "suspension"} du processus ${item.processInstanceId}.`
          );
        }
      },
      error: () => {
        this.showToast(
          "error",
          "Erreur",
          `Impossible de ${isSuspended ? "reprendre" : "suspendre"} le processus ${item.processInstanceId}.`
        );
      },
    });
  }

  stopTask(item: ResultItem): void {
    this.confirmDialogConfig = {
      title: "Confirmation d'arrêt",
      message: `Êtes-vous sûr de vouloir arrêter le processus ${item.processInstanceId} ?`,
      confirmText: "Arrêter",
      cancelText: "Annuler",
      icon: "stop_circle",
      iconColor: "#ef4444",
      theme: "danger",
    };
    this.showConfirmDialog = true;
    (this as any)._terminateItem = item;
  }

  private terminateProcess(item: ResultItem): void {
    const originalInitiatorId = item.processStartedBy || "";
    this.tasksService
      .TerminateProcess(item.processInstanceId, originalInitiatorId)
      .subscribe({
        next: (success: boolean) => {
          if (success) {
            this.showToast(
              "success",
              "Processus terminé",
              `Le processus ${item.processInstanceId} a été terminé avec succès.`
            );
            this.allResults = this.allResults.filter((r) => r.id !== item.id);
            this.filteredResults = this.filteredResults.filter(
              (r) => r.id !== item.id
            );
            this.filteredData = this.filteredData.filter(
              (r) => r.id !== item.id
            );
            this.updatePagination();
            // Refresh table after action
            this.applyFilters();
          } else {
            this.showToast(
              "error",
              "Erreur",
              `Échec de la terminaison du processus ${item.processInstanceId}.`
            );
          }
          (this as any)._terminateItem = null;
        },
        error: () => {
          this.showToast(
            "error",
            "Erreur",
            `Impossible de terminer le processus ${item.processInstanceId}.`
          );
          (this as any)._terminateItem = null;
        },
      });
  }
  onProcessInstanceSearch(term: string): void {
    if (!this.selectedDefinition || !this.selectedDefinition.deploymentName) {
      this.filteredProcessInstances = [];
      return;
    }

    // Aggregate all process instances from ALL definitions with the selected deployment name
    const allInstances: any[] = [];
    this.processDefinitions
      .filter(
        (def) => def.deploymentName === this.selectedDefinition.deploymentName
      )
      .forEach((def) => {
        if (def.processInstances) {
          allInstances.push(...def.processInstances);
        }
      });

    // If term is empty, show all instances
    const lowerTerm = term.trim().toLowerCase();
    this.filteredProcessInstances = allInstances.filter(
      (inst: any) =>
        !lowerTerm ||
        inst.processInstanceIdName?.toLowerCase().includes(lowerTerm) ||
        inst.processInstanceId?.toLowerCase().includes(lowerTerm)
    );
  }

  onProcessInputFocus(): void {
    this.showProcessSuggestions = true;
    // Show all proposals if search term is empty
    this.onProcessInstanceSearch(this.processSearchTerm);
  }

  onTaskInputFocus(): void {
    this.showTaskSuggestions = true;
    // Show all proposals if search term is empty
    this.onTaskSearch();
  }

  onConfirmDialogResult(confirmed: boolean): void {
    if (confirmed) {
      // Use "masse" in the title to trigger bulk terminate
      if (this.confirmDialogConfig.title.includes("masse")) {
        const selectedObjects =
          ((this as any)._bulkTerminateObjects as ResultItem[]) || [];
        const actionLabel =
          (this as any)._bulkTerminateLabel || "Arrêt en masse";
        let completed = 0;
        let successCount = 0;
        let errorCount = 0;

        if (selectedObjects.length === 0) {
          this.showConfirmDialog = false;
          return;
        }

        selectedObjects.forEach((item) => {
          const originalInitiatorId = item.processStartedBy ?? "";
          this.tasksService
            .TerminateProcess(item.processInstanceId, originalInitiatorId)
            .subscribe({
              next: (success: boolean) => {
                if (success) {
                  successCount++;
                  this.showToast(
                    "success",
                    "Processus terminé",
                    `Le processus ${item.processInstanceId} a été terminé avec succès.`
                  );
                  this.allResults = this.allResults.filter(
                    (r) => r.id !== item.id
                  );
                  this.filteredResults = this.filteredResults.filter(
                    (r) => r.id !== item.id
                  );
                  this.filteredData = this.filteredData.filter(
                    (r) => r.id !== item.id
                  );
                  this.updatePagination();
                } else {
                  errorCount++;
                  this.showToast(
                    "error",
                    "Erreur",
                    `Échec de la terminaison du processus ${item.processInstanceId}.`
                  );
                }
                completed++;
                if (completed === selectedObjects.length) {
                  this.selectedItems.clear();
                  this.updatePagination();
                  this.showToast(
                    successCount > 0 ? "success" : "error",
                    actionLabel,
                    `${successCount} processus arrêté(s), ${errorCount} échec(s)`
                  );
                  (this as any)._bulkTerminateObjects = null;
                  (this as any)._bulkTerminateLabel = null;
                }
              },
              error: () => {
                errorCount++;
                this.showToast(
                  "error",
                  "Erreur",
                  `Impossible de terminer le processus ${item.processInstanceId}.`
                );
                completed++;
                if (completed === selectedObjects.length) {
                  this.selectedItems.clear();
                  this.updatePagination();
                  this.showToast(
                    successCount > 0 ? "success" : "error",
                    actionLabel,
                    `${successCount} processus arrêté(s), ${errorCount} échec(s)`
                  );
                  (this as any)._bulkTerminateObjects = null;
                  (this as any)._bulkTerminateLabel = null;
                }
              },
            });
        });
      } else if ((this as any)._terminateItem) {
        const item = (this as any)._terminateItem as ResultItem;
        this.terminateProcess(item);
      }
    }
    this.showConfirmDialog = false;
  }

  // ===== BULK ACTIONS =====
  bulkSuspend(): void {
    this.performBulkAction("suspend", "Suspension en masse");
  }

  bulkResume(): void {
    this.performBulkAction("resume", "Reprise en masse");
  }

  bulkTransfer(): void {
    // Prepare transfer queue and modal for bulk transfer
    const selectedTasks = Array.from(this.selectedItems)
      .map((id) => this.filteredResults.find((r) => r.id === id))
      .filter((item): item is ResultItem => !!item)
      .map((item) => {
        let taskId = item.id;
        if (taskId.includes("-")) {
          const parts = taskId.split("-");
          taskId = parts[parts.length - 1];
        }
        return {
          id: taskId,
          processInstanceId: item.processInstanceId,
          processDefinitionId: item.processDefinitionId,
          name: `Tâche ${item.taskName ?? item.processDefinitionId}`,
          description: item.deploymentName,
          assignee: item.taskAssignee ?? "",
          created: new Date(),
          priority: 50,
          status: "assigned" as "assigned",
        };
      });

    // Always send as array for bulk transfer
    this.taskToTransfer = selectedTasks.length > 0 ? selectedTasks : null;
    this.showTransferModal = !!this.taskToTransfer;
  }

  bulkStop(): void {
    // Always use "masse" in the title for bulk confirmation
    this.confirmDialogConfig = {
      title: "Confirmation d'arrêt en masse",
      message: `Êtes-vous sûr de vouloir arrêter ${this.selectedItems.size} processus sélectionnés ?`,
      confirmText: "Arrêter tout",
      cancelText: "Annuler",
      icon: "stop_circle",
      iconColor: "#ef4444",
      theme: "danger",
    };
    this.showConfirmDialog = true;
    // Store selected objects for bulk terminate
    const selectedObjects = Array.from(this.selectedItems)
      .map((id) => this.filteredResults.find((r) => r.id === id))
      .filter(Boolean);
    (this as any)._bulkTerminateObjects = selectedObjects;
    (this as any)._bulkTerminateLabel = "Arrêt en masse";
  }

  private performBulkAction(action: string, actionLabel: string): void {
    const ids = Array.from(this.selectedItems);
    if (ids.length === 0) return;

    const selectedObjects = ids
      .map((id) => this.filteredResults.find((r) => r.id === id))
      .filter(Boolean);

    if (action === "suspend" || action === "resume") {
      let completed = 0;
      let successCount = 0;
      let errorCount = 0;
      selectedObjects.forEach((item) => {
        const originalInitiatorId = item!.processStartedBy || "";
        const serviceCall$ =
          action === "suspend"
            ? this.tasksService.SuspendProcess(
                item!.processInstanceId,
                originalInitiatorId
              )
            : this.tasksService.ResumeProcess(
                item!.processInstanceId,
                originalInitiatorId
              );

        serviceCall$.subscribe({
          next: (success: boolean) => {
            const actionText = action === "suspend" ? "suspendu" : "repris";
            if (success) {
              successCount++;
              item!.taskStatus = action === "suspend" ? "suspended" : "active";
              this.showToast(
                "success",
                `Processus ${actionText}`,
                `Le processus ${item!.processInstanceId} a été ${actionText}.`
              );
            } else {
              errorCount++;
              this.showToast(
                "error",
                "Erreur",
                `Échec de la ${
                  action === "suspend" ? "suspension" : "reprise"
                } du processus ${item!.processInstanceId}.`
              );
            }
            completed++;
            if (completed === selectedObjects.length) {
              this.selectedItems.clear();
              this.updatePagination();
              this.showToast(
                successCount > 0 ? "success" : "error",
                actionLabel,
                `${successCount} processus traité(s), ${errorCount} échec(s)`
              );
              // Refresh table after bulk action
              this.applyFilters();
            }
          },
          error: () => {
            errorCount++;
            this.showToast(
              "error",
              "Erreur",
              `Impossible de ${
                action === "suspend" ? "suspendre" : "reprendre"
              } le processus ${item!.processInstanceId}.`
            );
            completed++;
            if (completed === selectedObjects.length) {
              this.selectedItems.clear();
              this.updatePagination();
              this.showToast(
                successCount > 0 ? "success" : "error",
                actionLabel,
                `${successCount} processus traité(s), ${errorCount} échec(s)`
              );
              // Refresh table after bulk action
              this.applyFilters();
            }
          },
        });
      });
      return;
    }

    if (action === "terminate") {
      // Show confirmation dialog before terminating
      this.confirmDialogConfig = {
        title: "Confirmation d'arrêt groupé",
        message: `Êtes-vous sûr de vouloir arrêter ${selectedObjects.length} processus sélectionnés ?`,
        confirmText: "Arrêter tout",
        cancelText: "Annuler",
        icon: "stop_circle",
        iconColor: "#ef4444",
        theme: "danger",
      };
      this.showConfirmDialog = true;
      (this as any)._bulkTerminateObjects = selectedObjects;
      (this as any)._bulkTerminateLabel = actionLabel;
      return;
    }
  }
  // ===== MODAL METHODS =====
  closeTransferModal(): void {
    this.showTransferModal = false;
    this.taskToTransfer = null;
  }

  closeBulkActionsModal(): void {
    this.showBulkActionsModal = false;
  }

  onTaskTransferred(assignment: TaskAssignment | TaskAssignment[]): void {
    const assignments = Array.isArray(assignment) ? assignment : [assignment];
    assignments.forEach((a) => {
      const assignee = a.assigneeId || a.assigneeType;
      this.showToast(
        "success",
        "Tâche transférée",
        `La tâche ${a.taskId} a été transférée à ${assignee}.`
      );
    });
    this.closeTransferModal();
    this.selectedItems.clear();
    // Refresh data after transfer
    this.applyFilters();
  }

  // ===== PROCESS DEFINITION METHODS =====
  loadProcessDefinitions(): void {
    const now = Date.now();
    // 10 minutes cache
    if (
      this.processDefinitionsCache.length > 0 &&
      now - this.lastDefinitionsFetchTime < 10 * 60 * 1000
    ) {
      this.processDefinitions = this.processDefinitionsCache;
      this.filteredDefs = this.processDefinitionsCache
        .filter((def) => def.deploymentName)
        .map((def) => ({ deploymentName: def.deploymentName, ...def }));
      return;
    }
    this.http
      .get<any[]>(`${environment.api2Url}/processes/hierarchical`)
      .subscribe({
        next: (data) => {
          this.processDefinitions = data;
          this.processDefinitionsCache = data;
          this.lastDefinitionsFetchTime = now;
          const seen = new Set<string>();
          this.filteredDefs = data
            .filter((def) => {
              if (!def.deploymentName || seen.has(def.deploymentName))
                return false;
              seen.add(def.deploymentName);
              return true;
            })
            .map((def) => ({
              deploymentName: def.deploymentName,
              ...def,
            }));
        },
        error: (error) => {
          console.error("Error loading process definitions:", error);
          this.processDefinitions = [];
          this.filteredDefs = [];
        },
      });
  }

  // Pour filtrer les définitions, utilisez deploymentName
  filterDefinitions(): void {
    const filterValue =
      this.processDefinitionControl.value?.toLowerCase() || "";
    // Only show unique deploymentName values in suggestions
    const seen = new Set<string>();
    this.filteredDefs = this.processDefinitions
      .filter((def) => {
        const name = def.deploymentName?.toLowerCase() || "";
        if (!name.includes(filterValue)) return false;
        if (seen.has(def.deploymentName)) return false;
        seen.add(def.deploymentName);
        return true;
      })
      .map((def) => ({
        deploymentName: def.deploymentName,
        ...def,
      }));
  }

  selectDefinition(def: any): void {
    // Clear only filter input fields (not table data, not selectedDefinition)
    this.selectedProcess = null;
    this.selectedTasks = [];
    this.selectedStatuses = [];
    this.startDate = "";
    this.endDate = "";
    this.processSearchTerm = "";
    this.taskSearchTerm = "";
    this.globalSearchTerm = "";
    this.dateRangeError = "";
    this.selectedItems.clear();

    // Do NOT clear results arrays or selectedDefinition
    // Do NOT set filtersApplied = false (keep table state)

    this.selectedDefinition = def;
    this.processDefinitionControl.setValue(def.deploymentName);
    this.showDefinitionDropdown = false;

    // Optionally, update selectedProcess if needed
    const matchingProcess = this.availableProcesses.find((p) =>
      p.name
        .toLowerCase()
        .includes(def.deploymentName?.toLowerCase() || def.name_?.toLowerCase())
    );
    if (matchingProcess) {
      this.selectProcess(matchingProcess);
    }
  }

  // Add method to remove definition filter
  removeDefinitionFilter(): void {
    this.selectedDefinition = null;
    this.processDefinitionControl.setValue("");
  }

  // ===== UTILITY METHODS =====
  toggleFiltersPanel(): void {
    this.showFilters = !this.showFilters;
  }

  hideProcessSuggestions(): void {
    setTimeout(() => {
      this.showProcessSuggestions = false;
    }, 200);
  }

  hideTaskSuggestions(): void {
    setTimeout(() => {
      this.showTaskSuggestions = false;
    }, 200);
  }

  clearGlobalSearch(): void {
    this.globalSearchTerm = "";
    this.performGlobalSearch("");
  }

  viewInstanceDetails(instanceId: string, event: Event): void {
    event.preventDefault();
    this.showToast(
      "info",
      "Détails de l'instance",
      `Affichage des détails pour ${instanceId}`
    );
  }

  viewUserProfile(username: string, event: Event): void {
    event.preventDefault();
    this.showToast(
      "info",
      "Profil utilisateur",
      `Affichage du profil de ${username}`
    );
  }

  highlightMatch(text: string, searchTerm: string): string {
    if (!searchTerm.trim()) return text;

    const regex = new RegExp(`(${searchTerm})`, "gi");
    return text.replace(regex, '<span class="highlight">$1</span>');
  }

  formatDateTime(date: Date): string {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  formatDate(dateString: string): string {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(dateString));
  }

  getTimeAgeClass(date: Date): string {
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) return "recent";
    if (diffHours < 168) return "old"; // 1 week
    return "very-old";
  }
  getStatusBadgeClass(status: string): string {
    const classes: { [key: string]: string } = {
      active: "bg-green-100 text-green-800",
      suspended: "bg-yellow-100 text-yellow-800",
      completed: "bg-blue-100 text-blue-800",
      failed: "bg-red-100 text-red-800",
      pending: "bg-gray-100 text-gray-800",
    };
    return classes[status] || "bg-gray-100 text-gray-800";
  }

  getStatusIcon(status: string): string {
    const icons: { [key: string]: string } = {
      active: "play_circle",
      suspended: "pause_circle",
      completed: "check_circle",
      failed: "error",
      pending: "hourglass_empty",
    };
    return icons[status] || "help";
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      active: "En cours",
      suspended: "Suspendu",
      completed: "Terminé",
      failed: "Échoué",
      pending: "En attente",
    };
    return labels[status] || status;
  }

  getStatusTooltip(status: string): string {
    const tooltips: { [key: string]: string } = {
      active: "Processus en cours d'exécution",
      suspended: "Processus temporairement suspendu",
      completed: "Processus terminé avec succès",
      failed: "Processus échoué",
      pending: "Processus en attente",
    };
    return tooltips[status] || "";
  }

  // ===== TOAST METHODS =====
  private showToast(
    type: "success" | "error" | "warning" | "info",
    title: string,
    message: string
  ): void {
    const toast: Toast = {
      id: Date.now().toString(),
      title,
      message,
      type,
      duration: 5000,
    };

    this.toasts.push(toast);

    // Auto remove after duration
    setTimeout(() => {
      this.removeToast(toast.id);
    }, toast.duration);
  }

  removeToast(id: string): void {
    this.toasts = this.toasts.filter((toast) => toast.id !== id);
  }

  onGlobalSearch(): void {
    this.globalSearchSubject.next(this.globalSearchTerm);
  }

  onBulkActionExecuted(action: string): void {
    switch (action) {
      case "suspend":
        this.bulkSuspend();
        break;
      case "resume":
        this.bulkResume();
        break;
      case "terminate":
        this.bulkStop();
        break;
      case "transfer":
        this.bulkTransfer();
        break;
      default:
        this.showToast("warning", "Action inconnue", "Action non reconnue.");
    }
    this.closeBulkActionsModal();
  }

  // Add this method if missing
  transferTask(item: ResultItem): void {
    // Single transfer: send as array for consistency
    const task: Task = {
      id: item.id.includes("-") ? item.id.split("-").pop()! : item.id,
      processInstanceId: item.processInstanceId,
      processDefinitionId: item.processDefinitionId,
      name: `Tâche ${item.taskName ?? item.processDefinitionId}`,
      description: item.deploymentName,
      assignee: item.taskAssignee ?? "",
      created: new Date(),
      priority: 50,
      status: "assigned",
    };
    this.taskToTransfer = [task];
    this.showTransferModal = true;
  }

  onDefinitionInputKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter" && this.processDefinitionControl.value?.trim()) {
      const manualDef = {
        deploymentName: this.processDefinitionControl.value.trim(),
        name_: this.processDefinitionControl.value.trim(),
        key_: "",
      };
      this.selectDefinition(manualDef);
      event.preventDefault();
    }
  }

  selectProcessInstance(inst: any): void {
    this.selectedProcess = {
      id: inst.processInstanceId,
      name: inst.processInstanceIdName,
      description: "",
      type: "generic",
      category: "",
    };
    this.processSearchTerm = inst.processInstanceIdName;
    this.showProcessSuggestions = false;
  }

  onTaskInputKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter" && this.taskSearchTerm.trim()) {
      const manualTask: TaskItem = {
        id: "manual-" + Date.now(),
        name: this.taskSearchTerm.trim(),
        description: "",
        status: "active",
        activeInstances: 0,
        processId: this.selectedProcess ? this.selectedProcess.id : "",
      };
      this.selectTask(manualTask);
      event.preventDefault();
    }
  }

  getVisiblePages(): number[] {
    const pages: number[] = [];
    const maxVisible = 7;

    if (this.totalPages <= maxVisible) {
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (this.currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push(-1); // ellipsis
        pages.push(this.totalPages);
      } else if (this.currentPage >= this.totalPages - 3) {
        pages.push(1);
        pages.push(-1); // ellipsis
        for (let i = this.totalPages - 4; i <= this.totalPages; i++)
          pages.push(i);
      } else {
        pages.push(1);
        pages.push(-1); // ellipsis
        for (let i = this.currentPage - 1; i <= this.currentPage + 1; i++)
          pages.push(i);
        pages.push(-1); // ellipsis
        pages.push(this.totalPages);
      }
    }

    return pages;
  }

}
