import { Component, Input, Output, EventEmitter } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";

@Component({
  selector: "app-bulk-actions-modal",
  standalone: true,
  templateUrl: "./bulk-actions-modal.component.html",
  styleUrls: ["./bulk-actions-modal.component.scss"],
  imports: [MatIconModule],
})
export class BulkActionsModalComponent {
  @Input() actions: { name: string; action: string; icon: string }[] = [];
  @Input() selectedCount = 0;
  @Output() close = new EventEmitter<void>();
  @Output() actionSelected = new EventEmitter<string>();

  onAction(action: string) {
    this.actionSelected.emit(action);
    this.close.emit();
  }
}