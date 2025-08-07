import { Component, OnInit, OnDestroy, ViewChild } from "@angular/core";
import { MatTableDataSource } from "@angular/material/table";
import { MatPaginator } from "@angular/material/paginator";
import { MatSort } from "@angular/material/sort";
import { MatTabChangeEvent } from "@angular/material/tabs";
import { DatePipe, CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Subscription } from "rxjs";
import { SelectionModel } from "@angular/cdk/collections";

import {
  ProcessData,
  ProcessResponse,
  ProcessService,
} from "../../core/services/process.service";
import { TaskService } from "../../core/services/task.service";
import { ToastService, ToastMessage } from "../../core/services/toast.service";
import { Task, TaskAssignment } from "../../core/models/task.model";

// Angular Material modules
import { MatTableModule } from "@angular/material/table";
import { MatPaginatorModule } from "@angular/material/paginator";
import { MatSortModule } from "@angular/material/sort";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatTabsModule } from "@angular/material/tabs";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatMenuModule } from "@angular/material/menu";

// Shared components
import { TaskActionsComponent } from "../../shared/components/task-actions/task-actions.component";
import { TaskTransferModalComponent } from "../../shared/components/task-transfer-modal/task-transfer-modal.component";
import { ToastNotificationComponent } from "../../shared/components/toast-notification/toast-notification.component";
import { ConfirmDialogComponent } from "../../shared/components/confirm-dialog/confirm-dialog.component";
import { TasksService } from "../../core/services/tasks.service";
import { BulkActionsModalComponent } from "../../shared/components/bulk-actions-modal/bulk-actions-modal.component";

@Component({
  selector: "app-processes",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatTabsModule,
    MatTooltipModule,
    MatCheckboxModule,
    MatMenuModule,
    TaskActionsComponent,
    TaskTransferModalComponent,
    ToastNotificationComponent,
    ConfirmDialogComponent,
    BulkActionsModalComponent,
  ],
  templateUrl: "./processes.component.html",
  styleUrls: ["./processes.component.scss"],
  providers: [DatePipe],
})
export class ProcessesComponent implements OnInit, OnDestroy {
// Make Math available for template
  Math = Math;

  // Properties
  activeTabIndex = 0;
  loading = true;
  tabs = [
    { label: "Uniquement par son initiateur", key: "processusInitiateurSeulement", count: 0 },
    { label: "Qu'une seule tâche exécutée", key: "processusLongs", count: 0 },
    { label: "Avec erreur/exception technique", key: "processusSansTâches", count: 0 },
    { label: "Sans aucune tâche utilisateur", key: "nombreProcessusÉchoués", count: 0 },
  ];

  tableColumns = [
    { key: 'processInstanceId', label: 'ID Instance' },
    { key: 'processDefinitionId', label: 'Définition' },
    { key: 'processStartTime', label: 'Début' },
    { key: 'processInitiator', label: 'Initiateur' }
  ];

  processData: ProcessResponse | null = null;
  filteredData: ProcessData[] = [];
  paginatedData: ProcessData[] = [];
  originalDataSource: ProcessData[] = [];

  // Pagination properties
  currentPage: number = 1;
  pageSize: number = 5;
  totalPages: number = 1;
  visiblePageNumbers: number[] = [];

  // Sorting properties
  sortColumn: string = "";
  sortDirection: "asc" | "desc" = "asc";

  // Selection
  selectedProcessIds = new Set<string>();

  // Tab indicator
  tabIndicatorWidth = 200;
  tabIndicatorPosition = 0;

  // Bulk actions
  bulkActions = [
    { name: "Suspend Selected", action: "suspend", icon: "pause_circle" },
    { name: "Resume Selected", action: "resume", icon: "play_circle" },
    { name: "Terminate Selected", action: "terminate", icon: "stop_circle" },
    { name: "Transfer Selected", action: "transfer", icon: "swap_horiz" },
  ];

  // Modals
  showTransferModal = false;
  selectedTaskForTransfer: Task[] = [];
  showBulkConfirmDialog = false;
  showBulkActionsModal = false;

  bulkConfirmDialogConfig = {
    title: "",
    message: "",
    confirmText: "",
    cancelText: "Annuler",
    icon: "",
    iconColor: "",
    theme: "",
    action: "" as "suspend" | "resume" | "terminate" | "",
    processes: [] as ProcessData[],
  };

  // Toast
  toasts: ToastMessage[] = [];

