// securite.ts — Admin : Surveillance sécurité (IPs bannies + tentatives d'injection)
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { Loader } from '../../../../shared/components/loader/loader';
import { StatCard } from '../../../../shared/components/stat-card/stat-card';

interface GeoInfo {
  country: string | null;
  countryName: string | null;
  region: string | null;
  city: string | null;
  ll: [number, number] | null;
}

interface BannedIp {
  id: number;
  ip_address: string;
  attempts: number;
  last_pattern: string | null;
  banned_until: string | null;
  permanent: boolean;
  geo: GeoInfo | null;
  createdAt: string;
  updatedAt: string;
}

interface SecurityLogDetails {
  pattern?: string;
  matchedField?: string | null;
  matchedValue?: string | null;
  attempts?: number;
  path?: string;
  method?: string;
  reason?: string | null;
  permanent?: boolean;
  durationHours?: number | null;
}

interface SecurityLog {
  id: number;
  action: string;
  ip_address: string;
  details: SecurityLogDetails | null;
  geo: GeoInfo | null;
  createdAt: string;
}

interface SecurityStats {
  activeBans: number;
  totalSuspects: number;
  totalAttempts: number;
  recentLogs: SecurityLog[];
}

interface UserMatch {
  idusers: number;
  username: string;
  last_login_ip: string | null;
  last_login_at: string | null;
  role?: { idrole: number; accronyme: string; description: string } | null;
  candidat?: { idcandidats: number; nom: string; prenom: string; email: string; telephone?: string } | null;
  agents?: { idagents: number; nom: string; prenom: string; email: string; matricule: string; actif: boolean }[];
}

@Component({
  selector: 'app-securite',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, Loader, StatCard],
  templateUrl: './securite.html',
})
export class Securite implements OnInit {

  bannedIps: BannedIp[] = [];
  stats: SecurityStats | null = null;
  isLoading = false;
  isLoadingAction = false;
  errorMessage = '';
  successMessage = '';

  // ─── Modale détails (requêtes suspectes + profil éventuel) ─────────────
  detailsIp: BannedIp | null = null;
  detailsLoading = false;
  detailsLogs: SecurityLog[] = [];
  detailsUser: UserMatch | null = null;

  // ─── Modale bannissement manuel ─────────────────────────────────────────
  showBanManualModal = false;
  banManualLoading = false;
  banManualForm = { ip_address: '', reason: '', permanent: false, durationHours: 72 };

  private readonly base = `${environment.apiUrl}/admin/security`;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.http.get<{ success: boolean; data: BannedIp[] }>(`${this.base}/banned`).subscribe({
      next: (res) => {
        if (res.success) this.bannedIps = res.data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.isLoading = false; this.cdr.detectChanges(); }
    });

