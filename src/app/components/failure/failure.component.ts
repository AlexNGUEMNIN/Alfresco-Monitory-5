import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

interface Failure {
  id: string;
  timestamp: Date;
  errorCode: string;
  errorMessage: string;
  errorType: 'system' | 'validation' | 'user' | 'timeout' | 'integration';
  criticality: 'critical' | 'high' | 'medium' | 'low';
  processId: string;
  processName: string;
  failureStep?: string;
  affectedUser?: string;
  environment?: string;
  stackTrace?: string;
  assignee?: string;
  assigneeTeam?: string;
  resolutionStatus: 'new' | 'investigating' | 'resolved' | 'ignored' | 'escalated';
  timeToResolve?: string;
  resolutionHistory?: {
    timestamp: Date;
    action: string;
    description: string;
    user: string;
    status: 'completed' | 'failed' | 'in_progress';
  }[];
}

interface FailureFilters {
  criticality: string;
  errorType: string;
  resolutionStatus: string;
  errorCode: string;
  assignee: string;
}

interface ErrorCode {
  code: string;
  description: string;
  frequency: number;
}

interface Assignee {
  id: string;
  name: string;
  team: string;
  role: string;
}

interface CriticalityLevel {
  value: string;
  label: string;
  color: string;
}

@Component({
  selector: 'app-failure',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './failure.component.html',
  styleUrls: ['./failure.component.scss']
})
export class FailureComponent implements OnInit, OnDestroy {
  // Make Math available for template
  Math = Math;
  
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();
  
  // Data properties
  failures: Failure[] = [];
  filteredData: Failure[] = [];
  paginatedData: Failure[] = [];
  
  // UI state
  loading = true;
  showDetailsModal = false;
  showAssignmentModal = false;
  selectedFailure: Failure | null = null;
  failureToAssign: Failure | null = null;
  
  // Search and filters
  globalSearchTerm = '';
  filters: FailureFilters = {
    criticality: '',
    errorType: '',
    resolutionStatus: '',
    errorCode: '',
    assignee: ''
  };
  
  selectedTimeRange = '24h';
  
  // Autocomplete data
  errorCodes: ErrorCode[] = [];
  filteredErrorCodes: ErrorCode[] = [];
  showErrorCodeSuggestions = false;
  
  assignees: Assignee[] = [];
  filteredAssignees: Assignee[] = [];
  showAssigneeSuggestions = false;
  
  // Assignment modal data
  selectedAssignee: Assignee | null = null;
  assigneeSearchTerm = '';
  assignmentPriority = 'medium';
  assignmentDueDate = '';
  assignmentComments = '';
  
  // Pagination
  currentPage = 1;
  pageSize = 25;
  totalPages = 1;
  visiblePageNumbers: number[] = [];
  
  // Table configuration
  tableColumns = [
    { key: 'timestamp', label: 'Timestamp' },
    { key: 'criticality', label: 'Criticité & Type' },
    { key: 'errorCode', label: 'Code & Message' },
    { key: 'processName', label: 'Processus' },
    { key: 'assignee', label: 'Assigné à' },
    { key: 'resolutionStatus', label: 'Statut Résolution' }
  ];
  
  // Criticality levels
  criticalityLevels: CriticalityLevel[] = [
    { value: 'critical', label: 'Critique', color: 'bg-red-500' },
    { value: 'high', label: 'Élevée', color: 'bg-orange-500' },
    { value: 'medium', label: 'Moyenne', color: 'bg-yellow-500' },
    { value: 'low', label: 'Faible', color: 'bg-green-500' }
  ];
  
  selectedCriticalityFilter = '';
  
  // Statistics
  criticalFailures = 0;
  activeFailures = 0;
  resolvedFailures = 0;
  resolutionRate = 0;
  
  constructor() {
    this.setupSearchDebouncing();
  }
  
