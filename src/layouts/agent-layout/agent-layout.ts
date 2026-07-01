// src/layouts/agent-layout/agent-layout.ts
// Layout générique pour les rôles personnalisés (non système)
// Le menu est construit dynamiquement selon les permissions du rôle connecté
import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { NotificationBellComponent } from '../../shared/components/notification-bell/notification-bell';
import { environment } from '../../environments/environment';

interface MenuItem {
  label: string;
  icon: string;
  route?: string;
  module?: string; // module DB correspondant
  children?: MenuItem[]; // sous-menu (ex. "Stage (Vue globale)" → En attente / Approuvé / En cours)
}

// Mapping module DB → item de menu
const MODULE_MENU_MAP: Record<string, Omit<MenuItem, 'route'>> = {
  CANDIDATURES: {
    label: 'Candidatures Reçues',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    module: 'CANDIDATURES',
  },
  CANDIDATS: {
    label: 'Candidats',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    module: 'CANDIDATS',
  },
  STAGE: {
    label: 'Stages',
    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
    module: 'STAGE',
  },
  SUIVI_STAGE: {
    label: 'Suivi des Stages',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    module: 'SUIVI_STAGE',
  },
  SUSPENSION_STAGE: {
    label: 'Suspensions / Annulations',
    icon: 'M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z',
    module: 'SUSPENSION_STAGE',
  },
  OFFRE: {
    label: 'Offres Commerciales',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    module: 'OFFRE',
  },
  AIDE: {
    label: 'Aides Sociales',
    icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
    module: 'AIDE',
  },
  DEMANDE_AUDIENCE: {
    label: 'Demandes d\'Audience',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    module: 'DEMANDE_AUDIENCE',
  },
  AGENTS: {
    label: 'Agents',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    module: 'AGENTS',
  },
  SERVICES: {
    label: 'Services',
    icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    module: 'SERVICES',
  },
};

// Mapping module → route enfant sous /dashboard/agent/
const MODULE_ROUTE_MAP: Record<string, string> = {
  CANDIDATURES:     '/dashboard/agent/candidatures',
  CANDIDATS:        '/dashboard/agent/candidats',
  STAGE:            '/dashboard/agent/stages',
  SUIVI_STAGE:      '/dashboard/agent/suivi-stages',
  SUSPENSION_STAGE: '/dashboard/agent/suspensions',
  OFFRE:            '/dashboard/agent/offres',
  AIDE:             '/dashboard/agent/aides',
  DEMANDE_AUDIENCE: '/dashboard/agent/audiences',
  AGENTS:           '/dashboard/agent/agents',
  SERVICES:         '/dashboard/agent/services',
};

@Component({
  selector: 'app-agent-layout',
  imports: [RouterOutlet, CommonModule, RouterModule, NotificationBellComponent],
  templateUrl: './agent-layout.html',
})
export class AgentLayout implements OnInit, OnDestroy {
  readonly appVersion = environment.appVersion;
  currentUser: any = null;
  sidebarOpen = true;
  sidebarMobileOpen = false;
  userMenuOpen = false;
  menuItems: MenuItem[] = [];
  expandedMenuLabel: string | null = null;

  toggleSubmenu(item: MenuItem): void {
    this.expandedMenuLabel = this.expandedMenuLabel === item.label ? null : item.label;
  }

  // ── Centre de notifications (cloche) ─────────────────────
  notifOpen = false;
  notifLoading = false;
  recentEvents: any[] = [];

  // ── Paramètres notifications ──────────────────────────────
  showParamsPanel = false;
  loadingPrefs = false;
  savingPrefs = false;
  savedOk = false;
  notifPrefs: Record<string, boolean> = {
    STAGE: true, OFFRE: true, AIDE: true, AUDIENCE: true,
  };
  readonly notifLabels: { key: string; label: string; description: string }[] = [
    { key: 'STAGE',    label: 'Demandes de stage',   description: 'Notifié à chaque nouvelle demande de stage soumise' },
    { key: 'OFFRE',    label: 'Demandes d\'offre',    description: 'Notifié à chaque nouvelle demande d\'offre soumise' },
    { key: 'AIDE',     label: 'Demandes d\'aide',     description: 'Notifié à chaque nouvelle demande d\'aide soumise' },
    { key: 'AUDIENCE', label: 'Demandes d\'audience', description: 'Notifié à chaque nouvelle demande d\'audience soumise' },
  ];

