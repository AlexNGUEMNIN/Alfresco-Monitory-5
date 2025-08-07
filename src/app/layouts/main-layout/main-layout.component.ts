import {Component, HostListener, OnInit, signal} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import {NgClass, NgIf} from "@angular/common";

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, HeaderComponent, SidebarComponent, NgClass, NgIf],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css'
})
export class MainLayoutComponent implements OnInit {
  sidebarCollapsed = signal(true); // Start collapsed
  isMobile = false;

  ngOnInit() {
    this.checkScreenSize();
    // On desktop, show sidebar by default
    if (!this.isMobile) {
      this.sidebarCollapsed.set(false);
    }
  }

  ngOnDestroy() {
    // Cleanup if needed
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    const previousIsMobile = this.isMobile;
    this.checkScreenSize();

    // If switching from mobile to desktop, show sidebar
    if (previousIsMobile && !this.isMobile) {
      this.sidebarCollapsed.set(false);
    }
    // If switching from desktop to mobile, hide sidebar
    else if (!previousIsMobile && this.isMobile) {
      this.sidebarCollapsed.set(true);
    }
  }

  private checkScreenSize() {
    this.isMobile = window.innerWidth < 1024; // lg breakpoint
  }

  toggleSidebar() {
    this.sidebarCollapsed.update(value => !value);
  }
}
