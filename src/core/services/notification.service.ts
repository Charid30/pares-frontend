// src/core/services/notification.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, interval, Subscription } from 'rxjs';
import { switchMap, startWith } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Notification {
  id: number;
  type: string;
  titre: string;
  message: string;
  link: string | null;
  read: number;       // 0 = non lu, 1 = lu
  createdAt: string;
}

interface NotifListResponse {
  success: boolean;
  data: {
    total: number;
    page: number;
    limit: number;
    items: Notification[];
  };
}

interface UnreadCountResponse {
  success: boolean;
  data: { count: number };
}

@Injectable({ providedIn: 'root' })
export class NotificationService {

  private readonly api = `${environment.apiUrl}/notifications`;

  // Nombre de non-lues — partagé avec tous les composants abonnés
  private _unreadCount$ = new BehaviorSubject<number>(0);
  readonly unreadCount$ = this._unreadCount$.asObservable();

  private pollSub?: Subscription;

  constructor(private http: HttpClient) {}

  // ─── Polling (appeler au OnInit du layout, arrêter au OnDestroy) ───────────

  startPolling(intervalMs = 30000): void {
    this.stopPolling();
    this.pollSub = interval(intervalMs).pipe(
      startWith(0),          // charge immédiatement au démarrage
      switchMap(() => this.http.get<UnreadCountResponse>(`${this.api}/unread-count`))
    ).subscribe({
      next: (res) => {
        if (res.success) this._unreadCount$.next(res.data.count);
      },
      error: () => { /* silencieux — réseau indisponible */ },
    });
  }

  stopPolling(): void {
    this.pollSub?.unsubscribe();
  }

  // ─── Récupérer la liste ─────────────────────────────────────────────────────

  getNotifications(page = 1, limit = 20) {
    return this.http.get<NotifListResponse>(`${this.api}?page=${page}&limit=${limit}`);
  }

  // ─── Marquer une notif comme lue ────────────────────────────────────────────

  markRead(id: number) {
    return this.http.put<{ success: boolean }>(`${this.api}/${id}/read`, {});
  }

  // ─── Tout marquer comme lu ──────────────────────────────────────────────────

  markAllRead() {
    return this.http.put<{ success: boolean }>(`${this.api}/read-all`, {});
  }

  // ─── Décrémenter localement (sans attendre le prochain poll) ───────────────

  decrementUnread(n = 1): void {
    const cur = this._unreadCount$.value;
    this._unreadCount$.next(Math.max(0, cur - n));
  }

  resetUnread(): void {
    this._unreadCount$.next(0);
  }
}
