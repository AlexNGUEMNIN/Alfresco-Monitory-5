import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private isDarkModeSubject = new BehaviorSubject<boolean>(false);
  public isDarkMode$ = this.isDarkModeSubject.asObservable();

  constructor() {
    // Vérifier si un thème est déjà sauvegardé
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      const isDark = savedTheme === 'dark';
      this.isDarkModeSubject.next(isDark);
      this.applyTheme(isDark);
    }
  }

  toggleTheme(): void {
    const currentTheme = this.isDarkModeSubject.value;
    const newTheme = !currentTheme;
    this.isDarkModeSubject.next(newTheme);
    this.applyTheme(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  }

  private applyTheme(isDark: boolean): void {
    const body = document.body;
    if (isDark) {
      body.classList.add('dark-theme');
      body.classList.remove('light-theme');
    } else {
      body.classList.add('light-theme');
      body.classList.remove('dark-theme');
    }
  }

  getCurrentTheme(): boolean {
    return this.isDarkModeSubject.value;
  }
}