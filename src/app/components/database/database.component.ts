import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgChartsModule } from 'ng2-charts';
import { ChartConfiguration, ChartDataset } from 'chart.js';
import { MetricsService } from '../../core/services/metrics-service.service';

@Component({
  selector: 'app-database',
  standalone: true,
  imports: [CommonModule, NgChartsModule],
  templateUrl: './database.component.html',
  styleUrls: ['./database.component.scss']
})
export class DatabaseComponent implements OnInit {
  timeLabels: string[] = [];
  cpuData: number[] = [];
  memData: number[] = [];
  dbLabels: string[] = [];
  dbSizes: number[] = [];

  constructor(private metrics: MetricsService) {}

  ngOnInit(): void {
    this.metrics.getMetrics().subscribe(data => {
      const currentTime = new Date().toLocaleTimeString();

      // Maintain last 20 data points
      this.timeLabels.push(currentTime);
      this.cpuData.push(data.cpu);
      this.memData.push(data.memory);
      if (this.timeLabels.length > 20) this.timeLabels.shift();
      if (this.cpuData.length > 20) this.cpuData.shift();
      if (this.memData.length > 20) this.memData.shift();

      // Update DB chart
      this.dbLabels = Object.keys(data.db);
      this.dbSizes = Object.values(data.db);
    });
  }

  get cpuChart(): {
    datasets: {
      borderColor: string;
      backgroundColor: string;
      tension: number;
      data: number[];
      label: string;
      fill: boolean
    }[];
    labels: string[]
  } {
    return {
      labels: this.timeLabels,
      datasets: [
        {
          data: this.cpuData,
          label: 'CPU (%)',
          borderColor: 'rgba(54, 162, 235, 1)',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          fill: true,
          tension: 0.4
        }
      ]
    };
  }

  get memChart(): {
    datasets: {
      borderColor: string;
      backgroundColor: string;
      tension: number;
      data: number[];
      label: string;
      fill: boolean
    }[];
    labels: string[]
  } {
    return {
      labels: this.timeLabels,
      datasets: [
        {
          data: this.memData,
          label: 'Memory (%)',
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          fill: true,
          tension: 0.4
        }
      ]
    };
  }

// Reusable options for line charts
  lineChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: false }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100
      }
    }
  };

// Bar chart options
  barChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Database Table Sizes', font: { size: 14 } }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          font: { size: 10 }
        }
      },
      x: {
        ticks: {
          font: { size: 10 }
        }
      }
    }
  };

  get dbChart(): ChartConfiguration<'bar'>['data'] {
    return {
      labels: this.dbLabels,
      datasets: [
        {
          data: this.dbSizes,
          label: 'Table Size (MB)',
          backgroundColor: '#f97316' // orange
        }
      ]
    };
  }
}