  ngOnInit(): void {
    this.loadMockData();
    this.loadErrorCodes();
    this.loadAssignees();
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
    const errorTypes: Failure['errorType'][] = ['system', 'validation', 'user', 'timeout', 'integration'];
    const criticalities: Failure['criticality'][] = ['critical', 'high', 'medium', 'low'];
    const resolutionStatuses: Failure['resolutionStatus'][] = ['new', 'investigating', 'resolved', 'ignored', 'escalated'];
    const processes = ['Demande de prêt', 'Ouverture de compte', 'Validation KYC', 'Transfert de fonds', 'Clôture de compte'];
    const users = ['Jean Dupont', 'Marie Martin', 'Pierre Durand', 'Sophie Legrand'];
    const teams = ['Support Technique', 'Équipe Crédit', 'Conformité', 'IT Operations'];
    
    this.failures = [];
    
    for (let i = 0; i < 120; i++) {
      const errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];
      const criticality = criticalities[Math.floor(Math.random() * criticalities.length)];
      const resolutionStatus = resolutionStatuses[Math.floor(Math.random() * resolutionStatuses.length)];
      const process = processes[Math.floor(Math.random() * processes.length)];
      const user = users[Math.floor(Math.random() * users.length)];
      const team = teams[Math.floor(Math.random() * teams.length)];
      
      const failure: Failure = {
        id: `FAIL-${String(i + 1).padStart(4, '0')}`,
        timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        errorCode: this.generateErrorCode(errorType, i),
        errorMessage: this.generateErrorMessage(errorType),
        errorType,
        criticality,
        processId: `PROC-${String(i + 1).padStart(4, '0')}`,
        processName: process,
        failureStep: `Étape ${Math.floor(Math.random() * 5) + 1}`,
        affectedUser: Math.random() > 0.3 ? user : undefined,
        environment: 'Production',
        stackTrace: this.generateStackTrace(errorType),
        assignee: resolutionStatus !== 'new' ? user : undefined,
        assigneeTeam: resolutionStatus !== 'new' ? team : undefined,
        resolutionStatus,
        timeToResolve: resolutionStatus === 'resolved' ? `${Math.floor(Math.random() * 48)}h ${Math.floor(Math.random() * 60)}min` : undefined,
        resolutionHistory: this.generateResolutionHistory(resolutionStatus)
      };
      
      this.failures.push(failure);
    }
    
