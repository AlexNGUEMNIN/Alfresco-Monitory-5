import { Component, OnInit, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from "rxjs";
import {
  HistoryWebSocketService,
  ApiHistoryResponse,
} from "../../services/history-websocket.service";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

interface HistoryOperation {
  id: string;
  timestamp: Date;
  actionType:
    | "transfer"
    | "suspend"
    | "resume"
    | "terminate"
    | "start"
    | "cancelled";
  targetId: string;
  targetName: string;
  targetType: "process" | "task" | "user" | "system";
  initiator: string;
  initiatorRole: string;
  status: "success" | "failed" | "in_progress" | "partial" | "cancelled";
  description: string;
  affectedCount: number;
  duration?: string;
  ipAddress?: string;
  parameters?: any;
  errorDetails?: string;
  endTime?: Date;
  deleteReason?: string;
  cancelledBy?: string;
  timeline: {
    timestamp: Date;
    description: string;
    status: "completed" | "failed" | "in_progress";
  }[];
}

interface HistoryFilters {
  actionType: string;
  status: string;
  user: string;
  startDate: string;
  endDate: string;
}

interface DatePreset {
  label: string;
  value: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  company?: string;
}

@Component({
  selector: "app-historique",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./historique.component.html",
  styleUrls: ["./historique.component.scss"],
})
export class HistoriqueComponent implements OnInit, OnDestroy {
  // Make Math available for template
  Math = Math;

  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  // Data properties
  operations: HistoryOperation[] = [];
  filteredData: HistoryOperation[] = [];
  paginatedData: HistoryOperation[] = [];

  // Connection status
  isConnected = false;
  connectionError: string | null = null;

  // UI state
  loading = true;
  showDetailsModal = false;
  selectedOperation: HistoryOperation | null = null;
  showUserSuggestions = false;
  exportingPDF = false;
  exportingExcel = false;

  // Search and filters
  globalSearchTerm = "";
  filters: HistoryFilters = {
    actionType: "",
    status: "",
    user: "",
    startDate: "",
    endDate: "",
  };

  // Users for autocomplete
  users: User[] = [];
  filteredUsers: User[] = [];

  // Pagination
  currentPage = 1;
  pageSize = 25;
  totalPages = 1;
  visiblePageNumbers: number[] = [];

  // Table configuration
  tableColumns = [
    { key: "timestamp", label: "Timestamp" },
    { key: "actionType", label: "Type d'Action" },
    { key: "targetName", label: "Cible" },
    { key: "initiator", label: "Utilisateur" },
    { key: "status", label: "Statut" },
    { key: "description", label: "Description" },
  ];

  // Date presets
  datePresets: DatePreset[] = [
    { label: "Aujourd'hui", value: "today" },
    { label: "Cette semaine", value: "week" },
    { label: "Ce mois", value: "month" },
    { label: "3 derniers mois", value: "3months" },
    { label: "Tout", value: "all" },
  ];

  selectedDatePreset = "all";

  // Statistics
  totalOperations = 0;
  successfulOperations = 0;
  failedOperations = 0;
  successRate = 0;

  constructor(private historyWebSocketService: HistoryWebSocketService) {
    this.setupSearchDebouncing();
  }

  ngOnInit(): void {
    this.connectToWebSocket();
    this.loadUsers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.historyWebSocketService.disconnect();
  }

  private connectToWebSocket(): void {
    this.loading = true;

    // Subscribe to connection status
    this.historyWebSocketService.connectionStatus$
      .pipe(takeUntil(this.destroy$))
      .subscribe((connected) => {
        this.isConnected = connected;
        if (connected) {
          this.connectionError = null;
        }
      });

    // Subscribe to error messages
    this.historyWebSocketService.error$
      .pipe(takeUntil(this.destroy$))
      .subscribe((error) => {
        this.connectionError = error;
        this.loading = false;
      });

    // Subscribe to history data
    this.historyWebSocketService.historyData$
      .pipe(takeUntil(this.destroy$))
      .subscribe((apiData) => {
        this.transformApiDataToOperations(apiData);
        this.loading = false;
        this.applyFilters();
      });

    // Connect to WebSocket
    this.historyWebSocketService.connect();
  }

  private transformApiDataToOperations(apiData: ApiHistoryResponse[]): void {
    this.operations = apiData.map((item) =>
      this.mapApiResponseToOperation(item)
    );
  }

  private mapApiResponseToOperation(
    apiItem: ApiHistoryResponse
  ): HistoryOperation {
    const startDate = new Date(apiItem.startTime * 1000);
    const endDate = apiItem.endTime ? new Date(apiItem.endTime * 1000) : null;

    // Calculate duration if both start and end times exist
    const duration = endDate
      ? this.calculateDuration(startDate, endDate)
      : undefined;

    // Determine action type based on status and context
    const actionType = this.determineActionType(
      apiItem.status,
      apiItem.deleteReason
    );

    // Map status
    const status = this.mapApiStatus(apiItem.status);

    // Get initiator info with company
    const initiator =
      apiItem.startedByName || apiItem.startedByEmail || "Système";
    const initiatorCompany = this.determineCompany(apiItem.startedByEmail);
    const cancelledBy =
      apiItem.cancelledByName || apiItem.cancelledByEmail || undefined;

    return {
      id: apiItem.processId,
      timestamp: startDate,
      actionType,
      targetId: apiItem.definitionId,
      targetName: `Processus ${apiItem.processId}`,
      targetType: "process",
      initiator,
      initiatorRole: this.determineRole(apiItem.startedByEmail),
      status,
      description: this.generateDescriptionFromApi(apiItem),
      affectedCount: 1,
      duration,
      endTime: endDate || undefined,
      deleteReason: apiItem.deleteReason,
      cancelledBy,
      parameters: {
        processId: apiItem.processId,
        definitionId: apiItem.definitionId,
        startedByEmail: apiItem.startedByEmail,
        cancelledByEmail: apiItem.cancelledByEmail,
        company: initiatorCompany,
        cancelledByCompany: apiItem.cancelledByCompany,
      },
      timeline: this.generateTimelineFromApi(apiItem, startDate, endDate),
    };
  }

  private determineActionType(
    status: string,
    deleteReason: string
  ): HistoryOperation["actionType"] {
    switch (status.toUpperCase()) {
      case "CANCELLED":
        return "terminate";
      case "COMPLETED":
        return "transfer";
      case "SUSPENDED":
        return "suspend";
      case "ACTIVE":
        return "start";
      default:
        return "start";
    }
  }

  private mapApiStatus(status: string): HistoryOperation["status"] {
    switch (status.toUpperCase()) {
      case "CANCELLED":
        return "cancelled";
      case "COMPLETED":
        return "success";
      case "SUSPENDED":
        return "partial";
      case "ACTIVE":
        return "in_progress";
      case "FAILED":
        return "failed";
      default:
        return "in_progress";
    }
  }

  private determineRole(email: string): string {
    if (email?.includes("admin")) {
      return "Administrateur";
    } else if (email?.includes("test")) {
      return "Testeur";
    }
    return "Utilisateur";
  }

  private determineCompany(email: string): string {
    if (email?.includes("afriland")) {
      return "Afriland First Bank";
    } else if (email?.includes("gmail")) {
      return "Externe";
    } else if (email?.includes("test")) {
      return "Test Company";
    }
    return "Non spécifié";
  }

  private generateDescriptionFromApi(apiItem: ApiHistoryResponse): string {
    const status = apiItem.status.toUpperCase();

    switch (status) {
      case "CANCELLED":
        return `Processus annulé - ${apiItem.deleteReason}`;
      case "COMPLETED":
        return "Processus terminé avec succès";
      case "SUSPENDED":
        return "Processus suspendu";
      case "ACTIVE":
        return "Processus en cours d'exécution";
      default:
        return `Processus ${status.toLowerCase()}`;
    }
  }

  private calculateDuration(startDate: Date, endDate: Date): string {
    const durationMs = endDate.getTime() - startDate.getTime();
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}j ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private generateTimelineFromApi(
    apiItem: ApiHistoryResponse,
    startDate: Date,
    endDate: Date | null
  ): any[] {
    const timeline = [
      {
        timestamp: startDate,
        description: `Processus démarré par ${
          apiItem.startedByName || apiItem.startedByEmail
        }`,
        status: "completed",
      },
    ];

    if (endDate) {
      const status = apiItem.status.toUpperCase();
      timeline.push({
        timestamp: endDate,
        description:
          status === "CANCELLED"
            ? `Processus annulé par ${
                apiItem.cancelledByName || apiItem.cancelledByEmail || "Système"
              }`
            : `Processus terminé - ${status}`,
        status:
          status === "CANCELLED" || status === "FAILED"
            ? "failed"
            : "completed",
      });
    }

    return timeline;
  }

  private setupSearchDebouncing(): void {
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((term) => {
        this.performGlobalSearch(term);
      });
  }

  private loadUsers(): void {
    // Extract unique users from the operations data
    const uniqueUsers = new Set<string>();

    this.historyWebSocketService.historyData$
      .pipe(takeUntil(this.destroy$))
      .subscribe((apiData) => {
        apiData.forEach((item) => {
          if (item.startedByName) uniqueUsers.add(item.startedByName);
          if (item.startedByEmail) uniqueUsers.add(item.startedByEmail);
          if (item.cancelledByName) uniqueUsers.add(item.cancelledByName);
          if (item.cancelledByEmail) uniqueUsers.add(item.cancelledByEmail);
        });

        this.users = Array.from(uniqueUsers).map((user, index) => ({
          id: String(index + 1),
          name: user,
          email: user.includes("@") ? user : `${user}@afriland.com`,
          role: this.determineRole(user),
          company: this.determineCompany(user),
        }));
      });
  }

  // Search methods
  onGlobalSearch(): void {
    this.searchSubject.next(this.globalSearchTerm);
  }

  private performGlobalSearch(term: string): void {
    if (!term.trim()) {
      this.filteredData = [...this.operations];
    } else {
      const searchTerm = term.toLowerCase();
      this.filteredData = this.operations.filter(
        (op) =>
          op.targetName.toLowerCase().includes(searchTerm) ||
          op.targetId.toLowerCase().includes(searchTerm) ||
          op.initiator.toLowerCase().includes(searchTerm) ||
          op.description.toLowerCase().includes(searchTerm) ||
          this.getActionLabel(op.actionType).toLowerCase().includes(searchTerm)
      );
    }
    this.currentPage = 1;
    this.updatePagination();
  }

  clearGlobalSearch(): void {
    this.globalSearchTerm = "";
    this.performGlobalSearch("");
  }

  // User search methods
  onUserSearch(): void {
    const term = this.filters.user.toLowerCase();
    if (term) {
      this.filteredUsers = this.users.filter(
        (user) =>
          user.name.toLowerCase().includes(term) ||
          user.email.toLowerCase().includes(term) ||
          user.role.toLowerCase().includes(term)
      );
      this.showUserSuggestions = true;
    } else {
      this.filteredUsers = [];
      this.showUserSuggestions = false;
    }
  }

  selectUser(user: User): void {
    this.filters.user = user.name;
    this.showUserSuggestions = false;
    this.applyFilters();
  }

  // Filter methods
  applyFilters(): void {
    let filtered = [...this.operations];

    // Apply global search first
    if (this.globalSearchTerm) {
      const searchTerm = this.globalSearchTerm.toLowerCase();
      filtered = filtered.filter(
        (op) =>
          op.targetName.toLowerCase().includes(searchTerm) ||
          op.targetId.toLowerCase().includes(searchTerm) ||
          op.initiator.toLowerCase().includes(searchTerm) ||
          op.description.toLowerCase().includes(searchTerm)
      );
    }

    // Apply specific filters
    if (this.filters.actionType) {
      filtered = filtered.filter(
        (op) => op.actionType === this.filters.actionType
      );
    }

    if (this.filters.status) {
      filtered = filtered.filter((op) => op.status === this.filters.status);
    }

    if (this.filters.user) {
      filtered = filtered.filter((op) =>
        op.initiator.toLowerCase().includes(this.filters.user.toLowerCase())
      );
    }

    if (this.filters.startDate) {
      const startDate = new Date(this.filters.startDate);
      filtered = filtered.filter((op) => op.timestamp >= startDate);
    }

    if (this.filters.endDate) {
      const endDate = new Date(this.filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((op) => op.timestamp <= endDate);
    }

    this.filteredData = filtered;
    this.currentPage = 1;
    this.updatePagination();
  }

  applyDatePreset(preset: string): void {
    this.selectedDatePreset = preset;
    const now = new Date();

    switch (preset) {
      case "today":
        this.filters.startDate = now.toISOString().split("T")[0];
        this.filters.endDate = now.toISOString().split("T")[0];
        break;
      case "week":
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
        this.filters.startDate = weekStart.toISOString().split("T")[0];
        this.filters.endDate = new Date().toISOString().split("T")[0];
        break;
      case "month":
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        this.filters.startDate = monthStart.toISOString().split("T")[0];
        this.filters.endDate = new Date().toISOString().split("T")[0];
        break;
      case "3months":
        const threeMonthsAgo = new Date(now.setMonth(now.getMonth() - 3));
        this.filters.startDate = threeMonthsAgo.toISOString().split("T")[0];
        this.filters.endDate = new Date().toISOString().split("T")[0];
        break;
      case "all":
        this.filters.startDate = "";
        this.filters.endDate = "";
        break;
    }

    this.applyFilters();
  }

  getDatePresetClasses(preset: string): string {
    return preset === this.selectedDatePreset
      ? "bg-blue-600 text-white"
      : "bg-gray-100 text-gray-700 hover:bg-gray-200";
  }

  // Filter management
  hasActiveFilters(): boolean {
    return !!(
      this.filters.actionType ||
      this.filters.status ||
      this.filters.user ||
      this.filters.startDate ||
      this.filters.endDate ||
      this.globalSearchTerm
    );
  }

  getActiveFilters(): { key: string; label: string; value: string }[] {
    const active = [];

    if (this.filters.actionType) {
      active.push({
        key: "actionType",
        label: "Type",
        value: this.getActionLabel(this.filters.actionType),
      });
    }

    if (this.filters.status) {
      active.push({
        key: "status",
        label: "Statut",
        value: this.getStatusLabel(this.filters.status),
      });
    }

    if (this.filters.user) {
      active.push({
        key: "user",
        label: "Utilisateur",
        value: this.filters.user,
      });
    }

    if (this.filters.startDate) {
      active.push({
        key: "startDate",
        label: "Début",
        value: this.formatDate(new Date(this.filters.startDate)),
      });
    }

    if (this.filters.endDate) {
      active.push({
        key: "endDate",
        label: "Fin",
        value: this.formatDate(new Date(this.filters.endDate)),
      });
    }

    if (this.globalSearchTerm) {
      active.push({
        key: "globalSearch",
        label: "Recherche",
        value: this.globalSearchTerm,
      });
    }

    return active;
  }

  removeFilter(key: string): void {
    switch (key) {
      case "actionType":
        this.filters.actionType = "";
        break;
      case "status":
        this.filters.status = "";
        break;
      case "user":
        this.filters.user = "";
        break;
      case "startDate":
        this.filters.startDate = "";
        break;
      case "endDate":
        this.filters.endDate = "";
        break;
      case "globalSearch":
        this.globalSearchTerm = "";
        break;
    }
    this.applyFilters();
  }

  clearAllFilters(): void {
    this.filters = {
      actionType: "",
      status: "",
      user: "",
      startDate: "",
      endDate: "",
    };
    this.globalSearchTerm = "";
    this.selectedDatePreset = "all";
    this.applyFilters();
  }

  // Pagination methods
  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredData.length / this.pageSize);

    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages || 1;
    }

    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = Math.min(
      startIndex + this.pageSize,
      this.filteredData.length
    );
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
        this.visiblePageNumbers.push(-1);
        this.visiblePageNumbers.push(this.totalPages);
      } else if (this.currentPage >= this.totalPages - 3) {
        this.visiblePageNumbers.push(1);
        this.visiblePageNumbers.push(-1);
        for (let i = this.totalPages - 4; i <= this.totalPages; i++) {
          this.visiblePageNumbers.push(i);
        }
      } else {
        this.visiblePageNumbers.push(1);
        this.visiblePageNumbers.push(-1);
        for (let i = this.currentPage - 1; i <= this.currentPage + 1; i++) {
          this.visiblePageNumbers.push(i);
        }
        this.visiblePageNumbers.push(-1);
        this.visiblePageNumbers.push(this.totalPages);
      }
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.updatePagination();
  }

  getPageButtonClasses(pageNum: number): string {
    if (pageNum === -1) {
      return "text-gray-500 bg-white border-gray-300 cursor-default";
    }
    if (pageNum === this.currentPage) {
      return "bg-blue-600 text-white border-blue-600";
    }
    return "text-gray-500 bg-white border-gray-300 hover:bg-gray-50";
  }

  // Sorting methods
  sortData(column: string): void {
    // Implementation for sorting
    console.log("Sorting by:", column);
  }

  // Modal methods
  viewOperationDetails(operation: HistoryOperation): void {
    this.selectedOperation = operation;
    this.showDetailsModal = true;
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedOperation = null;
  }

  // Action methods
  retryOperation(operation: HistoryOperation): void {
    console.log("Retrying operation:", operation.id);
    // Implementation for retry
  }

  duplicateOperation(operation: HistoryOperation): void {
    console.log("Duplicating operation:", operation.id);
    // Implementation for duplicate
  }

  refreshData(): void {
    this.loading = true;
    this.connectionError = null;

    // Reconnect to get fresh data
    this.historyWebSocketService.disconnect();
    setTimeout(() => {
      this.historyWebSocketService.connect();
    }, 1000);
  }

  // Export methods
  exportToPDF(): void {
    if (this.exportingPDF) return;

    this.exportingPDF = true;
    console.log("Exporting to PDF...");

    try {
      const doc = new jsPDF("l", "mm", "a4"); // Landscape orientation for better table display

      // Add header
      doc.setFontSize(20);
      doc.setTextColor(30, 58, 138); // Blue color
      doc.text("HISTORIQUE DES OPÉRATIONS", 20, 20);

      // Add subtitle
      doc.setFontSize(12);
      doc.setTextColor(75, 85, 99); // Gray color
      doc.text(
        "Traçabilité complète de toutes les opérations effectuées dans le système APS",
        20,
        30
      );

      // Add generation date
      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128);
      const currentDate = new Date().toLocaleString("fr-FR");
      doc.text(`Généré le: ${currentDate}`, 20, 40);

      // Add statistics
      doc.text(`Total des opérations: ${this.filteredData.length}`, 20, 48);
      const successCount = this.filteredData.filter(
        (op) => op.status === "success"
      ).length;
      const failedCount = this.filteredData.filter(
        (op) => op.status === "failed"
      ).length;
      doc.text(`Succès: ${successCount} | Échecs: ${failedCount}`, 150, 48);

      // Prepare table data
      const tableColumns = [
        "Date/Heure",
        "Type d'Action",
        "Cible",
        "Utilisateur",
        "Rôle",
        "Statut",
        "Description",
        "Durée",
      ];

      const tableRows = this.filteredData.map((operation) => [
        this.formatDate(operation.timestamp),
        this.getActionLabel(operation.actionType),
        operation.targetName,
        operation.initiator,
        operation.initiatorRole,
        this.getStatusLabel(operation.status),
        operation.description.length > 50
          ? operation.description.substring(0, 50) + "..."
          : operation.description,
        operation.duration || "N/A",
      ]);

      // Add table
      autoTable(doc, {
        head: [tableColumns],
        body: tableRows,
        startY: 55,
        styles: {
          fontSize: 8,
          cellPadding: 3,
          halign: "left",
        },
        headStyles: {
          fillColor: [59, 130, 246], // Blue background
          textColor: [255, 255, 255], // White text
          fontStyle: "bold",
          fontSize: 9,
        },
        columnStyles: {
          0: { cellWidth: 35 }, // Date
          1: { cellWidth: 25 }, // Action Type
          2: { cellWidth: 40 }, // Target
          3: { cellWidth: 30 }, // User
          4: { cellWidth: 25 }, // Role
          5: { cellWidth: 20 }, // Status
          6: { cellWidth: 60 }, // Description
          7: { cellWidth: 20 }, // Duration
        },
        alternateRowStyles: {
          fillColor: [249, 250, 251], // Light gray
        },
        margin: { top: 55, left: 20, right: 20 },
      });

      // Add footer
      const pageCount = doc.internal.pages.length - 1;
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(107, 114, 128);
        doc.text(
          `Page ${i} sur ${pageCount}`,
          doc.internal.pageSize.width - 40,
          doc.internal.pageSize.height - 10
        );
        doc.text(
          "Système de Monitoring APS - Afriland First Bank",
          20,
          doc.internal.pageSize.height - 10
        );
      }

      // Save the PDF
      const fileName = `historique-operations-${
        new Date().toISOString().split("T")[0]
      }.pdf`;
      doc.save(fileName);

      console.log("PDF exported successfully");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      alert("Erreur lors de l'export PDF. Veuillez réessayer.");
    } finally {
      this.exportingPDF = false;
    }
  }

  exportToExcel(): void {
    if (this.exportingExcel) return;

    this.exportingExcel = true;
    console.log("Exporting to Excel...");

    try {
      // Prepare data for Excel
      const excelData = this.filteredData.map((operation) => ({
        "Date/Heure": this.formatDate(operation.timestamp),
        "Type d'Action": this.getActionLabel(operation.actionType),
        Cible: operation.targetName,
        "Type de Cible": operation.targetType,
        Utilisateur: operation.initiator,
        Rôle: operation.initiatorRole,
        Statut: this.getStatusLabel(operation.status),
        Description: operation.description,
        "Nombre d'Éléments Affectés": operation.affectedCount,
        Durée: operation.duration || "N/A",
        "Heure de Fin": operation.endTime
          ? this.formatDate(operation.endTime)
          : "N/A",
        "Raison de Suppression": operation.deleteReason || "N/A",
        "Annulé Par": operation.cancelledBy || "N/A",
        "Adresse IP": operation.ipAddress || "N/A",
        "ID de Processus": operation.parameters?.processId || "N/A",
        "ID de Définition": operation.parameters?.definitionId || "N/A",
        "Email de l'Initiateur": operation.parameters?.startedByEmail || "N/A",
        Société: operation.parameters?.company || "N/A",
      }));

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const columnWidths = [
        { wch: 20 }, // Date/Heure
        { wch: 15 }, // Type d'Action
        { wch: 25 }, // Cible
        { wch: 15 }, // Type de Cible
        { wch: 20 }, // Utilisateur
        { wch: 15 }, // Rôle
        { wch: 12 }, // Statut
        { wch: 50 }, // Description
        { wch: 10 }, // Nombre d'Éléments Affectés
        { wch: 15 }, // Durée
        { wch: 20 }, // Heure de Fin
        { wch: 25 }, // Raison de Suppression
        { wch: 20 }, // Annulé Par
        { wch: 15 }, // Adresse IP
        { wch: 20 }, // ID de Processus
        { wch: 20 }, // ID de Définition
        { wch: 25 }, // Email de l'Initiateur
        { wch: 20 }, // Société
      ];
      worksheet["!cols"] = columnWidths;

      // Add summary sheet
      const summaryData = [
        { Métrique: "Total des Opérations", Valeur: this.filteredData.length },
        {
          Métrique: "Opérations Réussies",
          Valeur: this.filteredData.filter((op) => op.status === "success")
            .length,
        },
        {
          Métrique: "Opérations Échouées",
          Valeur: this.filteredData.filter((op) => op.status === "failed")
            .length,
        },
        {
          Métrique: "Opérations en Cours",
          Valeur: this.filteredData.filter((op) => op.status === "in_progress")
            .length,
        },
        {
          Métrique: "Opérations Annulées",
          Valeur: this.filteredData.filter((op) => op.status === "cancelled")
            .length,
        },
        {
          Métrique: "Date de Génération",
          Valeur: new Date().toLocaleString("fr-FR"),
        },
      ];

      const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
      summaryWorksheet["!cols"] = [{ wch: 25 }, { wch: 20 }];

      // Add worksheets to workbook
      XLSX.utils.book_append_sheet(workbook, summaryWorksheet, "Résumé");
      XLSX.utils.book_append_sheet(workbook, worksheet, "Historique Détaillé");

      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
        compression: true,
      });

      // Save the file
      const fileName = `historique-operations-${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(blob, fileName);

      console.log("Excel exported successfully");
    } catch (error) {
      console.error("Error exporting Excel:", error);
      alert("Erreur lors de l'export Excel. Veuillez réessayer.");
    } finally {
      this.exportingExcel = false;
    }
  }

  // Utility methods
  trackByOperationId(index: number, operation: HistoryOperation): string {
    return operation.id;
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  }

  formatTimestampRange(operation: HistoryOperation): string {
    const startFormatted = this.formatDate(operation.timestamp);
    if (operation.endTime) {
      const endFormatted = this.formatDate(operation.endTime);
      return `${startFormatted} → ${endFormatted}`;
    }
    return `${startFormatted} (En cours)`;
  }

  getInitiatorDisplayName(operation: HistoryOperation): string {
    return operation.initiator;
  }

  getInitiatorCompany(operation: HistoryOperation): string {
    return (
      operation.parameters?.company ||
      this.determineCompany(operation.parameters?.startedByEmail || "")
    );
  }

  getInitials(name: string): string {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  getActionLabel(actionType: string): string {
    const labels: { [key: string]: string } = {
      transfer: "Transfert",
      suspend: "Suspension",
      resume: "Relance",
      terminate: "Arrêt",
      start: "Démarrage",
      cancelled: "Annulé",
    };
    return labels[actionType] || actionType;
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      success: "Réussi",
      failed: "Échoué",
      in_progress: "En cours",
      partial: "Partiel",
      cancelled: "Annulé",
    };
    return labels[status] || status;
  }

  getActionTypeClasses(actionType: string): string {
    const classes: { [key: string]: string } = {
      transfer: "bg-blue-100 text-blue-800",
      suspend: "bg-yellow-100 text-yellow-800",
      resume: "bg-green-100 text-green-800",
      terminate: "bg-red-100 text-red-800",
      start: "bg-purple-100 text-purple-800",
    };
    return classes[actionType] || "bg-gray-100 text-gray-800";
  }

  getStatusClasses(status: string): string {
    const classes: { [key: string]: string } = {
      success: "bg-green-100 text-green-800",
      failed: "bg-red-100 text-red-800",
      in_progress: "bg-blue-100 text-blue-800",
      partial: "bg-yellow-100 text-yellow-800",
      cancelled: "bg-gray-100 text-gray-800",
    };
    return classes[status] || "bg-gray-100 text-gray-800";
  }

  getStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      success: "bg-green-500",
      failed: "bg-red-500",
      in_progress: "bg-blue-500",
      partial: "bg-yellow-500",
      cancelled: "bg-gray-500",
    };
    return colors[status] || "bg-gray-500";
  }

  getActionIcon(actionType: string): string {
    const icons: { [key: string]: string } = {
      transfer:
        '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>',
      suspend:
        '<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path>',
      resume:
        '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path>',
      terminate:
        '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clip-rule="evenodd"></path>',
      start:
        '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path>',
    };
    return icons[actionType] || "";
  }

  getStatusIcon(status: string): string {
    const icons: { [key: string]: string } = {
      success:
        '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>',
      failed:
        '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>',
      in_progress:
        '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"></path>',
      partial:
        '<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>',
    };
    return icons[status] || "";
  }
}
