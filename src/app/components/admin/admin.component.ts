import { Component, OnInit, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { UserService } from "../../core/services/user.service";
import { User, AuditLog } from "../../core/models/user.model";
import { MatTableDataSource } from "@angular/material/table";
import { MatPaginator } from "@angular/material/paginator";
import { MatSort } from "@angular/material/sort";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatTabsModule } from "@angular/material/tabs";
import { MatTableModule } from "@angular/material/table";
import { MatPaginatorModule } from "@angular/material/paginator";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Router } from "@angular/router";
import { environment } from '../../../environments/environment';

export interface InactiveUser {
  userId: string;
  username: string;
  fullName: string;
  email: string;
  enabled: boolean;
  lastLoginTime: string | null;
}

@Component({
  selector: "app-admin",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatTabsModule,
    MatTableModule,
    MatPaginatorModule,
  ],
  templateUrl: "./admin.component.html",
  styleUrls: ["./admin.component.scss"],
})
export class AdminComponent implements OnInit {
  activeTab = "users";
  users: User[] = [];
  auditLogs: AuditLog[] = [];
  loading = true;

  // Custom pagination properties for modern design
  currentPage = 1;
  pageSize = 10;
  totalUsers = 0;
  totalPages = 0;
  paginatedUsers: InactiveUser[] = [];

  // Sorting properties
  sortField = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  activeUserTabIndex = 0;
  userTabs = [
    { label: "Enabled ", key: "active" as const, count: 0 },
    { label: "Tous", key: "all" as const, count: 0 },
    { label: "Disabled ", key: "inactive" as const, count: 0 },
  ];

  userDataSourceAll = new MatTableDataSource<User>([]);
  userDataSourceActive = new MatTableDataSource<User>([]);

  // Use InactiveUser[] for all tabs since the API returns this format
  allUsers: InactiveUser[] = [];
  activeUsers: InactiveUser[] = [];
  inactiveUsers: InactiveUser[] = [];
  currentTabUsers: InactiveUser[] = [];
  filteredUsers: InactiveUser[] = [];

  userDataSourceInactive = new MatTableDataSource<InactiveUser>([]);

