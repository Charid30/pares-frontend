import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';

const KEY_DISMISSED = 'pwa_install_dismissed_at';
const KEY_INSTALLED = 'pwa_installed';
const DELAY_MS = 24 * 60 * 60 * 1000; // 24 heures

@Component({
  selector: 'app-pwa-install-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pwa-install-banner.html',
})
export class PwaInstallBanner implements OnInit, OnDestroy {
  visible = false;
  // 'install' = proposer l'installation | 'use-app' = déjà installée, ouvrir l'app
  mode: 'install' | 'use-app' = 'install';

  private deferredPrompt: any = null;
  private handler = (e: Event) => {
    e.preventDefault();
    if (this.isRunningStandalone() || this.isInCooldown()) return;
    this.deferredPrompt = e;
    // Si l'utilisateur a déjà installé mais ouvre dans le navigateur
    if (localStorage.getItem(KEY_INSTALLED) === 'true') {
      this.mode = 'use-app';
    } else {
      this.mode = 'install';
    }
    this.visible = true;
    this.cdr.detectChanges();
  };

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    if (typeof window === 'undefined') return;
    this.registerServiceWorker();

    // App déjà ouverte en standalone → rien à faire
    if (this.isRunningStandalone()) return;

    // Déjà installée mais ouvert dans le navigateur → bannière "Ouvrir l'app"
    if (localStorage.getItem(KEY_INSTALLED) === 'true' && !this.isInCooldown()) {
      this.mode = 'use-app';
      this.visible = true;
      this.cdr.detectChanges();
      return;
    }

    // Sinon, écouter l'événement d'installation si pas en cooldown
    if (!this.isInCooldown()) {
      window.addEventListener('beforeinstallprompt', this.handler);
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('beforeinstallprompt', this.handler);
  }

  private isRunningStandalone(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true ||
           document.referrer.includes('android-app://');
  }

  private isInCooldown(): boolean {
    const ts = localStorage.getItem(KEY_DISMISSED);
    if (!ts) return false;
    return Date.now() - parseInt(ts, 10) < DELAY_MS;
  }

  private registerServiceWorker(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }

  async install(): Promise<void> {
    if (!this.deferredPrompt) return;
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    this.visible = false;
    if (outcome === 'accepted') {
      localStorage.setItem(KEY_INSTALLED, 'true');
    } else {
      localStorage.setItem(KEY_DISMISSED, Date.now().toString());
    }
    this.cdr.detectChanges();
  }

  dismiss(): void {
    this.visible = false;
    this.deferredPrompt = null;
    localStorage.setItem(KEY_DISMISSED, Date.now().toString());
  }
}
