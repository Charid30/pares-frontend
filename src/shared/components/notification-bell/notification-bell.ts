// src/shared/components/notification-bell/notification-bell.ts
import {
  Component, OnInit, OnDestroy, HostListener,
  ChangeDetectorRef, Input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NotificationService, Notification } from '../../../core/services/notification.service';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-bell.html',
})
export class NotificationBellComponent implements OnInit, OnDestroy {

  /** Couleur du badge — 'red' (agent) ou 'primary' (candidat, bleu) */
  @Input() theme: 'red' | 'primary' = 'red';
  /** Fond du bouton — 'light' pour topbar blanche, 'dark' pour sidebar sombre */
  @Input() variant: 'light' | 'dark' = 'dark';

  open = false;
  loading = false;
  unreadCount = 0;
  notifications: Notification[] = [];
  hasMore = false;
  private page = 1;
  private readonly limit = 10;

  private countSub?: Subscription;

  constructor(
    private notifService: NotificationService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.countSub = this.notifService.unreadCount$.subscribe((count) => {
      this.unreadCount = count;
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.countSub?.unsubscribe();
  }

  // ─── Ouvrir / fermer le panel ──────────────────────────────────────────────

  togglePanel(): void {
    this.open = !this.open;
    if (this.open && this.notifications.length === 0) {
      this.loadPage(1);
    }
  }

  @HostListener('document:click', ['$event'])
  onOutsideClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target.closest('.notif-bell-wrapper')) {
      this.open = false;
    }
  }

  // ─── Charger une page ──────────────────────────────────────────────────────

  loadPage(page: number): void {
    this.loading = true;
    this.notifService.getNotifications(page, this.limit).subscribe({
      next: (res) => {
        if (res.success) {
          if (page === 1) {
            this.notifications = res.data.items;
          } else {
            this.notifications = [...this.notifications, ...res.data.items];
          }
          this.page = page;
          this.hasMore = (page * this.limit) < res.data.total;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  loadMore(): void {
    this.loadPage(this.page + 1);
  }

  // ─── Marquer une notif comme lue et naviguer ──────────────────────────────

  handleClick(notif: Notification): void {
    if (!notif.read) {
      this.notifService.markRead(notif.id).subscribe();
      notif.read = 1;
      this.notifService.decrementUnread();
    }
    if (notif.link) {
      this.open = false;
      try {
        const url   = new URL(notif.link);
        let path    = url.pathname;
        const query = url.search;

        // Remappe les chemins agent → admin quand on est dans le layout admin
        if (this.router.url.startsWith('/admin') && path.startsWith('/dashboard/agent/')) {
          path = this.remapAgentToAdmin(path);
        }

        this.router.navigateByUrl(path + query);
      } catch {
        this.router.navigateByUrl(notif.link);
      }
    }
  }

  // ─── Tout marquer comme lu ─────────────────────────────────────────────────

  markAllRead(): void {
    this.notifService.markAllRead().subscribe({
      next: () => {
        this.notifications.forEach(n => n.read = 1);
        this.notifService.resetUnread();
        this.cdr.detectChanges();
      },
    });
  }

  // ─── Helpers template ─────────────────────────────────────────────────────

  get badgeClass(): string {
    return this.theme === 'primary' ? 'bg-blue-500' : 'bg-red-500';
  }

  get buttonClass(): string {
    return this.variant === 'light'
      ? 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
      : 'text-slate-400 hover:text-white hover:bg-white/10';
  }

  timeAgo(iso: string): string {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60)   return 'À l\'instant';
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
    return new Date(iso).toLocaleDateString('fr-FR');
  }

  iconForType(type: string): string {
    if (type.includes('STAGE'))      return 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253';
    if (type.includes('OFFRE'))      return 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';
    if (type.includes('AIDE'))       return 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z';
    if (type.includes('AUDIENCE'))   return 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z';
    if (type.includes('RECRUT') || type.includes('CANDIDAT')) return 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z';
    return 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9';
  }

  private remapAgentToAdmin(path: string): string {
    const base = path.replace('/dashboard/agent/', '');
    const map: Record<string, string> = {
      'stages':       '/admin/stages',
      'recrutement':  '/admin/recrutements',
      'recrutements': '/admin/recrutements',
      'offres':       '/admin/offres-commerciales',
      'aides':        '/admin/aides-sociales',
      'aides-sociales': '/admin/aides-sociales',
      'audiences':    '/admin/audiences',
    };
    return map[base] ?? `/admin/${base}`;
  }

  isSuccess(type: string): boolean {
    return type.includes('ACCEPTE') || type.includes('VALIDEE') || type.includes('SOUMISSION');
  }

  isError(type: string): boolean {
    return type.includes('REJETE') || type.includes('REFUSE');
  }
}
