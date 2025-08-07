import { Component, OnInit, ViewChild } from "@angular/core";
import { MatTableDataSource } from "@angular/material/table";
import { MatPaginator } from "@angular/material/paginator";
import { MatSort } from "@angular/material/sort";
import { DatePipe, CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatTabChangeEvent } from "@angular/material/tabs";
import { MatTabsModule } from "@angular/material/tabs";

// Angular Material modules
import { MatTableModule } from "@angular/material/table";
import { MatPaginatorModule } from "@angular/material/paginator";
import { MatSortModule } from "@angular/material/sort";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";

export interface TaskTransferHistory {
  taskId: string;
  taskName: string;
  from: string;
  to: string;
  toType: "manager" | "groupe" | "utilisateur";
  date: string;
  status: "success" | "failed" | "pending";
}

@Component({
  selector: "app-task",
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
    MatTabsModule, // <-- Ajout ici
  ],
  templateUrl: "./task.component.html",
  styleUrls: ["./task.component.scss"],
  providers: [DatePipe],
})
export class TaskComponent implements OnInit {
  loading = true;
  activeTabIndex = 0;
  tabs = [
    { label: "Tous", key: "all", count: 0 },
    { label: "Envoyés", key: "sent", count: 0 },
    { label: "Reçus", key: "received", count: 0 },
  ];
  displayedColumns: string[] = [
    "taskId",
    "taskName",
    "from",
    "to",
    "toType",
    "date",
    "status",
  ];
  dataSourceAll = new MatTableDataSource<TaskTransferHistory>([]);
  dataSourceSent = new MatTableDataSource<TaskTransferHistory>([]);
  dataSourceReceived = new MatTableDataSource<TaskTransferHistory>([]);

  @ViewChild(MatPaginator) paginatorAll!: MatPaginator;
  @ViewChild(MatPaginator) paginatorSent!: MatPaginator;
  @ViewChild(MatPaginator) paginatorReceived!: MatPaginator;
  @ViewChild(MatSort) sortAll!: MatSort;
  @ViewChild(MatSort) sortSent!: MatSort;
  @ViewChild(MatSort) sortReceived!: MatSort;

  private allData: TaskTransferHistory[] = [];
  private sentData: TaskTransferHistory[] = [];
  private receivedData: TaskTransferHistory[] = [];

  constructor(private datePipe: DatePipe) {}

  ngOnInit(): void {
    // Simulez le chargement des données (remplacez par un vrai service si besoin)
    setTimeout(() => {
      this.allData = [
        {
          taskId: "T-001",
          taskName: "Validation dossier",
          from: "Alice",
          to: "Manager APS",
          toType: "manager",
          date: new Date().toISOString(),
          status: "success",
        },
        {
          taskId: "T-002",
          taskName: "Contrôle conformité",
          from: "Bob",
          to: "Equipe conformité",
          toType: "groupe",
          date: new Date().toISOString(),
          status: "pending",
        },
        {
          taskId: "T-003",
          taskName: "Analyse crédit",
          from: "Alice",
          to: "Jean Dupont",
          toType: "utilisateur",
          date: new Date().toISOString(),
          status: "failed",
        },
      ];
      // Suppose "Alice" est l'utilisateur courant pour la démo
      const currentUser = "Alice";
      this.sentData = this.allData.filter((t) => t.from === currentUser);
      this.receivedData = this.allData.filter((t) => t.to === currentUser);

      this.dataSourceAll.data = this.allData;
      this.dataSourceSent.data = this.sentData;
      this.dataSourceReceived.data = this.receivedData;

      this.tabs[0].count = this.allData.length;
      this.tabs[1].count = this.sentData.length;
      this.tabs[2].count = this.receivedData.length;

      // Setup paginator/sort pour chaque datasource
      setTimeout(() => {
        if (this.paginatorAll) this.dataSourceAll.paginator = this.paginatorAll;
        if (this.paginatorSent)
          this.dataSourceSent.paginator = this.paginatorSent;
        if (this.paginatorReceived)
          this.dataSourceReceived.paginator = this.paginatorReceived;
        if (this.sortAll) this.dataSourceAll.sort = this.sortAll;
        if (this.sortSent) this.dataSourceSent.sort = this.sortSent;
        if (this.sortReceived) this.dataSourceReceived.sort = this.sortReceived;
      });

      // Filter predicates
      const filterPredicate = (
        data: TaskTransferHistory,
        filter: string
      ): boolean => {
        const f = filter.toLowerCase().trim();
        return (
          data.taskId.toLowerCase().includes(f) ||
          data.taskName.toLowerCase().includes(f) ||
          data.from.toLowerCase().includes(f) ||
          data.to.toLowerCase().includes(f) ||
          data.toType.toLowerCase().includes(f) ||
          data.status.toLowerCase().includes(f)
        );
      };
      this.dataSourceAll.filterPredicate = filterPredicate;
      this.dataSourceSent.filterPredicate = filterPredicate;
      this.dataSourceReceived.filterPredicate = filterPredicate;

      this.loading = false;
    }, 800);
  }

  onTabChange(event: MatTabChangeEvent): void {
    this.activeTabIndex = event.index;
    // Optionally reset filters on tab change
    // this.applyFilter('', this.tabs[event.index].key);
  }

  applyFilter(value: string, type: "all" | "sent" | "received"): void {
    const filterValue = value.trim().toLowerCase();
    if (type === "all") {
      this.dataSourceAll.filter = filterValue;
      this.dataSourceAll.paginator?.firstPage();
    } else if (type === "sent") {
      this.dataSourceSent.filter = filterValue;
      this.dataSourceSent.paginator?.firstPage();
    } else if (type === "received") {
      this.dataSourceReceived.filter = filterValue;
      this.dataSourceReceived.paginator?.firstPage();
    }
  }

  formatDate(dateString: string): string {
    return this.datePipe.transform(dateString, "medium") || "";
  }

  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case "failed":
        return "badge-error";
      case "pending":
        return "badge-warning";
      case "success":
        return "badge-success";
      default:
        return "badge-info";
    }
  }
}
