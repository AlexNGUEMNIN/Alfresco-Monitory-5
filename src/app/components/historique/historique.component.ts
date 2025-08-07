import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

interface HistoryOperation {
  id: string;
  timestamp: Date;
  actionType: 'transfer' | 'suspend' | 'resume' | 'terminate' | 'start' | 'admin';
  targetId: string;
  targetName: string;
  targetType: 'process' | 'task' | 'user' | 'system';
  initiator: string;
  initiatorRole: string;
  status: 'success' | 'failed' | 'in_progress' | 'partial';
  description: string;
  affectedCount: number;
  duration?: string;
  ipAddress?: string;
  parameters?: any;
  errorDetails?: string;
  timeline: {
    timestamp: Date;
    description: string;
    status: 'completed' | 'failed' | 'in_progress';
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
}

@Component({
  selector: 'app-historique',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './historique.component.html',
  styleUrls: ['./historique.component.scss']
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
  
  // UI state
  loading = true;
  showDetailsModal = false;
  selectedOperation: HistoryOperation | null = null;
  showUserSuggestions = false;
  
  // Search and filters
  globalSearchTerm = '';
  filters: HistoryFilters = {
    actionType: '',
    status: '',
    user: '',
    startDate: '',
    endDate: ''
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
    { key: 'timestamp', label: 'Timestamp' },
    { key: 'actionType', label: 'Type d\'Action' },
    { key: 'targetName', label: 'Cible' },
    { key: 'initiator', label: 'Utilisateur' },
    { key: 'status', label: 'Statut' },
    { key: 'description', label: 'Description' }
  ];
  
  // Date presets
  datePresets: DatePreset[] = [
    { label: 'Aujourd\'hui', value: 'today' },
    { label: 'Cette semaine', value: 'week' },
    { label: 'Ce mois', value: 'month' },
    { label: '3 derniers mois', value: '3months' },
    { label: 'Tout', value: 'all' }
  ];
  
  selectedDatePreset = 'all';
  
  // Statistics
  totalOperations = 0;
  successfulOperations = 0;
  failedOperations = 0;
  successRate = 0;
  
  constructor() {
    this.setupSearchDebouncing();
  }
  
  ngOnInit(): void {
    this.loadMockData();
    this.loadUsers();
    setTimeout(() => {
      this.loading = false;
      this.applyFilters();
    }, 1500);
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  private setupSearchDebouncing(): void {
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(term => {
        this.performGlobalSearch(term);
      });
  }
  
  private loadMockData(): void {
    // Generate mock history operations
    const actionTypes: HistoryOperation['actionType'][] = ['transfer', 'suspend', 'resume', 'terminate', 'start', 'admin'];
    const statuses: HistoryOperation['status'][] = ['success', 'failed', 'in_progress', 'partial'];
    const users = ['Jean Dupont', 'Marie Martin', 'Pierre Durand', 'Sophie Legrand', 'Antoine Robert'];
    const roles = ['Analyste', 'Manager', 'Superviseur', 'Opérateur', 'Admin'];
    
    this.operations = [];
    
    for (let i = 0; i < 150; i++) {
      const actionType = actionTypes[Math.floor(Math.random() * actionTypes.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const user = users[Math.floor(Math.random() * users.length)];
      const role = roles[Math.floor(Math.random() * roles.length)];
      
      const operation: HistoryOperation = {
        id: `OP-${String(i + 1).padStart(4, '0')}`,
        timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        actionType,
        targetId: `TARGET-${String(i + 1).padStart(4, '0')}`,
        targetName: `${this.getActionLabel(actionType)} - Processus ${i + 1}`,
        targetType: Math.random() > 0.5 ? 'process' : 'task',
        initiator: user,
        initiatorRole: role,
        status,
        description: this.generateDescription(actionType, status),
        affectedCount: Math.floor(Math.random() * 10) + 1,
        duration: status === 'success' ? `${Math.floor(Math.random() * 5000)}ms` : undefined,
        ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
        parameters: {
          processId: `PROC-${i + 1}`,
          userId: user,
          timestamp: new Date().toISOString()
        },
        errorDetails: status === 'failed' ? 'Timeout de connexion à la base de données' : undefined,
        timeline: this.generateTimeline(actionType, status)
      };
      
      this.operations.push(operation);
    }
    
    this.calculateStatistics();
  }
  
  private loadUsers(): void {
    this.users = [
      { id: '1', name: 'Jean Dupont', email: 'jean.dupont@afriland.com', role: 'Analyste' },
      { id: '2', name: 'Marie Martin', email: 'marie.martin@afriland.com', role: 'Manager' },
      { id: '3', name: 'Pierre Durand', email: 'pierre.durand@afriland.com', role: 'Superviseur' },
      { id: '4', name: 'Sophie Legrand', email: 'sophie.legrand@afriland.com', role: 'Opérateur' },
      { id: '5', name: 'Antoine Robert', email: 'antoine.robert@afriland.com', role: 'Admin' }
    ];
  }
  
  private generateDescription(actionType: string, status: string): string {
    const descriptions = {
      transfer: status === 'success' ? 'Transfert effectué avec succès' : 'Échec du transfert',
      suspend: status === 'success' ? 'Processus suspendu' : 'Échec de la suspension',
      resume: status === 'success' ? 'Processus repris' : 'Échec de la reprise',
      terminate: status === 'success' ? 'Processus terminé' : 'Échec de la terminaison',
      start: status === 'success' ? 'Processus démarré' : 'Échec du démarrage',
      admin: status === 'success' ? 'Action administrative effectuée' : 'Échec de l\'action administrative'
    };
    return descriptions[actionType as keyof typeof descriptions] || 'Opération effectuée';
  }
  
  private generateTimeline(actionType: string, status: string): any[] {
    const timeline = [
      {
        timestamp: new Date(Date.now() - 5000),
        description: 'Initialisation de l\'opération',
        status: 'completed'
      },
      {
        timestamp: new Date(Date.now() - 3000),
        description: 'Validation des paramètres',
        status: 'completed'
      },
      {
        timestamp: new Date(Date.now() - 1000),
        description: 'Exécution de l\'action',
        status: status === 'success' ? 'completed' : 'failed'
      }
    ];
    
    if (status === 'success') {
      timeline.push({
        timestamp: new Date(),
        description: 'Opération terminée avec succès',
        status: 'completed'
      });
    }
    
    return timeline;
  }
  
  private calculateStatistics(): void {
    this.totalOperations = this.operations.length;
    this.successfulOperations = this.operations.filter(op => op.status === 'success').length;
    this.failedOperations = this.operations.filter(op => op.status === 'failed').length;
    this.successRate = this.totalOperations > 0 ? Math.round((this.successfulOperations / this.totalOperations) * 100) : 0;
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
      this.filteredData = this.operations.filter(op =>
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
    this.globalSearchTerm = '';
    this.performGlobalSearch('');
  }
  
  // User search methods
  onUserSearch(): void {
    const term = this.filters.user.toLowerCase();
    if (term) {
      this.filteredUsers = this.users.filter(user =>
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
      filtered = filtered.filter(op =>
        op.targetName.toLowerCase().includes(searchTerm) ||
        op.targetId.toLowerCase().includes(searchTerm) ||
        op.initiator.toLowerCase().includes(searchTerm) ||
        op.description.toLowerCase().includes(searchTerm)
      );
    }
    
    // Apply specific filters
    if (this.filters.actionType) {
      filtered = filtered.filter(op => op.actionType === this.filters.actionType);
    }
    
    if (this.filters.status) {
      filtered = filtered.filter(op => op.status === this.filters.status);
    }
    
    if (this.filters.user) {
      filtered = filtered.filter(op => 
        op.initiator.toLowerCase().includes(this.filters.user.toLowerCase())
      );
    }
    
    if (this.filters.startDate) {
      const startDate = new Date(this.filters.startDate);
      filtered = filtered.filter(op => op.timestamp >= startDate);
    }
    
    if (this.filters.endDate) {
      const endDate = new Date(this.filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(op => op.timestamp <= endDate);
    }
    
    this.filteredData = filtered;
    this.currentPage = 1;
    this.updatePagination();
  }
  
  applyDatePreset(preset: string): void {
    this.selectedDatePreset = preset;
    const now = new Date();
    
    switch (preset) {
      case 'today':
        this.filters.startDate = now.toISOString().split('T')[0];
        this.filters.endDate = now.toISOString().split('T')[0];
        break;
      case 'week':
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
        this.filters.startDate = weekStart.toISOString().split('T')[0];
        this.filters.endDate = new Date().toISOString().split('T')[0];
        break;
      case 'month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        this.filters.startDate = monthStart.toISOString().split('T')[0];
        this.filters.endDate = new Date().toISOString().split('T')[0];
        break;
      case '3months':
        const threeMonthsAgo = new Date(now.setMonth(now.getMonth() - 3));
        this.filters.startDate = threeMonthsAgo.toISOString().split('T')[0];
        this.filters.endDate = new Date().toISOString().split('T')[0];
        break;
      case 'all':
        this.filters.startDate = '';
        this.filters.endDate = '';
        break;
    }
    
    this.applyFilters();
  }
  
  getDatePresetClasses(preset: string): string {
    return preset === this.selectedDatePreset
      ? 'bg-blue-600 text-white'
      : 'bg-gray-100 text-gray-700 hover:bg-gray-200';
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
        key: 'actionType',
        label: 'Type',
        value: this.getActionLabel(this.filters.actionType)
      });
    }
    
    if (this.filters.status) {
      active.push({
        key: 'status',
        label: 'Statut',
        value: this.getStatusLabel(this.filters.status)
      });
    }
    
    if (this.filters.user) {
      active.push({
        key: 'user',
        label: 'Utilisateur',
        value: this.filters.user
      });
    }
    
    if (this.filters.startDate) {
      active.push({
        key: 'startDate',
        label: 'Début',
        value: this.formatDate(new Date(this.filters.startDate))
      });
    }
    
    if (this.filters.endDate) {
      active.push({
        key: 'endDate',
        label: 'Fin',
        value: this.formatDate(new Date(this.filters.endDate))
      });
    }
    
    if (this.globalSearchTerm) {
      active.push({
        key: 'globalSearch',
        label: 'Recherche',
        value: this.globalSearchTerm
      });
    }
    
    return active;
  }
  
  removeFilter(key: string): void {
    switch (key) {
      case 'actionType':
        this.filters.actionType = '';
        break;
      case 'status':
        this.filters.status = '';
        break;
      case 'user':
        this.filters.user = '';
        break;
      case 'startDate':
        this.filters.startDate = '';
        break;
      case 'endDate':
        this.filters.endDate = '';
        break;
      case 'globalSearch':
        this.globalSearchTerm = '';
        break;
    }
    this.applyFilters();
  }
  
  clearAllFilters(): void {
    this.filters = {
      actionType: '',
      status: '',
      user: '',
      startDate: '',
      endDate: ''
    };
    this.globalSearchTerm = '';
    this.selectedDatePreset = 'all';
    this.applyFilters();
  }
  
  // Pagination methods
  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredData.length / this.pageSize);
    
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages || 1;
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
      return 'text-gray-500 bg-white border-gray-300 cursor-default';
    }
    if (pageNum === this.currentPage) {
      return 'bg-blue-600 text-white border-blue-600';
    }
    return 'text-gray-500 bg-white border-gray-300 hover:bg-gray-50';
  }
  
  // Sorting methods
  sortData(column: string): void {
    // Implementation for sorting
    console.log('Sorting by:', column);
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
    console.log('Retrying operation:', operation.id);
    // Implementation for retry
  }
  
  duplicateOperation(operation: HistoryOperation): void {
    console.log('Duplicating operation:', operation.id);
    // Implementation for duplicate
  }
  
  refreshData(): void {
    this.loading = true;
    setTimeout(() => {
      this.loadMockData();
      this.loading = false;
      this.applyFilters();
    }, 1000);
  }
  
  // Export methods
  exportToPDF(): void {
    console.log('Exporting to PDF...');
    // Implementation for PDF export
  }
  
  exportToExcel(): void {
    console.log('Exporting to Excel...');
    // Implementation for Excel export
  }
  
  // Utility methods
  trackByOperationId(index: number, operation: HistoryOperation): string {
    return operation.id;
  }
  
  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  }
  
  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
  
  getActionLabel(actionType: string): string {
    const labels: { [key: string]: string } = {
      transfer: 'Transfert',
      suspend: 'Suspension',
      resume: 'Reprise',
      terminate: 'Arrêt',
      start: 'Lancement',
      admin: 'Administration'
    };
    return labels[actionType] || actionType;
  }
  
  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      success: 'Réussi',
      failed: 'Échoué',
      in_progress: 'En cours',
      partial: 'Partiel'
    };
    return labels[status] || status;
  }
  
  getActionTypeClasses(actionType: string): string {
    const classes: { [key: string]: string } = {
      transfer: 'bg-blue-100 text-blue-800',
      suspend: 'bg-yellow-100 text-yellow-800',
      resume: 'bg-green-100 text-green-800',
      terminate: 'bg-red-100 text-red-800',
      start: 'bg-purple-100 text-purple-800',
      admin: 'bg-gray-100 text-gray-800'
    };
    return classes[actionType] || 'bg-gray-100 text-gray-800';
  }
  
  getStatusClasses(status: string): string {
    const classes: { [key: string]: string } = {
      success: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      in_progress: 'bg-blue-100 text-blue-800',
      partial: 'bg-yellow-100 text-yellow-800'
    };
    return classes[status] || 'bg-gray-100 text-gray-800';
  }
  
  getStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      success: 'bg-green-500',
      failed: 'bg-red-500',
      in_progress: 'bg-blue-500',
      partial: 'bg-yellow-500'
    };
    return colors[status] || 'bg-gray-500';
  }
  
  getActionIcon(actionType: string): string {
    const icons: { [key: string]: string } = {
      transfer: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>',
      suspend: '<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path>',
      resume: '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path>',
      terminate: '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clip-rule="evenodd"></path>',
      start: '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path>',
      admin: '<path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"></path>'
    };
    return icons[actionType] || '';
  }
  
  getStatusIcon(status: string): string {
    const icons: { [key: string]: string } = {
      success: '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>',
      failed: '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>',
      in_progress: '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"></path>',
      partial: '<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>'
    };
    return icons[status] || '';
  }
}