    this.calculateStatistics();
  }
  
  private loadErrorCodes(): void {
    this.errorCodes = [
      { code: 'ERR_DB_001', description: 'Timeout de connexion base de données', frequency: 45 },
      { code: 'ERR_VAL_002', description: 'Validation des données échouée', frequency: 32 },
      { code: 'ERR_AUTH_003', description: 'Authentification expirée', frequency: 28 },
      { code: 'ERR_NET_004', description: 'Erreur réseau', frequency: 23 },
      { code: 'ERR_SYS_005', description: 'Erreur système critique', frequency: 19 },
      { code: 'ERR_INT_006', description: 'Échec intégration service externe', frequency: 15 },
      { code: 'ERR_PROC_007', description: 'Erreur de processus métier', frequency: 12 },
      { code: 'ERR_FILE_008', description: 'Erreur de fichier', frequency: 8 }
    ];
  }
  
  private loadAssignees(): void {
    this.assignees = [
      { id: '1', name: 'Jean Dupont', team: 'Support Technique', role: 'Analyste Senior' },
      { id: '2', name: 'Marie Martin', team: 'IT Operations', role: 'Manager' },
      { id: '3', name: 'Pierre Durand', team: 'Équipe Crédit', role: 'Superviseur' },
      { id: '4', name: 'Sophie Legrand', team: 'Conformité', role: 'Spécialiste' },
      { id: '5', name: 'Antoine Robert', team: 'Support Technique', role: 'Technicien' },
      { id: '6', name: 'Équipe Support', team: 'Support Technique', role: 'Équipe' },
      { id: '7', name: 'Équipe DevOps', team: 'IT Operations', role: 'Équipe' }
    ];
  }
  
  private generateErrorCode(errorType: string, index: number): string {
    const prefixes = {
      system: 'ERR_SYS',
      validation: 'ERR_VAL',
      user: 'ERR_USR',
      timeout: 'ERR_TMO',
      integration: 'ERR_INT'
    };
    return `${prefixes[errorType as keyof typeof prefixes]}_${String(index + 1).padStart(3, '0')}`;
  }
  
  private generateErrorMessage(errorType: string): string {
    const messages = {
      system: 'Erreur système critique - Service indisponible',
      validation: 'Validation des données échouée - Format invalide',
      user: 'Erreur utilisateur - Permissions insuffisantes',
      timeout: 'Timeout dépassé - Connexion interrompue',
      integration: 'Échec intégration service externe - API indisponible'
    };
    return messages[errorType as keyof typeof messages] || 'Erreur inconnue';
  }
  
  private generateStackTrace(errorType: string): string {
    return `java.lang.RuntimeException: ${this.generateErrorMessage(errorType)}
    at com.afriland.aps.service.ProcessService.execute(ProcessService.java:245)
    at com.afriland.aps.controller.ProcessController.handleRequest(ProcessController.java:89)
    at org.springframework.web.method.support.InvocableHandlerMethod.invoke(InvocableHandlerMethod.java:197)
    at org.springframework.web.servlet.mvc.method.annotation.ServletInvocableHandlerMethod.invokeAndHandle(ServletInvocableHandlerMethod.java:85)
    at org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerAdapter.invokeHandlerMethod(RequestMappingHandlerAdapter.java:827)
    at org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerAdapter.handleInternal(RequestMappingHandlerAdapter.java:738)
    at org.springframework.web.servlet.mvc.method.AbstractHandlerMethodAdapter.handle(AbstractHandlerMethodAdapter.java:85)
    at org.springframework.web.servlet.DispatcherServlet.doDispatch(DispatcherServlet.java:963)
    at org.springframework.web.servlet.DispatcherServlet.doService(DispatcherServlet.java:897)
    at org.springframework.web.servlet.FrameworkServlet.processRequest(FrameworkServlet.java:970)`;
  }
  
  private generateResolutionHistory(status: string): any[] {
    if (status === 'new') return [];
    
    const history = [
      {
        timestamp: new Date(Date.now() - 3600000),
        action: 'Échec détecté',
        description: 'Échec automatiquement détecté par le système de monitoring',
        user: 'Système',
        status: 'completed'
      }
    ];
    
    if (status !== 'new') {
      history.push({
        timestamp: new Date(Date.now() - 1800000),
        action: 'Investigation démarrée',
        description: 'Assignation à l\'équipe technique pour investigation',
        user: 'Marie Martin',
        status: 'completed'
      });
    }
    
    if (status === 'resolved') {
      history.push({
        timestamp: new Date(Date.now() - 900000),
        action: 'Résolution appliquée',
        description: 'Correction déployée et testée avec succès',
        user: 'Jean Dupont',
        status: 'completed'
      });
    }
    
    return history;
  }
  
  private calculateStatistics(): void {
    this.criticalFailures = this.failures.filter(f => f.criticality === 'critical').length;
    this.activeFailures = this.failures.filter(f => ['new', 'investigating', 'escalated'].includes(f.resolutionStatus)).length;
    this.resolvedFailures = this.failures.filter(f => f.resolutionStatus === 'resolved').length;
    this.resolutionRate = this.failures.length > 0 ? Math.round((this.resolvedFailures / this.failures.length) * 100) : 0;
  }
  
  // Search methods
  onGlobalSearch(): void {
    this.searchSubject.next(this.globalSearchTerm);
  }
  
  private performGlobalSearch(term: string): void {
    if (!term.trim()) {
      this.filteredData = [...this.failures];
    } else {
      const searchTerm = term.toLowerCase();
      this.filteredData = this.failures.filter(failure =>
        failure.errorCode.toLowerCase().includes(searchTerm) ||
        failure.errorMessage.toLowerCase().includes(searchTerm) ||
        failure.processName.toLowerCase().includes(searchTerm) ||
        failure.processId.toLowerCase().includes(searchTerm) ||
        (failure.assignee && failure.assignee.toLowerCase().includes(searchTerm))
      );
    }
    this.currentPage = 1;
    this.updatePagination();
  }
  
  clearGlobalSearch(): void {
    this.globalSearchTerm = '';
    this.performGlobalSearch('');
  }
  
  // Error code search
  onErrorCodeSearch(): void {
    const term = this.filters.errorCode.toLowerCase();
    if (term) {
      this.filteredErrorCodes = this.errorCodes.filter(code =>
        code.code.toLowerCase().includes(term) ||
        code.description.toLowerCase().includes(term)
      );
      this.showErrorCodeSuggestions = true;
    } else {
      this.filteredErrorCodes = [];
      this.showErrorCodeSuggestions = false;
    }
  }
  
  selectErrorCode(code: ErrorCode): void {
    this.filters.errorCode = code.code;
    this.showErrorCodeSuggestions = false;
    this.applyFilters();
  }
  
  // Assignee search
  onAssigneeSearch(): void {
    const term = this.filters.assignee.toLowerCase();
    if (term) {
      this.filteredAssignees = this.assignees.filter(assignee =>
        assignee.name.toLowerCase().includes(term) ||
        assignee.team.toLowerCase().includes(term) ||
        assignee.role.toLowerCase().includes(term)
      );
      this.showAssigneeSuggestions = true;
    } else {
      this.filteredAssignees = [];
      this.showAssigneeSuggestions = false;
    }
  }
  
  selectAssignee(assignee: Assignee): void {
    this.filters.assignee = assignee.name;
    this.showAssigneeSuggestions = false;
    this.applyFilters();
  }
  
  selectAssigneeForModal(assignee: Assignee): void {
    this.selectedAssignee = assignee;
    this.assigneeSearchTerm = assignee.name;
    this.filteredAssignees = [];
  }
  
  // Filter methods
  applyFilters(): void {
    let filtered = [...this.failures];
    
    // Apply global search first
    if (this.globalSearchTerm) {
      const searchTerm = this.globalSearchTerm.toLowerCase();
      filtered = filtered.filter(failure =>
        failure.errorCode.toLowerCase().includes(searchTerm) ||
        failure.errorMessage.toLowerCase().includes(searchTerm) ||
        failure.processName.toLowerCase().includes(searchTerm)
      );
    }
    
    // Apply specific filters
    if (this.filters.criticality) {
      filtered = filtered.filter(f => f.criticality === this.filters.criticality);
    }
    
    if (this.filters.errorType) {
      filtered = filtered.filter(f => f.errorType === this.filters.errorType);
    }
    
    if (this.filters.resolutionStatus) {
      filtered = filtered.filter(f => f.resolutionStatus === this.filters.resolutionStatus);
    }
    
    if (this.filters.errorCode) {
      filtered = filtered.filter(f => 
        f.errorCode.toLowerCase().includes(this.filters.errorCode.toLowerCase())
      );
    }
    
    if (this.filters.assignee) {
      filtered = filtered.filter(f => 
        f.assignee && f.assignee.toLowerCase().includes(this.filters.assignee.toLowerCase())
      );
    }
    
    // Apply time range filter
    if (this.selectedTimeRange !== 'all') {
      const now = new Date();
      let cutoffDate = new Date();
      
      switch (this.selectedTimeRange) {
        case '1h':
          cutoffDate = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }
      
      filtered = filtered.filter(f => f.timestamp >= cutoffDate);
    }
    
    this.filteredData = filtered;
    this.currentPage = 1;
    this.updatePagination();
  }
  
  applyTimeRange(): void {
    this.applyFilters();
  }
  
  filterByCriticality(criticality: string): void {
    this.selectedCriticalityFilter = this.selectedCriticalityFilter === criticality ? '' : criticality;
    this.filters.criticality = this.selectedCriticalityFilter;
    this.applyFilters();
  }
  
  getCriticalityFilterClasses(criticality: string): string {
    const isSelected = this.selectedCriticalityFilter === criticality;
    const baseClasses = 'px-3 py-1 rounded-full text-sm font-medium transition-colors flex items-center space-x-1';
    
    if (isSelected) {
      const selectedClasses = {
        critical: 'bg-red-600 text-white',
        high: 'bg-orange-600 text-white',
        medium: 'bg-yellow-600 text-white',
        low: 'bg-green-600 text-white'
      };
      return `${baseClasses} ${selectedClasses[criticality as keyof typeof selectedClasses]}`;
    }
    
    const defaultClasses = {
      critical: 'bg-red-100 text-red-800 hover:bg-red-200',
      high: 'bg-orange-100 text-orange-800 hover:bg-orange-200',
      medium: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
      low: 'bg-green-100 text-green-800 hover:bg-green-200'
    };
    return `${baseClasses} ${defaultClasses[criticality as keyof typeof defaultClasses]}`;
  }
  
  getCriticalityCount(criticality: string): number {
    return this.failures.filter(f => f.criticality === criticality).length;
  }
  
  // Filter management
  hasActiveFilters(): boolean {
    return !!(
      this.filters.criticality ||
      this.filters.errorType ||
      this.filters.resolutionStatus ||
      this.filters.errorCode ||
      this.filters.assignee ||
      this.globalSearchTerm ||
      this.selectedTimeRange !== 'all'
    );
  }
  
  getActiveFilters(): { key: string; label: string; value: string }[] {
    const active = [];
    
    if (this.filters.criticality) {
      active.push({
        key: 'criticality',
        label: 'Criticité',
        value: this.getCriticalityLabel(this.filters.criticality)
      });
    }
    
    if (this.filters.errorType) {
      active.push({
        key: 'errorType',
        label: 'Type',
        value: this.getErrorTypeLabel(this.filters.errorType)
      });
    }
    
    if (this.filters.resolutionStatus) {
      active.push({
        key: 'resolutionStatus',
        label: 'Statut',
        value: this.getResolutionStatusLabel(this.filters.resolutionStatus)
      });
    }
    
    if (this.filters.errorCode) {
      active.push({
        key: 'errorCode',
        label: 'Code',
        value: this.filters.errorCode
      });
    }
    
    if (this.filters.assignee) {
      active.push({
        key: 'assignee',
        label: 'Assigné',
        value: this.filters.assignee
      });
    }
    
    if (this.selectedTimeRange !== 'all') {
      const timeLabels = {
        '1h': 'Dernière heure',
        '24h': 'Dernières 24h',
        '7d': '7 derniers jours',
        '30d': '30 derniers jours'
      };
      active.push({
        key: 'timeRange',
        label: 'Période',
        value: timeLabels[this.selectedTimeRange as keyof typeof timeLabels]
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
      case 'criticality':
        this.filters.criticality = '';
        this.selectedCriticalityFilter = '';
        break;
      case 'errorType':
        this.filters.errorType = '';
        break;
      case 'resolutionStatus':
        this.filters.resolutionStatus = '';
        break;
      case 'errorCode':
        this.filters.errorCode = '';
        break;
      case 'assignee':
        this.filters.assignee = '';
        break;
      case 'timeRange':
        this.selectedTimeRange = 'all';
        break;
      case 'globalSearch':
        this.globalSearchTerm = '';
        break;
    }
    this.applyFilters();
  }
  
  clearAllFilters(): void {
    this.filters = {
      criticality: '',
      errorType: '',
      resolutionStatus: '',
      errorCode: '',
      assignee: ''
    };
    this.globalSearchTerm = '';
    this.selectedTimeRange = 'all';
    this.selectedCriticalityFilter = '';
    this.applyFilters();
  }
  
  // Pagination methods (same as historique component)
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
      return 'bg-red-600 text-white border-red-600';
    }
    return 'text-gray-500 bg-white border-gray-300 hover:bg-gray-50';
  }
  
  // Sorting methods
  sortData(column: string): void {
    console.log('Sorting by:', column);
    // Implementation for sorting
  }
  
  // Modal methods
  viewFailureDetails(failure: Failure): void {
    this.selectedFailure = failure;
    this.showDetailsModal = true;
  }
  
  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedFailure = null;
  }
  
  assignFailure(failure: Failure): void {
    this.failureToAssign = failure;
    this.showAssignmentModal = true;
    this.resetAssignmentForm();
  }
  
  closeAssignmentModal(): void {
    this.showAssignmentModal = false;
    this.failureToAssign = null;
    this.resetAssignmentForm();
  }
  
  private resetAssignmentForm(): void {
    this.selectedAssignee = null;
    this.assigneeSearchTerm = '';
    this.assignmentPriority = 'medium';
    this.assignmentDueDate = '';
    this.assignmentComments = '';
    this.filteredAssignees = [];
  }
  
  confirmAssignment(): void {
    if (this.selectedAssignee && this.failureToAssign) {
      // Update the failure with assignment
      this.failureToAssign.assignee = this.selectedAssignee.name;
      this.failureToAssign.assigneeTeam = this.selectedAssignee.team;
      this.failureToAssign.resolutionStatus = 'investigating';
      
      console.log('Assigning failure:', {
        failureId: this.failureToAssign.id,
        assignee: this.selectedAssignee,
        priority: this.assignmentPriority,
        dueDate: this.assignmentDueDate,
        comments: this.assignmentComments
      });
      
      this.closeAssignmentModal();
      this.applyFilters();
    }
  }
  
  // Action methods
  retryProcess(failure: Failure): void {
    console.log('Retrying process for failure:', failure.id);
    // Implementation for retry
  }
  
  escalateFailure(failure: Failure): void {
    console.log('Escalating failure:', failure.id);
    failure.resolutionStatus = 'escalated';
    this.applyFilters();
  }
  
  markAsResolved(failure: Failure): void {
    failure.resolutionStatus = 'resolved';
    this.closeDetailsModal();
    this.applyFilters();
    this.calculateStatistics();
  }
  
  markAsIgnored(failure: Failure): void {
    failure.resolutionStatus = 'ignored';
    this.closeDetailsModal();
    this.applyFilters();
    this.calculateStatistics();
  }
  
  escalateAll(): void {
    const criticalFailures = this.failures.filter(f => f.criticality === 'critical' && f.resolutionStatus === 'new');
    criticalFailures.forEach(f => f.resolutionStatus = 'escalated');
    console.log(`Escalated ${criticalFailures.length} critical failures`);
    this.applyFilters();
  }
  
  autoResolve(): void {
    console.log('Starting auto-resolution process...');
    // Implementation for auto-resolution
  }
  
  generateIncidentReport(): void {
    console.log('Generating incident report...');
    // Implementation for incident report generation
  }
  
  refreshData(): void {
    this.loading = true;
    setTimeout(() => {
      this.loadMockData();
      this.loading = false;
      this.applyFilters();
    }, 1000);
  }
  
  // Utility methods
  trackByFailureId(index: number, failure: Failure): string {
    return failure.id;
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
  
  getTimeAgo(date: Date): string {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInMinutes < 60) {
      return `Il y a ${diffInMinutes} min`;
    } else if (diffInHours < 24) {
      return `Il y a ${diffInHours}h`;
    } else {
      return `Il y a ${diffInDays}j`;
    }
  }
  
  getInitials(name: string): string {
    if (!name) return 'NA';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
  
  getCriticalityLabel(criticality: string): string {
    const labels: { [key: string]: string } = {
      critical: 'Critique',
      high: 'Élevée',
      medium: 'Moyenne',
      low: 'Faible'
    };
    return labels[criticality] || criticality;
  }
  
  getErrorTypeLabel(errorType: string): string {
    const labels: { [key: string]: string } = {
      system: 'Système',
      validation: 'Validation',
      user: 'Utilisateur',
      timeout: 'Timeout',
      integration: 'Intégration'
    };
    return labels[errorType] || errorType;
  }
  
  getResolutionStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      new: 'Nouveau',
      investigating: 'En cours',
      resolved: 'Résolu',
      ignored: 'Ignoré',
      escalated: 'Escaladé'
    };
    return labels[status] || status;
  }
  
  getCriticalityClasses(criticality: string): string {
    const classes: { [key: string]: string } = {
      critical: 'bg-red-100 text-red-800 border border-red-200',
      high: 'bg-orange-100 text-orange-800 border border-orange-200',
      medium: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
      low: 'bg-green-100 text-green-800 border border-green-200'
    };
    return classes[criticality] || 'bg-gray-100 text-gray-800';
  }
  
  getCriticalityColor(criticality: string): string {
    const colors: { [key: string]: string } = {
      critical: 'bg-red-500',
      high: 'bg-orange-500',
      medium: 'bg-yellow-500',
      low: 'bg-green-500'
    };
    return colors[criticality] || 'bg-gray-500';
  }
  
  getErrorTypeClasses(errorType: string): string {
    const classes: { [key: string]: string } = {
      system: 'bg-blue-100 text-blue-800',
      validation: 'bg-indigo-100 text-indigo-800',
      user: 'bg-purple-100 text-purple-800',
      timeout: 'bg-yellow-100 text-yellow-800',
      integration: 'bg-green-100 text-green-800'
    };
    return classes[errorType] || 'bg-gray-100 text-gray-800';
  }
  
  getResolutionStatusClasses(status: string): string {
    const classes: { [key: string]: string } = {
      new: 'bg-red-100 text-red-800',
      investigating: 'bg-blue-100 text-blue-800',
      resolved: 'bg-green-100 text-green-800',
      ignored: 'bg-gray-100 text-gray-800',
      escalated: 'bg-orange-100 text-orange-800'
    };
    return classes[status] || 'bg-gray-100 text-gray-800';
  }
  
  getResolutionStatusIcon(status: string): string {
    const icons: { [key: string]: string } = {
      new: '<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>',
      investigating: '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"></path>',
      resolved: '<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>',
      ignored: '<path fill-rule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clip-rule="evenodd"></path>',
      escalated: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"></path>'
    };
    return icons[status] || '';
  }
}