  // Couleur thème (orange/primary pour les rôles personnalisés)
  readonly themeGradientHeader = 'from-orange-500 to-orange-600';
  readonly themeNavBg = 'from-orange-900 to-orange-950';
  readonly themeTextColor = 'text-orange-100';
  readonly themeHover = 'hover:bg-white/10 hover:text-white';
  readonly themeUserBg = 'bg-orange-950';
  readonly themeUserBorder = 'border-orange-800/50';
  readonly themeAvatar = 'from-orange-400 to-orange-600';

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    public notificationService: NotificationService,
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser) {
      this.router.navigate(['/auth/login']);
      return;
    }

    // Construire le menu avec les permissions en cache, puis rafraîchir depuis le serveur
    this.buildMenu();

    this.authService.refreshUser().subscribe({
      next: () => {
        this.currentUser = this.authService.getCurrentUser();
        this.buildMenu(); // Reconstruire avec les permissions à jour
      },
      error: () => { /* On garde les permissions en cache si le serveur est inaccessible */ },
    });

    if (window.innerWidth < 1024) {
      this.sidebarOpen = false;
    }

    // Charger les événements récents en arrière-plan (pour le badge)
    this.loadRecentEvents();

    // Démarrer le polling des notifications in-app (toutes les 30s)
    this.notificationService.startPolling(30000);
  }

  ngOnDestroy(): void {
    this.notificationService.stopPolling();
  }

  private buildMenu(): void {
    const modules = this.authService.getAccessibleModules();

    // Tableau de bord toujours en premier
    this.menuItems = [
      {
        label: 'Tableau de bord',
        icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
        route: '/dashboard/agent',
      }
    ];

    // Ajouter les modules selon les permissions
    const moduleOrder = ['CANDIDATURES', 'CANDIDATS', 'STAGE', 'SUIVI_STAGE', 'SUSPENSION_STAGE', 'OFFRE', 'AIDE', 'DEMANDE_AUDIENCE', 'AGENTS', 'SERVICES'];
    for (const mod of moduleOrder) {
      if (!modules.includes(mod) || !MODULE_MENU_MAP[mod]) continue;
      if (mod === 'STAGE') {
        this.pushStageMenuItems();
        continue;
      }
      this.menuItems.push({
        ...MODULE_MENU_MAP[mod],
        route: MODULE_ROUTE_MAP[mod],
      });
    }
  }

  /**
   * Le module STAGE peut donner lieu à DEUX entrées de menu distinctes pour ne jamais
   * mélanger les deux usages :
   * - "Stage [ACCRONYME]" : menu d'action, limité à la direction de l'agent (rôle
   *   type Approbateur), même si l'agent a par ailleurs un rôle "lecture globale".
   * - "Stage" : vue globale en lecture seule, visible uniquement si l'agent a un rôle
   *   "lecture globale" (sous-admin) sur STAGE — aucune action possible.
   */
  private pushStageMenuItems(): void {
    const hasActionRole = ['APPROUVER', 'VALIDER', 'REJETER'].some(a => this.authService.hasPermission('STAGE', a));
    const hasGlobalReadOnly = this.authService.hasLectureGlobale('STAGE');
    const accronyme = this.authService.getUserDirectionAccronyme();
    const base = MODULE_MENU_MAP['STAGE'];

    if (hasActionRole) {
      this.menuItems.push({
        ...base,
        label: accronyme ? `Stage ${accronyme}` : base.label,
        route: MODULE_ROUTE_MAP['STAGE'],
      });
    }
    if (hasGlobalReadOnly) {
      this.menuItems.push({
        ...base,
        label: 'Stage (Vue globale)',
        children: [
          { label: 'Stage En attente', icon: base.icon, route: '/dashboard/agent/stages-global/en-attente' },
          { label: 'Stage Approuvé',   icon: base.icon, route: '/dashboard/agent/stages-global/approuve' },
          { label: 'Stage En cours',   icon: base.icon, route: '/dashboard/agent/stages-global/en-cours' },
          { label: 'Stage Terminé',    icon: base.icon, route: '/dashboard/agent/stages-global/termine' },
        ],
      });
    }
    if (!hasActionRole && !hasGlobalReadOnly) {
      // Accès simple (ex. CONSULTER seul, sans rôle d'action ni lecture globale)
      this.menuItems.push({ ...base, route: MODULE_ROUTE_MAP['STAGE'] });
    }
  }

  get roleDescription(): string {
    return this.currentUser?.roleDescription || this.currentUser?.role || 'Agent';
  }

  get fullName(): string {
    const p = this.currentUser?.prenom || '';
    const n = this.currentUser?.nom || '';
    return (p + ' ' + n).trim() || this.currentUser?.username || 'Agent';
  }

  get userInitials(): string {
    const p = this.currentUser?.prenom?.[0] || '';
    const n = this.currentUser?.nom?.[0] || '';
    return (p + n).toUpperCase() || this.currentUser?.username?.charAt(0).toUpperCase() || 'A';
  }

  get userInitial(): string {
    return this.userInitials;
  }

  /** Détecte si une valeur est un matricule (numérique) plutôt qu'un email */
  isMatricule(value?: string | null): boolean {
    if (!value) return false;
    return /^\d+$/.test(value.trim());
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.userMenuOpen && !target.closest('[data-user-menu]')) {
      this.userMenuOpen = false;
    }
    if (this.notifOpen && !target.closest('[data-notif-panel]')) {
      this.notifOpen = false;
    }
  }

  toggleNotifPanel(): void {
    this.notifOpen = !this.notifOpen;
  }

  loadRecentEvents(): void {
    this.notifLoading = true;
    this.cdr.detectChanges();
    this.http.get<any>(`${environment.apiUrl}/users/agents/me/recent-events`).subscribe({
      next: (r) => {
        this.recentEvents = r.success ? (r.data || []) : [];
        this.notifLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.recentEvents = [];
        this.notifLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  /** Couleur du badge selon le type de module */
  getEventColor(type: string): string {
    const map: Record<string, string> = {
      CANDIDATURES:     'bg-indigo-100 text-indigo-700',
      CANDIDATS:        'bg-violet-100 text-violet-700',
      STAGE:            'bg-emerald-100 text-emerald-700',
      SUIVI_STAGE:      'bg-teal-100 text-teal-700',
      OFFRE:            'bg-amber-100 text-amber-700',
      AIDE:             'bg-rose-100 text-rose-700',
      DEMANDE_AUDIENCE: 'bg-orange-100 text-orange-700',
      AGENTS:           'bg-slate-100 text-slate-700',
      SERVICES:         'bg-gray-100 text-gray-600',
    };
    return map[type] || 'bg-gray-100 text-gray-600';
  }

  /** Icône SVG path selon le type */
  getEventIcon(type: string): string {
    const map: Record<string, string> = {
      CANDIDATURES:     'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      CANDIDATS:        'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
      STAGE:            'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
      SUIVI_STAGE:      'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
      OFFRE:            'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      AIDE:             'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
      DEMANDE_AUDIENCE: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      AGENTS:           'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    };
    return map[type] || 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
  }

  /** Libellé lisible du statut */
  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      BROUILLON: 'Brouillon', ACTIVE: 'Active', CLOTUREE: 'Clôturée', ANNULEE: 'Annulée',
      EN_ATTENTE: 'En attente', ACCEPTE: 'Accepté', REJETE: 'Rejeté', ANNULE: 'Annulé',
      SOUMISE: 'Soumise', EN_EXAMEN: 'En examen', VALIDEE: 'Validée', REJETEE: 'Rejetée',
      EN_COURS: 'En cours', TERMINE: 'Terminé', EXPIRE: 'Expiré', RAPPORT_SOUMIS: 'Rapport soumis',
      EN_COURS_DE_TRAITEMENT: 'En traitement', EN_VERIFICATION: 'En vérification',
      INSCRIT: 'Inscrit', ACTIF: 'Actif',
    };
    return map[status] || status;
  }

  /** Affiche une date relative (il y a X) */
  timeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return "À l'instant";
    if (m < 60) return `Il y a ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `Il y a ${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7)  return `Il y a ${d}j`;
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }

  toggleSidebar(): void { this.sidebarOpen = !this.sidebarOpen; }
  toggleSidebarMobile(): void { this.sidebarMobileOpen = !this.sidebarMobileOpen; }
  closeSidebarMobile(): void { this.sidebarMobileOpen = false; }
  toggleUserMenu(): void { this.userMenuOpen = !this.userMenuOpen; }

  logout(): void {
    this.authService.logout();
  }

  // ── Paramètres notifications ──────────────────────────────

  openParamsPanel(): void {
    this.showParamsPanel = true;
    this.savedOk = false;
    this.loadingPrefs = true;
    this.cdr.detectChanges();
    this.http.get<any>(`${environment.apiUrl}/users/agents/me/notifications`).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.notifPrefs = { ...this.notifPrefs, ...r.data };
        }
        this.loadingPrefs = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingPrefs = false; this.cdr.detectChanges(); },
    });
  }

  closeParamsPanel(): void { this.showParamsPanel = false; }

  toggleNotif(key: string): void {
    this.notifPrefs[key] = !this.notifPrefs[key];
  }

  saveNotifPrefs(): void {
    this.savingPrefs = true;
    this.savedOk = false;
    this.http.put<any>(`${environment.apiUrl}/users/agents/me/notifications`, this.notifPrefs).subscribe({
      next: () => {
        this.savingPrefs = false;
        this.savedOk = true;
        this.cdr.detectChanges();
        setTimeout(() => { this.savedOk = false; this.cdr.detectChanges(); }, 3000);
      },
      error: () => { this.savingPrefs = false; this.cdr.detectChanges(); },
    });
  }
}