  // Subscriptions
  private socketSubscription!: Subscription;
  private toastSubscription!: Subscription;
  private transferQueue: ProcessData[] = [];
  private isAutoTransfer = false;
  currentSearchValue: string = "";

  // State persistence
  private uiState: {
    currentPage: number;
    pageSize: number;
    sortColumn: string;
    sortDirection: "asc" | "desc";
    searchValue: string;
    activeTabIndex: number;
  } = {
    currentPage: 1,
    pageSize: 5,
    sortColumn: "",
    sortDirection: "asc",
    searchValue: "",
    activeTabIndex: 0,
  };

  constructor(
      private webSocketService: ProcessService,
      private taskService: TaskService,
      private tasksService: TasksService,
      private toastService: ToastService,
      private datePipe: DatePipe
  ) {}

  ngOnInit(): void {
    this.loadSavedState();
    this.currentPage = this.uiState.currentPage;
    this.pageSize = this.uiState.pageSize;
    this.sortColumn = this.uiState.sortColumn;
    this.sortDirection = this.uiState.sortDirection;
    this.currentSearchValue = this.uiState.searchValue;
    this.activeTabIndex = this.uiState.activeTabIndex;

    this.loading = true;
    this.subscribeToToasts();
    setTimeout(() => this.connectToWebSocket(), 1500);
  }

  ngOnDestroy(): void {
    this.saveCurrentState();
    this.socketSubscription?.unsubscribe();
    this.toastSubscription?.unsubscribe();
    this.webSocketService.close();
  }

  // State persistence methods
  private saveCurrentState(): void {
    this.uiState = {
      currentPage: this.currentPage,
      pageSize: this.pageSize,
      sortColumn: this.sortColumn,
      sortDirection: this.sortDirection,
      searchValue: this.currentSearchValue,
      activeTabIndex: this.activeTabIndex,
    };
    localStorage.setItem("processesComponentState", JSON.stringify(this.uiState));
  }

  private loadSavedState(): void {
    const savedState = localStorage.getItem("processesComponentState");
    if (savedState) {
      try {
        this.uiState = JSON.parse(savedState);
      } catch (e) {
        console.warn("Failed to parse saved state", e);
      }
    }
  }

  // Tab methods
  selectTab(index: number): void {
    this.activeTabIndex = index;
    this.selectedProcessIds.clear();
    this.loadTabData(index);
    this.updateTabIndicator(index);
    this.saveCurrentState();
  }

  private updateTabIndicator(index: number): void {
    const tabElements = document.querySelectorAll('.tab-button');
    if (tabElements[index]) {
      const tab = tabElements[index] as HTMLElement;
      this.tabIndicatorWidth = tab.offsetWidth;
      this.tabIndicatorPosition = tab.offsetLeft;
    }
  }

  getTabClasses(index: number): string {
    return index === this.activeTabIndex
        ? 'text-red-600 bg-red-50 border-b-2 border-red-600'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50';
  }

  getTabBadgeClasses(index: number): string {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-semibold ml-2';
    if (index === this.activeTabIndex) {
      return `${baseClasses} bg-red-100 text-red-800`;
    }
    if (index === 2) { // Error tab
      return `${baseClasses} bg-red-100 text-red-800`;
    }
    return `${baseClasses} bg-gray-100 text-gray-800`;
  }

  getTabIcon(index: number): string {
    const icons = [
      'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', // user-check
      'M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z', // clock
      'M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z', // exclamation-triangle
      'M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z' // ban
    ];
    return icons[index] || icons[0];
  }

  // Selection methods
  isAllSelected(): boolean {
    return this.filteredData.length > 0 && this.selectedProcessIds.size === this.filteredData.length;
  }

  isPartiallySelected(): boolean {
    return this.selectedProcessIds.size > 0 && this.selectedProcessIds.size < this.filteredData.length;
  }

  isSelected(process: ProcessData): boolean {
    return this.selectedProcessIds.has(process.processInstanceId);
  }

  toggleAllRows(): void {
    if (this.isAllSelected()) {
      this.selectedProcessIds.clear();
    } else {
      this.filteredData.forEach(row => this.selectedProcessIds.add(row.processInstanceId));
    }
  }

  toggleSelection(process: ProcessData): void {
    if (this.selectedProcessIds.has(process.processInstanceId)) {
      this.selectedProcessIds.delete(process.processInstanceId);
    } else {
      this.selectedProcessIds.add(process.processInstanceId);
    }
  }