  userDisplayedColumns: string[] = [
    "username",
    "name",
    "email",
    "Enable",
    "lastLogin",
    "isActive",
    "actions",
  ];
  userDisplayedColumnsInactive: string[] = [
    "username",
    "fullName",
    "email",
    "enabled",
    "lastLoginTime",
    "actions",
  ];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
      private userService: UserService,
      private http: HttpClient,
      private router: Router
  ) {}

  ngOnInit(): void {
    this.loadData();
    this.loadInactiveUsers();
  }

  ngAfterViewInit(): void {
    // Pour le tri/pagination sur le premier onglet (Tous)
    this.userDataSourceAll.paginator = this.paginator;
    this.userDataSourceAll.sort = this.sort;
    // Pour les autres onglets, tu peux ajouter d'autres ViewChild si besoin
  }

  loadData(): void {
    this.loading = true;

    this.userService.getUsers().subscribe((users) => {
      this.users = users;
      this.userDataSourceAll.data = users;
      this.userDataSourceActive.data = users.filter((u) => u.isActive);

      this.userTabs[0].count = this.userDataSourceActive.data.length;
      this.userTabs[1].count = users.length;

      this.loading = false;
    });

    this.userService.getAuditLogs().subscribe((logs) => {
      this.auditLogs = logs;
    });
  }

  loadInactiveUsers(): void {
    const token = localStorage.getItem('auth_tokens')
        ? JSON.parse(localStorage.getItem('auth_tokens')!).access_token
        : null;
    const headers = token
        ? new HttpHeaders({ Authorization: `Bearer ${token}` })
        : undefined;

    this.http
        .get<InactiveUser[]>(
            `${environment.api2Url}/inactive-users`,
            { headers }
        )
        .subscribe((users) => {
          // Store all users from the API
          this.allUsers = users;

          // Filter users based on enabled status
          this.activeUsers = users.filter(user => user.enabled === true);
          this.inactiveUsers = users.filter(user => user.enabled === false);

          // Update tab counts
          this.userTabs[0].count = this.activeUsers.length; // Actifs
          this.userTabs[1].count = this.allUsers.length;    // Tous
          this.userTabs[2].count = this.inactiveUsers.length; // Inactifs

          // Set initial tab data
          this.setCurrentTabData();

          // Keep Material table data for compatibility
          this.userDataSourceInactive.data = this.inactiveUsers;
        });
  }

  /**
   * Set current tab data based on active tab
   */
  setCurrentTabData(): void {
    switch (this.activeUserTabIndex) {
      case 0: // Actifs
        this.currentTabUsers = [...this.activeUsers];
        break;
      case 1: // Tous
        this.currentTabUsers = [...this.allUsers];
        break;
      case 2: // Inactifs
        this.currentTabUsers = [...this.inactiveUsers];
        break;
      default:
        this.currentTabUsers = [...this.allUsers];
    }

    this.filteredUsers = [...this.currentTabUsers];
    this.totalUsers = this.filteredUsers.length;
    this.updatePagination();
  }

  // New methods for modern UI functionality

  /**
   * Set active user tab (for custom tab navigation)
   */
  setActiveUserTab(index: number): void {
    this.activeUserTabIndex = index;
    this.currentPage = 1; // Reset to first page when switching tabs
    this.setCurrentTabData(); // Update data for the new tab
  }

  /**
   * Get icon for each tab
   */
  getTabIcon(index: number): string {
    const icons = ['people', 'group', 'people_outline'];
    return icons[index] || 'people';
  }

  /**
   * Apply filter to users (enhanced for modern UI)
   */
  applyUserFilter(value: string, type: string): void {
    const filterValue = value.trim().toLowerCase();

    // Apply filter to current tab users
    if (!filterValue) {
      this.filteredUsers = [...this.currentTabUsers];
    } else {
      this.filteredUsers = this.currentTabUsers.filter(user =>
          user.username.toLowerCase().includes(filterValue) ||
          user.fullName.toLowerCase().includes(filterValue) ||
          user.email.toLowerCase().includes(filterValue)
      );
    }

    this.totalUsers = this.filteredUsers.length;
    this.currentPage = 1; // Reset to first page after filter
    this.updatePagination();

    // Keep original Material Table functionality for compatibility
    if (type === "inactive") {
      this.userDataSourceInactive.filter = filterValue;
      this.userDataSourceInactive.paginator?.firstPage();
    }
  }

  /**
   * Apply filter with proper type casting (helper method for template)
   */
  onFilterInput(value: string): void {
    const currentTabKey = this.userTabs[this.activeUserTabIndex].key;
    this.applyUserFilter(value, currentTabKey);
  }

  /**
   * Custom sorting functionality
   */
  sortData(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }

    this.filteredUsers.sort((a, b) => {
      let aValue = this.getFieldValue(a, field);
      let bValue = this.getFieldValue(b, field);

      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();

      if (aValue < bValue) return this.sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    this.updatePagination();
  }

  /**
   * Get field value for sorting
   */
  private getFieldValue(user: InactiveUser, field: string): any {
    switch (field) {
      case 'username': return user.username;
      case 'fullName': return user.fullName;
      case 'email': return user.email;
      case 'enabled': return user.enabled;
      case 'lastLoginTime': return user.lastLoginTime || '';
      default: return '';
    }
  }

  /**
   * Update pagination based on current page and page size
   */
  updatePagination(): void {
    this.totalPages = Math.ceil(this.totalUsers / this.pageSize);
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedUsers = this.filteredUsers.slice(startIndex, endIndex);
  }

  /**
   * Go to specific page
   */
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  /**
   * Go to previous page
   */
  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  /**
   * Go to next page
   */
  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  /**
   * Get visible page numbers for pagination
   */
  getVisiblePages(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    const half = Math.floor(maxVisible / 2);

    let start = Math.max(1, this.currentPage - half);
    let end = Math.min(this.totalPages, start + maxVisible - 1);

    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  }

  /**
   * Handle page size change
   */
  onPageSizeChange(): void {
    this.currentPage = 1;
    this.updatePagination();
  }

  /**
   * TrackBy function for better performance
   */
  trackByUser(index: number, user: InactiveUser): string {
    return user.userId || user.email;
  }

  /**
   * Original Material Tab change handler (keep for compatibility)
   */
  onUserTabChange(event: any): void {
    this.activeUserTabIndex = event.index;
  }

  /**
   * Set active tab (keep for compatibility)
   */
  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  /**
   * Navigate to user tasks
   */
  viewUserTasks(email: string): void {
    this.router.navigate(['/task-users'], { queryParams: { userEmail: email } });
  }

  /**
   * Edit user (placeholder - implement as needed)
   */
  editUser(user: InactiveUser): void {
    console.log('Edit user:', user);
    // Implement edit functionality
  }

  /**
   * Delete user (enable/disable user via API)
   */
  deleteUser(user: InactiveUser): void {
    // Confirm action before proceeding
    const action = user.enabled ? 'désactiver' : 'activer';
    if (!confirm(`Voulez-vous vraiment ${action} cet utilisateur (${user.fullName}) ?`)) {
      return;
    }

    // 1. Get the auth token (access_token)
    const token = localStorage.getItem('auth_tokens')
      ? JSON.parse(localStorage.getItem('auth_tokens')!).access_token
      : null;
    const headers = token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : undefined;

    // 2. Get userId by email (use access token)
    this.http.get(
      `${environment.api2Url}/id-by-email?email=${encodeURIComponent(user.email)}`,
      { headers, responseType: 'text' }
    ).subscribe({
      next: (userId: string) => {
        console.log('ID by email API result:', userId);
        // 3. Call enable/disable API (use access token)
        const statusUrl = `${environment.api2Url}/${userId}/status`;
        const body = { enabled: !user.enabled };
        this.http.put(statusUrl, body, { headers }).subscribe({
          next: (result) => {
            console.log('Status API result:', result);
            // Refresh users after status change
            this.loadInactiveUsers();
          },
          error: (err) => {
            alert("Erreur lors de la modification du statut de l'utilisateur.");
            console.error(err);
          }
        });
      },
      error: (err) => {
        alert("Impossible de trouver l'utilisateur par email.");
        console.error(err);
      }
    });
  }

  /**
   * Math reference for template
   */
  Math = Math;

  /**
   * Get filter placeholder text based on active tab
   */
  getFilterPlaceholder(): string {
    switch (this.activeUserTabIndex) {
      case 0: return 'Filtrer les utilisateurs actifs...';
      case 1: return 'Filtrer tous les utilisateurs...';
      case 2: return 'Filtrer les utilisateurs inactifs...';
      default: return 'Filtrer les utilisateurs...';
    }
  }

  /**
   * Get empty state icon based on active tab
   */
  getEmptyStateIcon(): string {
    switch (this.activeUserTabIndex) {
      case 0: return 'people';
      case 1: return 'group';
      case 2: return 'people_outline';
      default: return 'people_outline';
    }
  }

  /**
   * Get empty state title based on active tab
   */
  getEmptyStateTitle(): string {
    switch (this.activeUserTabIndex) {
      case 0: return 'Aucun utilisateur actif trouvé';
      case 1: return 'Aucun utilisateur trouvé';
      case 2: return 'Aucun utilisateur inactif trouvé';
      default: return 'Aucun utilisateur trouvé';
    }
  }

  /**
   * Get empty state message based on active tab
   */
  getEmptyStateMessage(): string {
    switch (this.activeUserTabIndex) {
      case 0: return 'Aucun utilisateur actif ne correspond à vos critères de recherche.';
      case 1: return 'Aucun utilisateur ne correspond à vos critères de recherche.';
      case 2: return 'Aucun utilisateur inactif ne correspond à vos critères de recherche.';
      default: return 'Aucun utilisateur ne correspond à vos critères de recherche.';
    }
  }

  /**
   * Get tab description based on active tab
   */
  getTabDescription(): string {
    switch (this.activeUserTabIndex) {
      case 0: return 'Utilisateurs actifs uniquement';
      case 1: return 'Tous les utilisateurs';
      case 2: return 'Utilisateurs inactifs uniquement';
      default: return 'Tous les utilisateurs';
    }
  }

  /**
   * Get sort icon based on field and current sort state
   */
  getSortIcon(field: string): string {
    if (this.sortField !== field) {
      return 'unfold_more';
    }
    return this.sortDirection === 'asc' ? 'keyboard_arrow_up' : 'keyboard_arrow_down';
  }

  /**
   * Get user initials for avatar
   */
  getInitials(fullName: string): string {
    if (!fullName) return '??';
    const names = fullName.split(' ');
    const firstInitial = names[0]?.charAt(0) || '';
    const lastInitial = names[names.length - 1]?.charAt(0) || '';
    return (firstInitial + lastInitial).toUpperCase();
  }

  /**
   * Get time ago string for last login
   */
  getTimeAgo(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return 'Aujourd\'hui';
    if (diffInDays === 1) return 'Hier';
    if (diffInDays < 7) return `Il y a ${diffInDays} jours`;
    if (diffInDays < 30) return `Il y a ${Math.floor(diffInDays / 7)} semaines`;
    if (diffInDays < 365) return `Il y a ${Math.floor(diffInDays / 30)} mois`;
    return `Il y a ${Math.floor(diffInDays / 365)} ans`;
  }

  /**
   * Get empty state background class based on active tab
   */
  getEmptyStateBackgroundClass(): string {
    switch (this.activeUserTabIndex) {
      case 0: return 'bg-green-100';
      case 1: return 'bg-blue-100';
      case 2: return 'bg-red-100';
      default: return 'bg-gray-100';
    }
  }

  /**
   * Get empty state icon class based on active tab
   */
  getEmptyStateIconClass(): string {
    switch (this.activeUserTabIndex) {
      case 0: return 'text-green-600';
      case 1: return 'text-blue-600';
      case 2: return 'text-red-600';
      default: return 'text-gray-600';
    }
  }
}