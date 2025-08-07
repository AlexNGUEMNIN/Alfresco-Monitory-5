import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";

interface BulkActionResult {
  action: string;
  selectedItems: any[];
  success: boolean;
  message: string;
}

interface User {
  id: string;
  name: string;
  role: string;
}

interface Group {
  id: string;
  name: string;
  description: string;
  memberCount: number;
}

@Component({
  selector: "app-enhanced-bulk-actions-modal",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./enhanced-bulk-actions-modal.component.html",
  styleUrls: ["./enhanced-bulk-actions-modal.component.scss"],
})
export class EnhancedBulkActionsModalComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Input() selectedItems: any[] = [];
  @Input() context = "";
  @Input() availableActions: string[] = [];
  @Output() closeModal = new EventEmitter<void>();
  @Output() actionExecuted = new EventEmitter<BulkActionResult>();

  // UI State
  showPreview = false;
  maxPreviewItems = 6;
  selectedAction = "";
  isExecuting = false;

  // Transfer Configuration
  transferType: "user" | "group" | "manager" = "user";
  userSearchTerm = "";
  filteredUsers: User[] = [];
  selectedUserId = "";
  selectedGroupId = "";

  // Priority Configuration
  newPriority: "high" | "medium" | "low" = "medium";

  // Due Date Configuration
  selectedQuickDate = "";
  customDueDate = "";
  quickDateOptions = [
    { label: "Aujourd'hui", value: "today" },
    { label: "Demain", value: "tomorrow" },
    { label: "Dans 3 jours", value: "3days" },
    { label: "Dans 1 semaine", value: "1week" },
    { label: "Dans 2 semaines", value: "2weeks" },
    { label: "Dans 1 mois", value: "1month" },
  ];

  // Comment
  actionComment = "";

  // Mock Data
  availableUsers: User[] = [
    { id: "1", name: "Jean Dupont", role: "Analyste" },
    { id: "2", name: "Marie Martin", role: "Manager" },
    { id: "3", name: "Pierre Duran", role: "Superviseur" },
    { id: "4", name: "Sophie Legrand", role: "Analyste Senior" },
    { id: "5", name: "Antoine Robert", role: "Opérateur" },
  ];

  availableGroups: Group[] = [
    {
      id: "1",
      name: "Équipe Crédit",
      description: "Spécialistes en analyse de crédit",
      memberCount: 8,
    },
    {
      id: "2",
      name: "Support Client",
      description: "Service client et support",
      memberCount: 12,
    },
    {
      id: "3",
      name: "Conformité",
      description: "Équipe de vérification réglementaire",
      memberCount: 5,
    },
    {
      id: "4",
      name: "Risk Management",
      description: "Gestion des risques",
      memberCount: 6,
    },
  ];

  ngOnInit(): void {
    this.filteredUsers = [...this.availableUsers];
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["isOpen"] && changes["isOpen"].currentValue) {
      this.resetModal();
    }
  }

  private resetModal(): void {
    this.showPreview = false;
    this.selectedAction = "";
    this.isExecuting = false;
    this.transferType = "user";
    this.userSearchTerm = "";
    this.filteredUsers = [...this.availableUsers];
    this.selectedUserId = "";
    this.selectedGroupId = "";
    this.newPriority = "medium";
    this.selectedQuickDate = "";
    this.customDueDate = "";
    this.actionComment = "";
  }

  // ===== UI METHODS =====
  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  onClose(): void {
    this.closeModal.emit();
  }

  togglePreview(): void {
    this.showPreview = !this.showPreview;
  }

  // ===== ITEM METHODS =====
  trackByItemId(index: number, item: any): string {
    return item.id || index.toString();
  }

  getItemTypeLabel(): string {
    switch (this.context) {
      case "user-tasks":
      case "app-tasks":
        return "tâche";
      case "processes":
        return "processus";
      default:
        return "élément";
    }
  }

  getItemIcon(item: any): string {
    if (this.context.includes("tasks")) {
      return "assignment";
    } else if (this.context === "processes") {
      return "settings";
    }
    return "item";
  }

  getItemName(item: any): string {
    return item.name || item.title || `Item ${item.id}`;
  }

  getItemMeta(item: any): string {
    if (this.context.includes("tasks")) {
      return item.workflowName || item.processName || "Workflow";
    } else if (this.context === "processes") {
      return item.processDefinitionId || "Process";
    }
    return "";
  }

  getItemStatus(item: any): string {
    return item.status || "unknown";
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      "in-progress": "En cours",
      suspended: "Suspendu",
      pending: "En attente",
      completed: "Terminé",
      overdue: "En retard",
    };
    return labels[status] || status;
  }

  // ===== ACTION METHODS =====
  selectAction(action: string): void {
    if (this.isActionAvailable(action)) {
      this.selectedAction = action;
    }
  }

  isActionAvailable(action: string): boolean {
    const count = this.getActionCount(action);
    return count > 0;
  }

  getActionCount(action: string): number {
    switch (action) {
      case "resume":
        return this.selectedItems.filter((item) => item.status === "suspended")
          .length;
      case "suspend":
        return this.selectedItems.filter(
          (item) => item.status === "in-progress"
        ).length;
      case "stop":
        return this.selectedItems.filter(
          (item) =>
            item.status === "in-progress" ||
            item.status === "suspended" ||
            item.status === "pending"
        ).length;
      case "transfer":
      case "change-priority":
      case "set-due-date":
        return this.selectedItems.length;
      default:
        return 0;
    }
  }

  getActionIcon(action: string): string {
    const icons: { [key: string]: string } = {
      resume: "play_arrow",
      suspend: "pause",
      stop: "stop",
      transfer: "swap_horiz",
      "change-priority": "flag",
      "set-due-date": "schedule",
    };
    return icons[action] || "action";
  }

  // ===== TRANSFER METHODS =====
  setTransferType(type: "user" | "group" | "manager"): void {
    this.transferType = type;
    this.selectedUserId = "";
    this.selectedGroupId = "";
  }

  searchUsers(): void {
    const term = this.userSearchTerm.toLowerCase();
    this.filteredUsers = this.availableUsers.filter(
      (user) =>
        user.name.toLowerCase().includes(term) ||
        user.role.toLowerCase().includes(term)
    );
  }

  selectUser(userId: string): void {
    this.selectedUserId = userId;
  }

  selectGroup(groupId: string): void {
    this.selectedGroupId = groupId;
  }

  getUserInitials(name: string): string {
    return name
      .split(" ")
      .map((n) => n.charAt(0))
      .join("")
      .toUpperCase();
  }

  // ===== PRIORITY METHODS =====
  setNewPriority(priority: "high" | "medium" | "low"): void {
    this.newPriority = priority;
  }

  // ===== DATE METHODS =====
  setQuickDate(value: string): void {
    this.selectedQuickDate = value;
    this.customDueDate = "";

    // Calculate the actual date based on the quick option
    const now = new Date();
    let targetDate = new Date();

    switch (value) {
      case "today":
        targetDate = now;
        break;
      case "tomorrow":
        targetDate.setDate(now.getDate() + 1);
        break;
      case "3days":
        targetDate.setDate(now.getDate() + 3);
        break;
      case "1week":
        targetDate.setDate(now.getDate() + 7);
        break;
      case "2weeks":
        targetDate.setDate(now.getDate() + 14);
        break;
      case "1month":
        targetDate.setMonth(now.getMonth() + 1);
        break;
    }

    // Set to end of day
    targetDate.setHours(23, 59, 59, 999);
    this.customDueDate = targetDate.toISOString().slice(0, 16);
  }

  onCustomDateChange(): void {
    this.selectedQuickDate = "";
  }

  // ===== EXECUTION METHODS =====
  canExecuteAction(): boolean {
    if (!this.selectedAction) return false;

    switch (this.selectedAction) {
      case "transfer":
        return !!(
          (this.transferType === "user" && this.selectedUserId) ||
          (this.transferType === "group" && this.selectedGroupId) ||
          this.transferType === "manager"
        );
      case "change-priority":
        return !!this.newPriority;
      case "set-due-date":
        return !!(this.selectedQuickDate || this.customDueDate);
      case "resume":
      case "suspend":
      case "stop":
        return this.getActionCount(this.selectedAction) > 0;
      default:
        return false;
    }
  }

  getExecuteButtonText(): string {
    const actionLabels: { [key: string]: string } = {
      resume: "Reprendre",
      suspend: "Suspendre",
      stop: "Arrêter",
      transfer: "Transférer",
      "change-priority": "Changer priorité",
      "set-due-date": "Définir échéance",
    };

    const count = this.getEligibleItemsCount();
    const actionLabel = actionLabels[this.selectedAction] || "Exécuter";

    return `${actionLabel} (${count})`;
  }

  getEligibleItemsCount(): number {
    return this.getActionCount(this.selectedAction);
  }

  getActionSummary(): string {
    const count = this.getEligibleItemsCount();
    const itemType = this.getItemTypeLabel();

    switch (this.selectedAction) {
      case "resume":
        return `Reprendre ${count} ${itemType}${
          count > 1 ? "s" : ""
        } suspendue${count > 1 ? "s" : ""}`;
      case "suspend":
        return `Suspendre ${count} ${itemType}${count > 1 ? "s" : ""} en cours`;
      case "stop":
        return `Arrêter définitivement ${count} ${itemType}${
          count > 1 ? "s" : ""
        }`;
      case "transfer":
        let target = "";
        if (this.transferType === "user" && this.selectedUserId) {
          const user = this.availableUsers.find(
            (u) => u.id === this.selectedUserId
          );
          target = user ? user.name : "utilisateur sélectionné";
        } else if (this.transferType === "group" && this.selectedGroupId) {
          const group = this.availableGroups.find(
            (g) => g.id === this.selectedGroupId
          );
          target = group ? group.name : "groupe sélectionné";
        } else if (this.transferType === "manager") {
          target = "le manager responsable";
        }
        return `Transférer ${count} ${itemType}${
          count > 1 ? "s" : ""
        } vers ${target}`;
      case "change-priority":
        const priorityLabels = {
          high: "haute",
          medium: "moyenne",
          low: "basse",
        };
        return `Changer la priorité de ${count} ${itemType}${
          count > 1 ? "s" : ""
        } à ${priorityLabels[this.newPriority]}`;
      case "set-due-date":
        const dateText = this.selectedQuickDate
          ? this.quickDateOptions.find(
              (opt) => opt.value === this.selectedQuickDate
            )?.label
          : this.formatCustomDate(this.customDueDate);
        return `Définir l'échéance de ${count} ${itemType}${
          count > 1 ? "s" : ""
        } à ${dateText}`;
      default:
        return `Action sur ${count} ${itemType}${count > 1 ? "s" : ""}`;
    }
  }

  formatCustomDate(dateString: string): string {
    if (!dateString) return "";

    const date = new Date(dateString);
    return date.toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  getPriorityClass(priority: string): string {
    const classes: { [key: string]: string } = {
      high: "priority-high",
      medium: "priority-medium",
      low: "priority-low",
    };
    return classes[priority] || "priority-medium";
  }

  getPriorityIcon(priority: string): string {
    const icons: { [key: string]: string } = {
      high: "keyboard_arrow_up",
      medium: "remove",
      low: "keyboard_arrow_down",
    };
    return icons[priority] || "remove";
  }

  getSelectedUserName(): string {
    const user = this.availableUsers.find((u) => u.id === this.selectedUserId);
    return user ? user.name : "";
  }

  getSelectedGroupName(): string {
    const group = this.availableGroups.find(
      (g) => g.id === this.selectedGroupId
    );
    return group ? group.name : "";
  }

  // ===== EXECUTION =====
  async executeAction(): Promise<void> {
    if (!this.canExecuteAction()) {
      return;
    }

    this.isExecuting = true;

    try {
      const result = await this.performAction();

      this.actionExecuted.emit({
        action: this.selectedAction,
        selectedItems: this.selectedItems,
        success: result.success,
        message: result.message,
      });

      if (result.success) {
        this.onClose();
      }
    } catch (error) {
      console.error("Erreur lors de l'exécution de l'action:", error);
      this.actionExecuted.emit({
        action: this.selectedAction,
        selectedItems: this.selectedItems,
        success: false,
        message: "Une erreur est survenue lors de l'exécution de l'action",
      });
    } finally {
      this.isExecuting = false;
    }
  }

  private async performAction(): Promise<{
    success: boolean;
    message: string;
  }> {
    // Simulation d'un appel API
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const count = this.getEligibleItemsCount();
    const itemType = this.getItemTypeLabel();

    switch (this.selectedAction) {
      case "resume":
        return {
          success: true,
          message: `${count} ${itemType}${count > 1 ? "s" : ""} reprise${
            count > 1 ? "s" : ""
          } avec succès`,
        };
      case "suspend":
        return {
          success: true,
          message: `${count} ${itemType}${count > 1 ? "s" : ""} suspendue${
            count > 1 ? "s" : ""
          } avec succès`,
        };
      case "stop":
        return {
          success: true,
          message: `${count} ${itemType}${count > 1 ? "s" : ""} arrêtée${
            count > 1 ? "s" : ""
          } avec succès`,
        };
      case "transfer":
        const target = this.getTransferTarget();
        return {
          success: true,
          message: `${count} ${itemType}${count > 1 ? "s" : ""} transférée${
            count > 1 ? "s" : ""
          } vers ${target} avec succès`,
        };
      case "change-priority":
        const priorityLabels = {
          high: "haute",
          medium: "moyenne",
          low: "basse",
        };
        return {
          success: true,
          message: `Priorité de ${count} ${itemType}${
            count > 1 ? "s" : ""
          } changée à ${priorityLabels[this.newPriority]} avec succès`,
        };
      case "set-due-date":
        return {
          success: true,
          message: `Échéance définie pour ${count} ${itemType}${
            count > 1 ? "s" : ""
          } avec succès`,
        };
      default:
        return {
          success: false,
          message: "Action non reconnue",
        };
    }
  }

  private getTransferTarget(): string {
    if (this.transferType === "user" && this.selectedUserId) {
      return this.getSelectedUserName();
    } else if (this.transferType === "group" && this.selectedGroupId) {
      return this.getSelectedGroupName();
    } else if (this.transferType === "manager") {
      return "le manager responsable";
    }
    return "destination inconnue";
  }

  // ===== UTILITY METHODS =====
  getActionLabel(action: string): string {
    const labels: { [key: string]: string } = {
      resume: "Reprendre",
      suspend: "Suspendre",
      stop: "Arrêter",
      transfer: "Transférer",
      "change-priority": "Changer priorité",
      "set-due-date": "Définir échéance",
    };
    return labels[action] || action;
  }

  isActionSelected(action: string): boolean {
    return this.selectedAction === action;
  }

  hasConfiguration(): boolean {
    return ["transfer", "change-priority", "set-due-date"].includes(
      this.selectedAction
    );
  }

  getConfigurationTitle(): string {
    switch (this.selectedAction) {
      case "transfer":
        return "Configuration du transfert";
      case "change-priority":
        return "Configuration de la priorité";
      case "set-due-date":
        return "Configuration de l'échéance";
      default:
        return "Configuration";
    }
  }
}
