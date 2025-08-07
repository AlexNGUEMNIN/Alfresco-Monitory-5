import { Component, Input, Output, EventEmitter } from "@angular/core";

@Component({
  selector: "app-confirm-dialog",
  templateUrl: "./confirm-dialog.component.html",
  styleUrls: ["./confirm-dialog.component.scss"],
  standalone: true,
})
export class ConfirmDialogComponent {
  @Input() title: string = "Confirmation";
  @Input() message: string = "";
  @Input() confirmText: string = "Oui";
  @Input() cancelText: string = "Non";
  @Input() icon: string = "help_outline";
  @Input() iconColor: string = "#f59e42"; // orange par défaut
  @Input() theme: string = ""; // '', 'danger'

  @Output() confirmed = new EventEmitter<boolean>();

  onConfirm(result: boolean) {
    this.confirmed.emit(result);
  }
}
