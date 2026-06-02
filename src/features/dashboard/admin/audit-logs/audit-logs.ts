// audit-logs.ts — Admin : Journal d'activité (logs d'audit)
// Route backend :
//   GET /api/admin/audit       → liste paginée avec filtres
//   GET /api/admin/audit/meta  → modules et actions disponibles
import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AuditService, AuditLog, AuditFilters } from '../../../../core/services/audit.service';
import { SearchService } from '../../../../core/services/search.service';
import { Loader } from '../../../../shared/components/loader/loader';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, Loader],
  templateUrl: './audit-logs.html',
})
export class AuditLogs implements OnInit, OnDestroy {

  // ── Données ────────────────────────────────────────────────────────────────
  logs: AuditLog[] = [];
  isLoading = false;
  errorMessage = '';

  // ── Filtres ───────────────────────────────────────────────────────────────
  filterModule  = '';
  filterAction  = '';
  filterAgent   = '';
  filterDateDeb = '';
  filterDateFin = '';

  // ── Listes pour les selects ───────────────────────────────────────────────
  modules: string[] = [];
  actions: string[] = [];

  // ── Pagination ─────────────────────────────────────────────────────────────
  currentPage  = 1;
  totalPages   = 1;
  totalLogs    = 0;
  readonly pageSize = 20;

  private searchSub?: Subscription;

  constructor(
    private auditService: AuditService,
    private cdr: ChangeDetectorRef,
    private searchService: SearchService,
  ) {}

  ngOnInit(): void {
    this.loadMeta();
    this.loadLogs();
    this.searchSub = this.searchService.term$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
    ).subscribe(term => {
      this.filterAgent = term;
      this.loadLogs(1);
    });
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  // ── Chargement des modules/actions disponibles ────────────────────────────
  loadMeta(): void {
    this.auditService.getMeta().subscribe({
      next: (res) => {
        if (res.success) {
          this.modules = res.data.modules;
          this.actions = res.data.actions;
          this.cdr.detectChanges();
        }
      },
      error: () => { /* non bloquant */ }
    });
  }

  // ── Chargement des logs ────────────────────────────────────────────────────
  loadLogs(page = 1): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.currentPage = page;

    const filters: AuditFilters = {
      page,
      limit: this.pageSize,
    };
    if (this.filterModule)  filters.module    = this.filterModule;
    if (this.filterAction)  filters.action    = this.filterAction;
    if (this.filterAgent)   filters.agentNom  = this.filterAgent;
    if (this.filterDateDeb) filters.dateDebut = this.filterDateDeb;
    if (this.filterDateFin) filters.dateFin   = this.filterDateFin;

    this.auditService.getAuditLogs(filters).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.logs       = res.data;
          this.totalPages = res.pagination.totalPages;
          this.totalLogs  = res.pagination.total;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading    = false;
        this.errorMessage = err?.error?.message || 'Impossible de charger les logs d\'audit';
        this.cdr.detectChanges();
      },
    });
  }

  // ── Filtrage ───────────────────────────────────────────────────────────────
  appliquerFiltres(): void {
    this.loadLogs(1);
  }

  reinitialiserFiltres(): void {
    this.filterModule  = '';
    this.filterAction  = '';
    this.filterAgent   = '';
    this.filterDateDeb = '';
    this.filterDateFin = '';
    this.loadLogs(1);
  }

  // ── Pagination ─────────────────────────────────────────────────────────────
  changerPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.loadLogs(page);
  }

  get pages(): number[] {
    const start = Math.max(1, this.currentPage - 2);
    const end   = Math.min(this.totalPages, this.currentPage + 2);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  // ── Couleurs par action ────────────────────────────────────────────────────
  getActionColor(action: string): { bg: string; text: string } {
    if (action.includes('VALIDE') || action.includes('ACCEPTE') || action.includes('CREE')) {
      return { bg: '#e8f5e9', text: '#1e8449' };
    }
    if (action.includes('REJETE') || action.includes('SUPPRIME') || action.includes('REJETEE')) {
      return { bg: '#fde8e8', text: '#c0392b' };
    }
    if (action.includes('MODIFIE') || action.includes('TRAITEMENT') || action.includes('RENOUVELLEMENT')) {
      return { bg: '#e8f0fe', text: '#1a56db' };
    }
    return { bg: '#f3f4f6', text: '#374151' };
  }

  getModuleColor(module: string): { bg: string; text: string } {
    const map: Record<string, { bg: string; text: string }> = {
      STAGE:       { bg: '#fef3c7', text: '#92400e' },
      RECRUTEMENT: { bg: '#ede9fe', text: '#5b21b6' },
      OFFRE:       { bg: '#ecfdf5', text: '#065f46' },
      AIDE:        { bg: '#fff7ed', text: '#9a3412' },
      AUDIENCE:    { bg: '#f0f9ff', text: '#075985' },
      AGENT:       { bg: '#fdf2f8', text: '#701a75' },
    };
    return map[module] ?? { bg: '#f3f4f6', text: '#374151' };
  }

  // ── Libellé lisible pour une action ───────────────────────────────────────
  getActionLabel(action: string): string {
    const labels: Record<string, string> = {
      STAGE_ACCEPTE:           'Stage accepté',
      STAGE_REJETE:            'Stage rejeté',
      STAGE_EN_TRAITEMENT:     'Stage en traitement',
      RAPPORT_VALIDE:          'Rapport validé',
      RAPPORT_REJETE:          'Rapport rejeté',
      RENOUVELLEMENT_ACCEPTE:  'Renouvellement accepté',
      RENOUVELLEMENT_REJETE:   'Renouvellement rejeté',
      AGENT_CREE:              'Agent créé',
      AGENT_MODIFIE:           'Agent modifié',
      AGENT_SUPPRIME:          'Agent supprimé',
      OFFRE_VALIDEE:           'Offre validée',
      OFFRE_REJETEE:           'Offre rejetée',
      AIDE_VALIDEE:            'Aide validée',
      AIDE_REJETEE:            'Aide rejetée',
      AUDIENCE_ACCEPTEE:       'Audience acceptée',
      AUDIENCE_REJETEE:        'Audience rejetée',
    };
    return labels[action] ?? action;
  }

  // ── Format des détails ─────────────────────────────────────────────────────
  formatDetails(details: Record<string, any> | string | null): string {
    if (!details) return '—';
    let d: Record<string, any>;
    if (typeof details === 'string') {
      try { d = JSON.parse(details); } catch { return details || '—'; }
    } else {
      d = details;
    }
    const parts: string[] = [];
    if (d['motifRefus'])         parts.push(`Motif : ${d['motifRefus']}`);
    if (d['dateDebutEffective']) parts.push(`Début : ${d['dateDebutEffective']}`);
    if (d['champsModifies'])     parts.push(`Champs : ${(d['champsModifies'] as string[]).join(', ')}`);
    if (d['nom'])                parts.push(`${d['nom']} ${d['prenom'] ?? ''}`);
    if (d['commentaireAdmin'])   parts.push(d['commentaireAdmin']);
    if (!parts.length) {
      const raw = Object.entries(d).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(' • ');
      return raw || '—';
    }
    return parts.join(' • ');
  }
}
