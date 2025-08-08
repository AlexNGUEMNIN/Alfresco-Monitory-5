import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { WebSocketService, FailureData } from '../../core/services/websocket.service';

// Update the Failure interface to match API response
interface Failure extends FailureData {
  id: string;
  timestamp: Date;
  errorCode: string;
  errorMessage: string;
  errorType: 'system' | 'validation' | 'user' | 'timeout' | 'integration';
  criticality: 'critical' | 'high' | 'medium' | 'low';
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
  private websocketPaused = false;

  // Data properties
  failures: Failure[] = [];
  filteredData: Failure[] = [];
  paginatedData: Failure[] = [];
  
  // WebSocket connection status
  isConnected = false;
  isWaitingForData = true; // New property to track if we're waiting for initial data
  hasReceivedInitialData = false; // Track if we've received data at least once
  
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
  
  // Custom date range properties
  customDateRange = {
    startDate: '',
    endDate: '',
    enabled: false
  };
  
  showCustomDatePicker = false;
  
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
    { key: 'startTime', label: 'Heure de Début' },
    { key: 'procInstId', label: 'ID Processus' },
    { key: 'processName', label: 'Nom du Processus' },
    { key: 'exceptionMsg', label: 'Message d\'Erreur' },
    { key: 'email', label: 'Initiateur' },
    { key: 'company', label: 'Société' },
    { key: 'deploymentName', label: 'Déploiement' }
  ];
  
  // Criticality levels
  criticalityLevels: CriticalityLevel[] = [
   ];
  
  selectedCriticalityFilter = '';
  
  // Statistics
  criticalFailures = 0;
  activeFailures = 0;
  resolvedFailures = 0;
  resolutionRate = 0;
  
  errorState: { show: boolean; message: string } = { show: false, message: '' };

  constructor(private webSocketService: WebSocketService) {
    this.setupSearchDebouncing();
  }
  
  ngOnInit(): void {
    this.loading = true;
    this.isWaitingForData = true;
    this.loadErrorCodes();
    this.loadAssignees();
    
    // Ensure filters are reset to default (no filter active)
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
    this.customDateRange = {
      startDate: '',
      endDate: '',
      enabled: false
    };
    this.showCustomDatePicker = false;
    
    this.subscribeWebSocket();

    // Show error message if no data after timeout
    setTimeout(() => {
      if (this.loading && this.isWaitingForData) {
        this.loading = false;
        this.isWaitingForData = false;
        if (!this.hasReceivedInitialData || (this.failures.length === 0 && this.filteredData.length === 0)) {
          this.errorState = {
            show: true,
            message: "Aucune donnée reçue du serveur. Veuillez vérifier la connexion ou réessayer plus tard."
          };
        }
        console.log('Loading timeout reached - no data received');
      }
    }, 15000); // 15 seconds timeout
  }

  private subscribeWebSocket(): void {
    // Subscribe to WebSocket connection status
    this.webSocketService.getConnectionStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        this.isConnected = status;
        console.log('Connection status:', status);
        
        // If disconnected and we haven't received initial data, keep loading
        if (!status && !this.hasReceivedInitialData) {
          this.loading = true;
          this.isWaitingForData = true;
        }
      });

    this.webSocketService.getFailures()
      .pipe(takeUntil(this.destroy$))
      .subscribe(failuresData => {
        if (this.websocketPaused) return;
        this.hasReceivedInitialData = true;
        this.isWaitingForData = false;

        if (failuresData && failuresData.length > 0) {
          this.errorState = { show: false, message: '' };
          this.processFailuresData(failuresData);
          setTimeout(() => {
            this.loading = false;
          }, 300);
        } else {
          this.failures = [];
          this.filteredData = [];
          this.paginatedData = [];
          this.updatePagination();
          this.loading = false;
          this.errorState = {
            show: true,
            message: "Aucune donnée d'échec disponible."
          };
        }
      });
    
    // Set loading to false after timeout if no data received
    setTimeout(() => {
      if (this.loading && this.isWaitingForData) {
        this.loading = false;
        this.isWaitingForData = false;
        console.log('Loading timeout reached - no data received');
      }
    }, 15000); // Increased timeout for WebSocket connection
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.webSocketService.disconnect();
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
  
  private processFailuresData(failuresData: FailureData[]): void {
    console.log('Processing failures data:', failuresData);
    
    this.failures = failuresData.map((data, index) => {
      const failure: Failure = {
        ...data,
        id: data.procInstId,
        timestamp: new Date(data.startTime),
        errorCode: this.extractErrorCode(data.exceptionMsg, index),
        errorMessage: data.exceptionMsg,
        errorType: this.determineErrorType(data.exceptionMsg),
        criticality: this.determineCriticality(data.exceptionMsg),
        failureStep: 'Étape Inconnue',
        affectedUser: data.email,
        environment: 'Production',
        stackTrace: this.generateStackTrace(data.exceptionMsg),
        assignee: undefined,
        assigneeTeam: undefined,
        resolutionStatus: 'new',
        timeToResolve: undefined,
        resolutionHistory: []
      };
      return failure;
    });
    
    console.log('Processed failures:', this.failures);
    
    // this.calculateStatistics();
    
    // Reset filters and pagination
    this.filteredData = [...this.failures];
    this.currentPage = 1;
    this.updatePagination();
    
    console.log('Filtered data:', this.filteredData);
    console.log('Paginated data:', this.paginatedData);
  }
  
  private extractErrorCode(exceptionMsg: string, index: number): string {
    // Extract error code from exception message or generate one
    if (exceptionMsg.includes('http request')) {
      return `HTTP_${String(index + 1).padStart(3, '0')}`;
    } else if (exceptionMsg.includes('timeout')) {
      return `TIMEOUT_${String(index + 1).padStart(3, '0')}`;
    } else if (exceptionMsg.includes('database')) {
      return `DB_${String(index + 1).padStart(3, '0')}`;
    } else {
      return `SYS_${String(index + 1).padStart(3, '0')}`;
    }
  }
  
  private determineErrorType(exceptionMsg: string): Failure['errorType'] {
    const msg = exceptionMsg.toLowerCase();
    if (msg.includes('http') || msg.includes('connection')) {
      return 'integration';
    } else if (msg.includes('timeout')) {
      return 'timeout';
    } else if (msg.includes('validation') || msg.includes('invalid')) {
      return 'validation';
    } else if (msg.includes('permission') || msg.includes('unauthorized')) {
      return 'user';
    } else {
      return 'system';
    }
  }
  
  private determineCriticality(exceptionMsg: string): Failure['criticality'] {
    const msg = exceptionMsg.toLowerCase();
    if (msg.includes('critical') || msg.includes('fatal')) {
      return 'critical';
    } else if (msg.includes('error') || msg.includes('exception')) {
      return 'high';
    } else if (msg.includes('warning')) {
      return 'medium';
    } else {
      return 'low';
    }
  }
  
  private generateStackTrace(exceptionMsg: string): string {
    return `Exception: ${exceptionMsg}
    at com.afriland.aps.service.ProcessService.execute(ProcessService.java:245)
    at com.afriland.aps.controller.ProcessController.handleRequest(ProcessController.java:89)
    at org.springframework.web.method.support.InvocableHandlerMethod.invoke(InvocableHandlerMethod.java:197)
    at org.springframework.web.servlet.mvc.method.annotation.ServletInvocableHandlerMethod.invokeAndHandle(ServletInvocableHandlerMethod.java:85)`;
  }
  
  private loadErrorCodes(): void {
    this.errorCodes = [
      ];
  }
  
  private loadAssignees(): void {
    this.assignees = [
      { id: '1', name: 'Jean Dupont', team: 'Support Technique', role: 'Analyste Senior' },
     ];
  }
  
  // Search methods
  onGlobalSearch(): void {
    this.pauseWebSocket();
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
        failure.procInstId.toLowerCase().includes(searchTerm) ||
        (failure.email && failure.email.toLowerCase().includes(searchTerm)) ||
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
  

  
  selectAssigneeForModal(assignee: Assignee): void {
    this.selectedAssignee = assignee;
    this.assigneeSearchTerm = assignee.name;
    this.filteredAssignees = [];
  }
  
  // Filter methods
  applyFilters(): void {
    this.pauseWebSocket();
    let filtered = [...this.failures];
    
    console.log('Applying filters to:', filtered.length, 'failures');
    
    // Apply global search first
    if (this.globalSearchTerm) {
      const searchTerm = this.globalSearchTerm.toLowerCase();
      filtered = filtered.filter(failure =>
        failure.errorCode.toLowerCase().includes(searchTerm) ||
        failure.errorMessage.toLowerCase().includes(searchTerm) ||
        failure.processName.toLowerCase().includes(searchTerm) ||
        failure.procInstId.toLowerCase().includes(searchTerm) ||
        (failure.email && failure.email.toLowerCase().includes(searchTerm))
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
    
    // Apply time range filter (enhanced)
    if (this.customDateRange.enabled && this.customDateRange.startDate && this.customDateRange.endDate) {
      // Custom date range filter
      const startDate = new Date(this.customDateRange.startDate);
      const endDate = new Date(this.customDateRange.endDate);
      // Set end date to end of day
      endDate.setHours(23, 59, 59, 999);
      
      filtered = filtered.filter(f => f.timestamp >= startDate && f.timestamp <= endDate);
    } else if (this.selectedTimeRange !== 'all' && this.selectedTimeRange !== 'custom') {
      // Predefined time range filter
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
    
    console.log('After filtering:', this.filteredData.length, 'failures');
    console.log('Paginated data length:', this.paginatedData.length);
  }
  
  applyTimeRange(): void {
    this.pauseWebSocket();
    if (this.selectedTimeRange === 'custom') {
      this.showCustomDatePicker = true;
    } else {
      this.showCustomDatePicker = false;
      this.customDateRange.enabled = false;
    }
    this.applyFilters();
  }
  
  applyCustomDateRange(): void {
    this.pauseWebSocket();
    if (this.customDateRange.startDate && this.customDateRange.endDate) {
      this.customDateRange.enabled = true;
      this.selectedTimeRange = 'custom';
      this.applyFilters();
    }
  }
  
  clearCustomDateRange(): void {
    this.customDateRange = {
      startDate: '',
      endDate: '',
      enabled: false
    };
    this.showCustomDatePicker = false;
    this.selectedTimeRange = 'all';
    // Do NOT call applyFilters here, just reset filters
  }
  
  // Utility method to get today's date in YYYY-MM-DD format
  getTodayDate(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }
  
  // Utility method to get date 7 days ago
  getWeekAgoDate(): string {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return weekAgo.toISOString().split('T')[0];
  }
  
  // Quick date range setters
  setQuickDateRange(type: 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth'): void {
    this.pauseWebSocket();
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    switch (type) {
      case 'today':
        this.customDateRange.startDate = this.getTodayDate();
        this.customDateRange.endDate = this.getTodayDate();
        break;
      case 'yesterday':
        this.customDateRange.startDate = yesterday.toISOString().split('T')[0];
        this.customDateRange.endDate = yesterday.toISOString().split('T')[0];
        break;
      case 'thisWeek':
        const thisWeekStart = new Date(today);
        thisWeekStart.setDate(today.getDate() - today.getDay());
        this.customDateRange.startDate = thisWeekStart.toISOString().split('T')[0];
        this.customDateRange.endDate = this.getTodayDate();
        break;
      case 'lastWeek':
        const lastWeekEnd = new Date(today);
        lastWeekEnd.setDate(today.getDate() - today.getDay() - 1);
        const lastWeekStart = new Date(lastWeekEnd);
        lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
        this.customDateRange.startDate = lastWeekStart.toISOString().split('T')[0];
        this.customDateRange.endDate = lastWeekEnd.toISOString().split('T')[0];
        break;
      case 'thisMonth':
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        this.customDateRange.startDate = thisMonthStart.toISOString().split('T')[0];
        this.customDateRange.endDate = this.getTodayDate();
        break;
    }
    
    this.applyCustomDateRange();
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
      this.selectedTimeRange !== 'all' ||
      this.customDateRange.enabled
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
    
    if (this.customDateRange.enabled && this.customDateRange.startDate && this.customDateRange.endDate) {
      const startDate = new Date(this.customDateRange.startDate).toLocaleDateString('fr-FR');
      const endDate = new Date(this.customDateRange.endDate).toLocaleDateString('fr-FR');
      active.push({
        key: 'customDateRange',
        label: 'Période personnalisée',
        value: `${startDate} - ${endDate}`
      });
    } else if (this.selectedTimeRange !== 'all' && this.selectedTimeRange !== 'custom') {
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
    this.pauseWebSocket();
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
      case 'customDateRange':
        this.clearCustomDateRange();
        break;
      case 'globalSearch':
        this.globalSearchTerm = '';
        break;
    }
    this.applyFilters();
  }
  
  clearAllFilters(): void {
    this.pauseWebSocket();
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
    this.clearCustomDateRange();
    this.applyFilters();
  }
  
  // Pagination methods (same as historique component)
  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredData.length / this.pageSize);
    
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    } else if (this.currentPage < 1) {
      this.currentPage = 1;
    }
    
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = Math.min(startIndex + this.pageSize, this.filteredData.length);
    this.paginatedData = this.filteredData.slice(startIndex, endIndex);
    
    console.log(`Pagination: page ${this.currentPage}/${this.totalPages}, showing ${startIndex}-${endIndex} of ${this.filteredData.length}`);
    console.log('Paginated data:', this.paginatedData);
    
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
  

  // Action methods
  retryProcess(failure: Failure): void {
    console.log('Retrying process for failure:', failure.id);
    // Implementation for retry
  }
  

  autoResolve(): void {
    console.log('Starting auto-resolution process...');
    // Implementation for auto-resolution
  }
  
  generateIncidentReport(): void {
    console.log('Generating incident report...');
    // Implementation for incident report generation
  }
  

  
  // New method to check if we should show loading state
  shouldShowLoading(): boolean {
    // Show loader until paginatedData is available and not empty
    return this.loading || (this.isWaitingForData && !this.hasReceivedInitialData) || (this.paginatedData.length === 0 && this.failures.length === 0);
  }
  
  // New method to get loading message
  getLoadingMessage(): string {
    if (!this.isConnected) {
      return 'Connexion au serveur WebSocket...';
    } else if (this.isWaitingForData) {
      return 'En attente des données d\'échecs...';
    } else {
      return 'Chargement...';
    }
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
  

  
  getCriticalityColor(criticality: string): string {
    const colors: { [key: string]: string } = {
      critical: 'bg-red-500',
      high: 'bg-orange-500',
      medium: 'bg-yellow-500',
      low: 'bg-green-500'
    };
    return colors[criticality] || 'bg-gray-500';
  }

  
  // Add method to get connection status display
  getConnectionStatusDisplay(): string {
    return this.isConnected ? 'Connecté' : 'Déconnecté';
  }
  
  getConnectionStatusClass(): string {
    return this.isConnected 
      ? 'bg-green-100 text-green-800' 
      : 'bg-red-100 text-red-800';
  }

  private pauseWebSocket(): void {
    this.websocketPaused = true;
  }
}