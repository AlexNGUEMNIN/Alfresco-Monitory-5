import { Component, Input, Output, EventEmitter, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { HttpClient } from "@angular/common/http";
import { environment } from '../../../../environments/environment';

export interface ProcessFilter {
  processCase?: string;
  processDefinitionId?: string;
  processInstanceId?: string;
  periodInDays?: number;
  sortOrder?: 'ASC' | 'DESC';
  assigneeId?: string;
}

@Component({
  selector: 'app-advanced-filter-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: './app-advanced-filter-modal.component.html',
  styleUrls: ['./app-advanced-filter-modal.component.scss']
})
export class AdvancedFilterModalComponent implements OnInit {
  @Input() filters: ProcessFilter = {
    processCase: '',
    processDefinitionId: '',
    processInstanceId: '',
    periodInDays: 0,
    sortOrder: 'ASC',
    assigneeId: ''
  };

  @Output() close = new EventEmitter<void>();
  @Output() filterApplied = new EventEmitter<ProcessFilter>();

  processDefinitions: any[] = [];
  processInstances: any[] = [];

  processDefinitionControl = new FormControl('');
  processInstanceControl = new FormControl('');

  showDefinitionDropdown = false;
  showInstanceDropdown = false;
  filteredDefs: any[] = [];
  filteredInsts: any[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadProcessDefinitions();
    this.loadProcessInstances();

    this.processDefinitionControl.valueChanges.subscribe(() => {
      this.filterDefinitions();
    });

    this.processInstanceControl.valueChanges.subscribe(() => {
      this.filterInstances();
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('#processDefinition') && !target.closest('.dropdown-list')) {
      this.showDefinitionDropdown = false;
    }
    if (!target.closest('#processInstance') && !target.closest('.dropdown-list')) {
      this.showInstanceDropdown = false;
    }
  }

  loadProcessDefinitions(): void {
    this.http.get<any[]>(`${environment.api2Url}/procdef`).subscribe({
      next: (data) => {
        this.processDefinitions = data;

        // Filter only unique names like the other version
        const seen = new Set();
        this.processDefinitions = data.filter(def => {
          if (seen.has(def.name_)) return false;
          seen.add(def.name_);
          return true;
        });

        this.filteredDefs = this.processDefinitions.slice(0, 4);

        if (this.filters.processDefinitionId) {
          const selected = this.processDefinitions.find(
              def => def.name_ === this.filters.processDefinitionId
          );
          if (selected) {
            this.processDefinitionControl.setValue(this.displayDefinition(selected));
          }
        }
      },
      error: () => this.processDefinitions = []
    });
  }

  loadProcessInstances(): void {
    this.http.get<any[]>(`${environment.api2Url}/procinst`).subscribe({
      next: (data) => {
        this.processInstances = data;
        this.filteredInsts = data.slice(0, 4);

        if (this.filters.processInstanceId) {
          const selected = this.processInstances.find(
              inst => inst.id_ === this.filters.processInstanceId
          );
          if (selected) {
            this.processInstanceControl.setValue(this.displayInstance(selected));
          }
        }
      },
      error: () => this.processInstances = []
    });
  }

  filterDefinitions(): void {
    const filterValue = this.processDefinitionControl.value?.toLowerCase() || '';
    this.filteredDefs = this.processDefinitions
        .filter(def =>
            def.name_.toLowerCase().includes(filterValue)
        )
        .slice(0, 4);
  }

  filterInstances(): void {
    const filterValue = this.processInstanceControl.value?.toLowerCase() || '';
    const selectedDefKey = this.filters.processDefinitionId;

    this.filteredInsts = this.processInstances
        .filter(inst =>
            (!selectedDefKey || (inst.proc_def_id_ && inst.proc_def_id_.startsWith(`${selectedDefKey}:`))) &&
            (
                (inst.name_ && inst.name_.toLowerCase().includes(filterValue)) ||
                (inst.id_ && inst.id_.toLowerCase().includes(filterValue))
            )
        )
        .slice(0, 4);
  }


  displayDefinition(def: any): string {
    return def ? def.name_ : '';
  }

  displayInstance(inst: any): string {
    return inst ? `${inst.name_ || ''} (${inst.id_})` : '';
  }

  selectDefinition(def: any): void {
    const defKey = def.key_;  // match all versions
    const defName = def.name_;
    this.processDefinitionControl.setValue(this.displayDefinition(def));
    this.filters.processDefinitionId = defKey;  // ✅ use key_ here
    this.showDefinitionDropdown = false;

    // Clear previous instance selection
    this.processInstanceControl.setValue('');
    this.filters.processInstanceId = '';

    // ✅ Show all instances for this process key
    this.filterInstancesByDefinitionKey(defKey);
  }

  filterInstancesByDefinitionKey(defKey: string): void {
    this.filteredInsts = this.processInstances
        .filter(inst => inst.proc_def_id_ && inst.proc_def_id_.startsWith(`${defKey}:`))

  }

  filterInstancesByDefinitionId(defId: string): void {
    this.filteredInsts = this.processInstances
        .filter(inst => inst.proc_def_id_ === defId)

  }


  selectInstance(inst: any): void {
    this.processInstanceControl.setValue(this.displayInstance(inst));
    this.filters.processInstanceId = inst.id_;
    this.showInstanceDropdown = false;
  }

  apply(): void {
    const emittedFilters = { ...this.filters };

    const selectedDef = this.processDefinitions.find(
        def => def.name_ === this.filters.processDefinitionId
    );
    if (selectedDef && selectedDef.name_) {
      emittedFilters.processDefinitionId = selectedDef.name_; // ✅ Use name only
    }

    this.filterApplied.emit(emittedFilters);
    this.closeModal();
  }

  closeModal(): void {
    this.close.emit();
  }
  dropdownOpen = false;
  selectedInstance: any = null;

  toggleDropdown(): void {
    this.dropdownOpen = !this.dropdownOpen;
  }

  closeDropdown(): void {
    this.dropdownOpen = false;
  }



}
