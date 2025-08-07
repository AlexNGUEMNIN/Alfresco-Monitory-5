import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-status-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './status-card.component.html',
  styleUrls: ['./status-card.component.scss']
})
export class StatusCardComponent {
  @Input() title: string = '';
  @Input() value: number = 0;
  @Input() icon: string = '';
  @Input() color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' = 'primary';
  @Input() trend?: number;
  @Input() trendPositive?: boolean;
  @Input() suffix?: string;
}