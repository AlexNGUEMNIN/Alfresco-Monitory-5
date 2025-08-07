// settings-modal.component.ts

import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SystemStatsService } from '../../../core/services/system-stats.service';
import { ThemeService } from '../../../core/services/theme.service';
import { SystemStats, ProcessStatusCount } from '../../../core/models/system-stats.model';

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings-modal.component.html',
  styleUrls: ['./settings-modal.component.scss']
})
export class SettingsModalComponent implements OnInit {
  @Input() isOpen = false;
  @Output() closeModal = new EventEmitter<void>();

  systemStats: SystemStats | null = null;
  processStatusCounts: ProcessStatusCount[] = [];

  loading = true;
  isDarkMode = false;
  saving = false;

  thresholdDays: number = 0;
  processDays: number = 0;

  constructor(
      private systemStatsService: SystemStatsService,
      private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    // this.loadSystemStats();
    this.loadThresholds();

    this.themeService.isDarkMode$.subscribe(isDark => this.isDarkMode = isDark);
  }

  // loadSystemStats(): void {
  //   this.loading = true;
  //   this.systemStatsService.getSystemStats().subscribe(stats => {
  //     this.systemStats = stats;
  //     this.loading = false;
  //   });
  //
  // }

  loadThresholds(): void {
    this.systemStatsService.getThresholds().subscribe(config => {
      this.thresholdDays = config.thresholdDays;
      this.processDays = config.process_thresholdDays;
    });
  }

  updateThresholds(): void {
    this.saving = true;
    this.systemStatsService.updateThresholds(this.thresholdDays, this.processDays).subscribe({
      next: msg => {
        console.log(msg);
        this.saving = false;
      },
      error: err => {
        console.error('Failed to update thresholds:', err);
        this.saving = false;
      }
    });
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  refreshStats(): void {
    // this.loadSystemStats();
  }

  onClose(): void {
    this.closeModal.emit();
  }

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  getProgressWidth(percentage: number): string {
    return `${percentage}%`;
  }
}
