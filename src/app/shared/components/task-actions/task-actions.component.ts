import { Component, Input, Output, EventEmitter } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ProcessData } from "../../../core/services/process.service";
import { ConfirmDialogComponent } from "../confirm-dialog/confirm-dialog.component";
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment'; // <-- import environment
@Component({
  selector: "app-task-actions",
  standalone: true,
  imports: [CommonModule, ConfirmDialogComponent],
  templateUrl: "./task-actions.component.html",
  styleUrls: ["./task-actions.component.scss"],
})
export class TaskActionsComponent {
  @Input() processData: ProcessData | null = null;
  @Output() stopProcess = new EventEmitter<{
    processInstanceId: string;
    isSuspended: boolean;
  }>();
  @Output() transferTask = new EventEmitter<ProcessData>();
  @Output() terminateProcess = new EventEmitter<any>();

  constructor(
      private http: HttpClient,
      private authService: AuthService
  ) {}
  loading = false;
  showConfirmDialog = false;
  confirmDialogConfig = {
    title: "",
    message: "",
    confirmText: "Oui",
    cancelText: "Non",
    icon: "help_outline",
    iconColor: "",
    theme: "",
    action: "" as "suspend" | "terminate" | "",
  };

  get isSuspended(): boolean {
    return this.processData?.suspensionState === 2;
  }

  onStopProcess(): void {
    if (!this.processData) return;

    this.loading = true;

    const headers = new HttpHeaders({
      Authorization: `Bearer ${this.authService.accessToken}`
    });

    const processInstanceId = this.processData.processInstanceId;
    const originalInitiatorKey = `initiator_${processInstanceId}`;

    // Step 1: Fetch current user
    this.http.get<{ id: number }>(`${environment.api2Url}/current-user`, { headers }).subscribe({
      next: (user) => {
        const currentUserId = user.id;

        // Step 2: Save original initiator in localStorage
        localStorage.setItem(originalInitiatorKey, this.processData!.processInitiatorId);

        // Step 3: Update initiator to current user
        const updateInitiatorUrl = `${environment.api2Url}/procinst/update-start-user?id=${processInstanceId}&startUserId=${currentUserId}`;
        this.http.put(updateInitiatorUrl, null, { headers }).subscribe({
          next: () => {
            // Step 4: Emit suspend process
            this.stopProcess.emit({
              processInstanceId: processInstanceId,
              isSuspended: this.isSuspended,
            });

            // Step 5: Wait and restore original initiator
            setTimeout(() => {
              const originalInitiator = localStorage.getItem(originalInitiatorKey);

              if (originalInitiator) {
                const restoreUrl = `${environment.api2Url}/procinst/update-start-user?id=${processInstanceId}&startUserId=${originalInitiator}`;
                this.http.put(restoreUrl, null, { headers }).subscribe({
                  next: () => {
                    console.log('✅ Original initiator restored.');

                    // ✅ Step 6: Delete from localStorage
                    localStorage.removeItem(originalInitiatorKey);
                  },
                  error: (err) => {
                    console.error('❌ Failed to restore original initiator:', err);
                  },
                  complete: () => {
                    this.loading = false;
                  }
                });
              } else {
                console.warn('⚠️ Original initiator not found in localStorage.');
                this.loading = false;
              }
            }, 1000);
          },
          error: (err) => {
            console.error('❌ Failed to update start user:', err);
            this.loading = false;
          }
        });
      },
      error: (err) => {
        console.error('❌ Failed to get current user:', err);
        this.loading = false;
      }
    });
  }


  confirmSuspendProcess(): void {
    if (!this.isSuspended) {
      this.confirmDialogConfig = {
        title: "Confirmation de suspension",
        message: "Êtes-vous sûr de vouloir suspendre le processus ?",
        confirmText: "Suspendre",
        cancelText: "Annuler",
        icon: "pause_circle",
        iconColor: "#f59e42",
        theme: "",
        action: "suspend",
      };
      this.showConfirmDialog = true;
    } else {
      // Si le processus est déjà suspendu, on exécute directement (reprendre)
      this.onStopProcess();
    }
  }

  onTransferTask(): void {
    if (this.processData) {
      this.transferTask.emit(this.processData);
    }
  }

  onTerminateProcess() {
    if (this.processData) {
      this.terminateProcess.emit({
        processInstanceId: this.processData.processInstanceId,
      });
    }
  }

  confirmTerminateProcess() {
    this.confirmDialogConfig = {
      title: "Confirmation d'arrêt",
      message: "Êtes-vous sûr de vouloir arrêter le processus ?",
      confirmText: "Arrêter",
      cancelText: "Annuler",
      icon: "stop_circle",
      iconColor: "#ef4444",
      theme: "danger",
      action: "terminate",
    };
    this.showConfirmDialog = true;
  }

  onConfirmDialogResult(result: boolean) {
    if (result) {
      if (this.confirmDialogConfig.action === "suspend") {
        this.onStopProcess();
      } else if (this.confirmDialogConfig.action === "terminate") {
        this.onTerminateProcess();
      }
    }
    this.showConfirmDialog = false;
    this.confirmDialogConfig.action = "";
  }
}
