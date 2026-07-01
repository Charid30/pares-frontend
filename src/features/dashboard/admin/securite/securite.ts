// securite.ts — Admin : Surveillance sécurité (IPs bannies + tentatives d'injection)
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Loader } from '../../../../shared/components/loader/loader';
import { StatCard } from '../../../../shared/components/stat-card/stat-card';

interface BannedIp {
  id: number;
  ip_address: string;
  attempts: number;
  last_pattern: string | null;
  banned_until: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SecurityLog {
  id: number;
  action: string;
  ip_address: string;
  details: { pattern?: string; attempts?: number; path?: string; method?: string } | null;
  createdAt: string;
}

interface SecurityStats {
  activeBans: number;
  totalSuspects: number;
  totalAttempts: number;
  recentLogs: SecurityLog[];
}

@Component({
  selector: 'app-securite',
  standalone: true,
  imports: [CommonModule, DatePipe, Loader, StatCard],
  templateUrl: './securite.html',
})
export class Securite implements OnInit {

  bannedIps: BannedIp[] = [];
  stats: SecurityStats | null = null;
  isLoading = false;
  isLoadingAction = false;
  errorMessage = '';
  successMessage = '';

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

  isBanned(ip: BannedIp): boolean {
    return !!ip.banned_until && new Date(ip.banned_until) > new Date();
  }

  heuresRestantes(ip: BannedIp): number {
    if (!ip.banned_until) return 0;
    return Math.max(0, Math.ceil((new Date(ip.banned_until).getTime() - Date.now()) / 3600000));
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
