import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProcessService } from '../../core/services/process.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './analysis.component.html',
  styleUrls: ['./analysis.component.scss']
})
export class AnalysisComponent implements OnInit {
  activeTab = 'overview';
  loading = false;
  
  constructor(private processService: ProcessService) {}

  ngOnInit(): void {
    this.loadAnalysisData();
  }

  loadAnalysisData(): void {
    this.loading = true;
    
    // Simulate loading data
    setTimeout(() => {
      this.loading = false;
    }, 1000);
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  runAnalysis(): void {
    this.loading = true;
    
    // Simulate loading data
    setTimeout(() => {
      this.loading = false;
    }, 1500);
  }
}