    this.http.get<{ success: boolean; data: SecurityStats }>(`${this.base}/stats`).subscribe({
      next: (res) => {
        if (res.success) this.stats = res.data;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  unban(ip: BannedIp): void {
    this.isLoadingAction = true;
    this.http.put<{ success: boolean }>(`${this.base}/banned/${ip.id}/unban`, {}).subscribe({
      next: () => {
        this.successMessage = `IP ${ip.ip_address} débannie avec succès.`;
        this.isLoadingAction = false;
        this.load();
        setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: () => { this.isLoadingAction = false; this.cdr.detectChanges(); }
    });
  }

  banPermanently(ip: BannedIp): void {
    this.isLoadingAction = true;
    this.http.put<{ success: boolean }>(`${this.base}/banned/${ip.id}/ban-permanent`, {}).subscribe({
      next: () => {
        this.successMessage = `IP ${ip.ip_address} bannie définitivement.`;
        this.isLoadingAction = false;
        this.load();
        setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: () => { this.isLoadingAction = false; this.cdr.detectChanges(); }
    });
  }

  deleteEntry(ip: BannedIp): void {
    this.isLoadingAction = true;
    this.http.delete<{ success: boolean }>(`${this.base}/banned/${ip.id}`).subscribe({
      next: () => {
        this.successMessage = `Entrée ${ip.ip_address} supprimée.`;
        this.isLoadingAction = false;
        this.load();
        setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: () => { this.isLoadingAction = false; this.cdr.detectChanges(); }
    });
  }

  // ─── Détails d'une IP (requêtes suspectes + profil éventuel) ───────────
  ouvrirDetails(ip: BannedIp): void {
    this.detailsIp = ip;
    this.detailsLoading = true;
    this.detailsLogs = [];
    this.detailsUser = null;

    this.http.get<{ success: boolean; data: SecurityLog[] }>(`${this.base}/logs/${encodeURIComponent(ip.ip_address)}`).subscribe({
      next: (res) => {
        if (res.success) this.detailsLogs = res.data;
        this.cdr.detectChanges();
      },
      error: () => { this.cdr.detectChanges(); }
    });

    this.http.get<{ success: boolean; data: UserMatch | null }>(`${this.base}/user-by-ip/${encodeURIComponent(ip.ip_address)}`).subscribe({
      next: (res) => {
        if (res.success) this.detailsUser = res.data;
        this.detailsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.detailsLoading = false; this.cdr.detectChanges(); }
    });
  }

  fermerDetails(): void {
    this.detailsIp = null;
    this.detailsLogs = [];
    this.detailsUser = null;
  }

  // ─── Bannissement manuel ─────────────────────────────────────────────────
  ouvrirBanManuel(): void {
    this.banManualForm = { ip_address: '', reason: '', permanent: false, durationHours: 72 };
    this.showBanManualModal = true;
  }

  fermerBanManuel(): void {
    this.showBanManualModal = false;
  }

  soumettreBanManuel(): void {
    if (!this.banManualForm.ip_address.trim()) return;
    this.banManualLoading = true;
    this.http.post<{ success: boolean }>(`${this.base}/ban-manual`, this.banManualForm).subscribe({
      next: () => {
        this.successMessage = `IP ${this.banManualForm.ip_address} bannie avec succès.`;
        this.banManualLoading = false;
        this.showBanManualModal = false;
        this.load();
        setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: (err) => {
        this.errorMessage = err.error?.message || "Erreur lors du bannissement";
        this.banManualLoading = false;
        this.cdr.detectChanges();
        setTimeout(() => { this.errorMessage = ''; this.cdr.detectChanges(); }, 4000);
      }
    });
  }

  isBanned(ip: BannedIp): boolean {
    return ip.permanent || (!!ip.banned_until && new Date(ip.banned_until) > new Date());
  }

  heuresRestantes(ip: BannedIp): number {
    if (!ip.banned_until) return 0;
    return Math.max(0, Math.ceil((new Date(ip.banned_until).getTime() - Date.now()) / 3600000));
  }

  geoLabel(geo: GeoInfo | null): string {
    if (!geo || !geo.country) return 'Locale / Inconnue';
    return geo.city ? `${geo.city}, ${geo.country}` : (geo.countryName || geo.country);
  }

  flagEmoji(countryCode: string | null): string {
    if (!countryCode || countryCode.length !== 2) return '🌐';
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map((c) => 127397 + c.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  }

  patternLabel(pattern: string | null): string {
    const labels: Record<string, string> = {
      SQL_KEYWORD: 'SQL – Mot-clé',
      SQL_OR_AND: 'SQL – OR/AND',
      SQL_COMMENT: 'SQL – Commentaire',
      SQL_STACKED: 'SQL – Requête empilée',
      SQL_FUNC: 'SQL – Fonction',
      SQL_TAUTOLOGY: 'SQL – Tautologie',
      XSS_SCRIPT: 'XSS – Script',
      XSS_JAVASCRIPT: 'XSS – javascript:',
      XSS_EVENT: 'XSS – Événement',
      XSS_TAG: 'XSS – Balise',
      XSS_DOM: 'XSS – DOM',
      XSS_EVAL: 'XSS – eval()',
      PATH_TRAVERSAL: 'Path traversal',
      PATH_TRAVERSAL_ENCODED: 'Path traversal encodé',
      PATH_SENSITIVE: 'Fichier sensible',
      CMD_INJECTION: 'Injection commande',
      CMD_SUBSHELL: 'Sous-shell',
    };
    return pattern ? (labels[pattern] ?? pattern) : '—';
  }
}