  // Pagination methods
  updatePagination(): void {
    if (!this.pageSize || this.pageSize < 1) {
      this.pageSize = 5;
    }

    this.totalPages = Math.max(1, Math.ceil(this.filteredData.length / this.pageSize));

    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }

    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = Math.min(startIndex + this.pageSize, this.filteredData.length);
    this.paginatedData = this.filteredData.slice(startIndex, endIndex);

    this.calculateVisiblePageNumbers();
  }

  calculateVisiblePageNumbers(): void {
    this.visiblePageNumbers = [];

    if (this.totalPages <= 7) {
      for (let i = 1; i <= this.totalPages; i++) {
        this.visiblePageNumbers.push(i);
      }
    } else {
      if (this.currentPage <= 4) {
        for (let i = 1; i <= 5; i++) {
          this.visiblePageNumbers.push(i);
        }
        this.visiblePageNumbers.push(-1); // ellipsis
        this.visiblePageNumbers.push(this.totalPages);
      } else if (this.currentPage >= this.totalPages - 3) {
        this.visiblePageNumbers.push(1);
        this.visiblePageNumbers.push(-1); // ellipsis
        for (let i = this.totalPages - 4; i <= this.totalPages; i++) {
          this.visiblePageNumbers.push(i);
        }
      } else {
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

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
      this.saveCurrentState();
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
      this.saveCurrentState();
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.updatePagination();
      this.saveCurrentState();
    }
  }

  onPageSizeChange(): void {
    const firstItemIndex = (this.currentPage - 1) * this.pageSize;
    this.currentPage = Math.floor(firstItemIndex / this.pageSize) + 1;
    this.updatePagination();
    this.saveCurrentState();
  }

  getPageButtonClasses(pageNum: number): string {
    if (pageNum === -1) {
      return 'text-gray-500 bg-white border-gray-300 cursor-default';
    }
    if (pageNum === this.currentPage) {
      return 'bg-red-600 text-white';
    }
    return 'border border-gray-300 hover:bg-gray-50';
  }

  // Sorting methods
  sortData(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
    } else {
      this.sortColumn = column;
      this.sortDirection = "asc";
    }

    this.filteredData.sort((a: any, b: any) => {
      const valueA = a[column] || "";
      const valueB = b[column] || "";

      let comparison = 0;
      if (typeof valueA === "string" && typeof valueB === "string") {
        comparison = valueA.localeCompare(valueB);
      } else {
        comparison = valueA - valueB;
      }

      return this.sortDirection === "asc" ? comparison : -comparison;
    });

    this.updatePagination();
    this.saveCurrentState();
  }

  // Data loading methods
  connectToWebSocket(): void {
    if (!this.loading) {
      this.saveCurrentState();
    }

    if (this.socketSubscription) {
      this.socketSubscription.unsubscribe();
    }

    this.socketSubscription = this.webSocketService.connect().subscribe({
      next: (response: ProcessResponse) => {
        this.processData = response;
        this.updateTabCounts();
        this.loadTabData(this.activeTabIndex);
        setTimeout(() => {
          this.loading = false;
        }, 800);
      },
      error: (err) => {
        console.error("WebSocket error:", err);
        this.loading = false;
        setTimeout(() => this.connectToWebSocket(), 5000);
      },
      complete: () => {
        console.warn("WebSocket connection closed. Reconnecting...");
        setTimeout(() => this.connectToWebSocket(), 5000);
      },
    });
  }

  refreshData(): void {
    this.saveCurrentState();
    this.loading = true;
    this.selectedProcessIds.clear();
    setTimeout(() => this.connectToWebSocket(), 1200);
  }

  updateTabCounts(): void {
    if (!this.processData) return;
    this.tabs[0].count = this.processData.processusInitiateurSeulement?.nombre || 0;
    this.tabs[1].count = this.processData.processusLongs?.nombre || 0;
    this.tabs[2].count = this.processData.processusSansTâches?.nombre || 0;
    this.tabs[3].count = this.processData.ProcessusÉchoués?.nombre || 0;
  }

  loadTabData(tabIndex: number): void {
    if (!this.processData) return;

    let processes: ProcessData[] = [];
    switch (tabIndex) {
      case 0:
        processes = this.processData.processusInitiateurSeulement?.processus || [];
        break;
      case 1:
        processes = this.processData.processusLongs?.processus || [];
        break;
      case 2:
        processes = this.processData.processusSansTâches?.processus || [];
        break;
      case 3:
        processes = this.processData.ProcessusÉchoués?.processus || [];
        break;
    }

    this.originalDataSource = [...processes];
    this.filteredData = [...processes];

    this.restoreSelections();

    if (this.currentSearchValue) {
      this.applyFilter(this.currentSearchValue);
    }

    if (this.sortColumn) {
      this.sortData(this.sortColumn);
    }

    const maxPage = Math.max(1, Math.ceil(this.filteredData.length / this.pageSize));
    this.currentPage = Math.min(this.currentPage, maxPage);

    this.updatePagination();
  }

  private restoreSelections(): void {
    // Keep only valid selections
    const validIds = new Set(this.filteredData.map(p => p.processInstanceId));
    this.selectedProcessIds = new Set([...this.selectedProcessIds].filter(id => validIds.has(id)));
  }

  // Filter methods
  applyFilter(value: string): void {
    this.currentSearchValue = value.trim().toLowerCase();

    if (!this.currentSearchValue) {
      this.filteredData = [...this.originalDataSource];
    } else {
      this.filteredData = this.originalDataSource.filter(process =>
          process.processInstanceId?.toLowerCase().includes(this.currentSearchValue) ||
          process.processDefinitionId?.toLowerCase().includes(this.currentSearchValue) ||
          process.processInitiator?.toLowerCase().includes(this.currentSearchValue)
      );
    }

    this.currentPage = 1;
    this.updatePagination();
    this.saveCurrentState();
  }

  clearSearch(): void {
    this.currentSearchValue = "";
    this.filteredData = [...this.originalDataSource];
    this.currentPage = 1;
    this.updatePagination();
    this.saveCurrentState();
  }

  // Toast methods
  subscribeToToasts(): void {
    this.toastSubscription = this.toastService.toasts$.subscribe((toasts) => {
      this.toasts = toasts;
    });
  }

  removeToast(id: string): void {
    this.toastService.remove(id);
  }

  // Bulk actions
  performBulkAction(action: string): void {
    const selectedProcesses = this.filteredData.filter(p => this.selectedProcessIds.has(p.processInstanceId));
    if (!selectedProcesses.length) {
      this.toastService.warning("No Selection", "Please select at least one process");
      return;
    }

    let title = "";
    let message = "";
    let confirmText = "";
    let icon = "";
    let iconColor = "";
    let theme = "";

    switch (action) {
      case "suspend":
        title = "Confirmation de suspension groupée";
        message = `Êtes-vous sûr de vouloir suspendre ${selectedProcesses.length} processus sélectionnés ?`;
        confirmText = "Suspendre";
        icon = "pause_circle";
        iconColor = "#f59e42";
        theme = "";
        break;
      case "resume":
        title = "Confirmation de reprise groupée";
        message = `Êtes-vous sûr de vouloir reprendre ${selectedProcesses.length} processus sélectionnés ?`;
        confirmText = "Reprendre";
        icon = "play_circle";
        iconColor = "#4caf50";
        theme = "";
        break;
      case "terminate":
        title = "Confirmation d'arrêt groupé";
        message = `Êtes-vous sûr de vouloir arrêter ${selectedProcesses.length} processus sélectionnés ?`;
        confirmText = "Arrêter";
        icon = "stop_circle";
        iconColor = "#ef4444";
        theme = "danger";
        break;
      case "transfer":
        this.selectedTaskForTransfer = selectedProcesses.map(this.mapProcessToTask);
        this.showTransferModal = true;
        return;
    }

    this.bulkConfirmDialogConfig = {
      title,
      message,
      confirmText,
      cancelText: "Annuler",
      icon,
      iconColor,
      theme,
      action: action as "suspend" | "resume" | "terminate",
      processes: [...selectedProcesses],
    };
    this.showBulkConfirmDialog = true;
  }

  onBulkConfirmDialogResult(result: boolean): void {
    if (!result) {
      this.showBulkConfirmDialog = false;
      return;
    }

    const { action, processes } = this.bulkConfirmDialogConfig;
    if (!processes.length) return;

    switch (action) {
      case "suspend":
        processes.forEach(p => this.onToggleProcessSuspension(p.processInstanceId, false));
        break;
      case "resume":
        processes.forEach(p => this.onToggleProcessSuspension(p.processInstanceId, true));
        break;
      case "terminate":
        processes.forEach(p => this.onTerminateProcess(p.processInstanceId));
        break;
    }

    this.selectedProcessIds.clear();
    this.showBulkConfirmDialog = false;
  }

  // Process actions
  onToggleProcessSuspension(processId: string, isSuspended: boolean): void {
    const process = this.filteredData.find(p => p.processInstanceId === processId);
    if (!process) {
      this.toastService.error("Erreur", `Processus ${processId} non trouvé.`);
      return;
    }

    const originalInitiatorId = process.processInitiatorId || "";
    const action$ = isSuspended
        ? this.tasksService.ResumeProcess(processId, originalInitiatorId)
        : this.tasksService.SuspendProcess(processId, originalInitiatorId);

    action$.subscribe({
      next: (success: boolean) => {
        const actionText = isSuspended ? "repris" : "suspendu";
        if (success) {
          this.toastService.success(`Processus ${actionText}`, `Le processus ${processId} a été ${actionText}.`);
        } else {
          this.toastService.error("Erreur", `Échec de la ${isSuspended ? "reprise" : "suspension"} du processus ${processId}.`);
        }
      },
      error: () => {
        const actionText = isSuspended ? "reprendre" : "suspendre";
        this.toastService.error("Erreur", `Impossible de ${actionText} le processus ${processId}.`);
      },
    });
  }

  onTerminateProcess(processId: string): void {
    const process = this.filteredData.find(p => p.processInstanceId === processId);
    if (!process) {
      this.toastService.error("Erreur", `Processus ${processId} non trouvé.`);
      return;
    }

    const originalInitiatorId = process.processInitiatorId || "";
    this.tasksService.TerminateProcess(processId, originalInitiatorId).subscribe({
      next: (success) => {
        if (success) {
          this.toastService.success("Processus terminé", `Le processus ${processId} a été terminé avec succès.`);
        } else {
          this.toastService.error("Erreur", `Échec de la terminaison du processus ${processId}.`);
        }
      },
      error: () => {
        this.toastService.error("Erreur", `Impossible de terminer le processus ${processId}.`);
      },
    });
  }

  onTransferTask(processData: ProcessData): void {
    this.selectedTaskForTransfer = [this.mapProcessToTask(processData)];
    this.showTransferModal = true;
  }

  onCloseTransferModal(): void {
    this.showTransferModal = false;
    this.selectedTaskForTransfer = [];
    if (this.isAutoTransfer) {
      this.isAutoTransfer = false;
      this.transferQueue = [];
      this.selectedProcessIds.clear();
    }
  }

  onTaskTransferred(assignment: TaskAssignment | TaskAssignment[]): void {
    const assignments = Array.isArray(assignment) ? assignment : [assignment];
    for (const a of assignments) {
      const assignee = a.assigneeId || a.assigneeType;
      this.toastService.success("Tâche transférée", `La tâche ${a.taskId} a été transférée à ${assignee}.`);
    }

    if (this.isAutoTransfer) {
      this.showTransferModal = false;
      this.selectedTaskForTransfer = [];
      setTimeout(() => this.processNextTransfer(), 500);
    } else {
      this.refreshData();
    }
  }

  processNextTransfer(): void {
    if (!this.transferQueue.length) {
      this.showTransferModal = false;
      this.selectedTaskForTransfer = [];
      this.isAutoTransfer = false;
      this.selectedProcessIds.clear();
      return;
    }

    const next = this.transferQueue.shift();
    if (next) {
      this.selectedTaskForTransfer = [this.mapProcessToTask(next)];
      this.showTransferModal = true;
    }
  }

  mapProcessToTask(process: ProcessData): Task {
    return {
      id: process.taskId ?? `TASK-${process.processInstanceId}`,
      processInstanceId: process.processInstanceId,
      processDefinitionId: process.processDefinitionId,
      name: `Tâche pour ${process.processDefinitionId}`,
      description: `Tâche liée au processus ${process.processInstanceId}`,
      assignee: process.processInitiator,
      created: new Date(process.processStartTime),
      priority: 50,
      status: "assigned",
      managerId: process.managerId || null,
      managerEmail: process.managerEmail || null,
      groupName: process.groupName || null,
      groupId: process.groupId || null,
    };
  }

  // Utility methods
  trackByProcessId(index: number, process: ProcessData): string {
    return process.processInstanceId;
  }

  formatDate(dateString: string): string {
    return this.datePipe.transform(dateString, "medium") || "";
  }

  getInitials(name: string): string {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'N/A';
  }

  getProcessVersion(process: ProcessData): string {
    return '1.0'; // Default version, adjust based on your data structure
  }

  getProcessRole(process: ProcessData): string {
    return 'Utilisateur'; // Default role, adjust based on your data structure
  }
}
