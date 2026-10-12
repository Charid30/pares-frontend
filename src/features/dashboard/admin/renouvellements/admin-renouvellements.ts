// admin-renouvellements.ts — Liste et traitement des demandes de renouvellement (admin)
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface Candidat {
  idcandidats: number;
  nom: string;
  prenom: string;
  email: string;
}

interface StageActuel {
  idstage: number;
  domaineStage?: string;
  typeStage?: string;
  dateFinEffective?: string;
  candidat?: Candidat;
}

interface StageNouveau {
  idstage: number;
  statusStage: string;
  dateDebutEffective?: string;
  dateFinEffective?: string;
}

type StatusRenouvellement = 'EN_ATTENTE' | 'PROGRAMMATION_EN_COURS' | 'ACCEPTE' | 'REJETE' | 'EN_COURS' | 'EXPIRE' | 'TERMINE' | 'RAPPORT_SOUMIS';

export interface Renouvellement {
  idrenouvellement: number;
  statusRenouvellement: StatusRenouvellement;
  dureeDemandee: number;
  dateRenouvellement: string;
  lettreMotivationRenouvellement_filename?: string;
  conventionStageEnCours_filename?: string;
  resoumis?: number;
  motifRefus?: string;
  createdBy?: string;
  lastModifiedBy?: string;
  lastModifiedDate?: string;
  stageActuel?: StageActuel;
  stageNouveau?: StageNouveau;
}

interface PaginatedResult {
  rows: Renouvellement[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: { enAttente: number; enTraitement: number; accepte: number; enCours: number; expire: number; termine: number; rejete: number };
}

@Component({
  selector: 'app-admin-renouvellements',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-renouvellements.html',
})
export class AdminRenouvellements implements OnInit {

  private readonly apiUrl = environment.apiUrl;

  renouvellements: Renouvellement[] = [];
  renouvellementsFiltres: Renouvellement[] = [];
  isLoading = false;
  filtreStatut = '';
  search = '';
  dateDebut = '';
  dateFin = '';
  successMessage = '';
  erreur = '';
  // Pagination
  page = 1;
  limit = 15;
  total = 0;
  totalPages = 0;
  stats: PaginatedResult['stats'] = { enAttente: 0, enTraitement: 0, accepte: 0, enCours: 0, expire: 0, termine: 0, rejete: 0 };

  // Modal détail
  showModal = false;
  selected: Renouvellement | null = null;

  // Modal approbation (EN_ATTENTE → PROGRAMMATION_EN_COURS)
  showApprobationModal = false;
  soumissionApprobation = false;

  // Modal réouverture (REJETE → EN_ATTENTE, admin seulement)
  showRouvrirModal = false;
  soumissionRouvrir = false;

  // Modal décision
  showDecisionModal = false;
  decisionType: 'ACCEPTE' | 'REJETE' | null = null;
  motifRefus = '';
  conventionFile: File | null = null;
  lettreNonConforme = false;
  conventionNonConforme = false;
  dateDebutEffective = '';
  dateFinEffective = '';
  soumission = false;

  // Modal convention (remplacer/joindre après acceptation)
  showConventionModal = false;
  conventionRemplacement: File | null = null;
  soumissionConvention = false;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.isLoading = true;
    this.erreur = '';
    const params: Record<string, string> = {
      page:  String(this.page),
      limit: String(this.limit),
    };
    if (this.filtreStatut) params['statusRenouvellement'] = this.filtreStatut;
    if (this.search.trim()) params['search'] = this.search.trim();
    if (this.dateDebut) params['dateDebut'] = this.dateDebut;
    if (this.dateFin)   params['dateFin']   = this.dateFin;

    this.http.get<{ success: boolean; data: PaginatedResult }>(`${this.apiUrl}/stages/renouvellements`, { params }).subscribe({
      next: (res) => {
        const data = res.data;
        this.renouvellements = data.rows ?? [];
        this.renouvellementsFiltres = data.rows ?? [];
        this.total = data.total;
        this.totalPages = data.totalPages;
        this.stats = data.stats;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.erreur = 'Impossible de charger les demandes de renouvellement.';
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  onFiltreChange(): void {
    this.page = 1;
    this.charger();
  }

  allerPage(p: number): void {
    if (p < 1 || p > this.totalPages) return;
    this.page = p;
    this.charger();
  }

  effacerFiltres(): void {
    this.filtreStatut = '';
    this.search = '';
    this.dateDebut = '';
    this.dateFin = '';
    this.page = 1;
    this.charger();
  }

  voirDetail(r: Renouvellement): void {
    this.selected = r;
    this.showModal = true;
    this.erreur = '';
    this.successMessage = '';
  }

  fermerModal(): void {
    this.showModal = false;
    this.selected = null;
  }

  // ── Actions directes depuis la liste ────────────────────────────────────────

  approuverDirect(r: Renouvellement): void {
    this.selected = r;
    this.showModal = false;
    this.showApprobationModal = true;
  }

  accepterDirect(r: Renouvellement): void {
    this.selected = r;
    this.showModal = false;
    this.ouvrirDecision('ACCEPTE');
  }

  rejeterDirect(r: Renouvellement): void {
    this.selected = r;
    this.showModal = false;
    this.ouvrirDecision('REJETE');
  }

  rouvrirDirect(r: Renouvellement): void {
    this.selected = r;
    this.showModal = false;
    this.ouvrirRouvrir();
  }

  // ── Approbation (EN_ATTENTE → PROGRAMMATION_EN_COURS) ────────────────────────

  ouvrirApprobation(): void {
    this.showApprobationModal = true;
  }

  fermerApprobation(): void {
    this.showApprobationModal = false;
  }

  confirmerApprobation(): void {
    if (!this.selected) return;
    this.soumissionApprobation = true;
    this.http.put<{ success: boolean; data: any }>(
      `${this.apiUrl}/stages/renouvellements/${this.selected.idrenouvellement}/approuver`,
      {}
    ).subscribe({
      next: () => {
        this.soumissionApprobation = false;
        this.showApprobationModal = false;
        this.showModal = false;
        this.successMessage = 'Renouvellement approuvé — en attente de validation.';
        this.charger();
        setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 5000);
      },
      error: (err) => {
        this.soumissionApprobation = false;
        this.erreur = err.error?.message || 'Une erreur est survenue.';
        this.cdr.detectChanges();
      },
    });
  }

  // ── Réouverture directe (REJETE → EN_ATTENTE, admin) ────────────────────────

  ouvrirRouvrir(): void {
    this.showRouvrirModal = true;
  }

  fermerRouvrir(): void {
    this.showRouvrirModal = false;
  }

  confirmerRouvrir(): void {
    if (!this.selected) return;
    this.soumissionRouvrir = true;
    this.http.put<{ success: boolean; data: any }>(
      `${this.apiUrl}/stages/renouvellements/${this.selected.idrenouvellement}/rouvrir`,
      {}
    ).subscribe({
      next: () => {
        this.soumissionRouvrir = false;
        this.showRouvrirModal = false;
        this.showModal = false;
        this.successMessage = 'Renouvellement rouvert — il peut maintenant être traité.';
        this.charger();
        setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 5000);
      },
      error: (err) => {
        this.soumissionRouvrir = false;
        this.erreur = err.error?.message || 'Une erreur est survenue.';
        this.cdr.detectChanges();
      },
    });
  }

  annulerApprobation(): void {
    if (!this.selected || this.selected.statusRenouvellement !== 'PROGRAMMATION_EN_COURS') return;
    if (!confirm('Annuler l\'approbation ? Le renouvellement repassera en "En attente".')) return;
    this.http.put<any>(`${this.apiUrl}/stages/renouvellements/${this.selected.idrenouvellement}/annuler-approbation`, {}).subscribe({
      next: () => {
        this.showModal = false;
        this.successMessage = 'Approbation annulée — le renouvellement est de nouveau en attente.';
        this.charger();
        setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 5000);
      },
      error: (err) => {
        this.erreur = err.error?.message || 'Erreur lors de l\'annulation.';
        this.cdr.detectChanges();
      },
    });
  }

  expirerRenouvellement(): void {
    if (!this.selected) return;
    if (!confirm('Marquer ce renouvellement comme EXPIRÉ ? Le nouveau stage sera également marqué expiré.')) return;
    this.http.put<any>(`${this.apiUrl}/stages/renouvellements/${this.selected.idrenouvellement}/expirer`, {}).subscribe({
      next: () => {
        this.showModal = false;
        this.successMessage = 'Renouvellement marqué expiré.';
        this.charger();
        setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 4000);
      },
      error: (err) => {
        this.erreur = err.error?.message || 'Erreur lors de l\'expiration.';
        this.cdr.detectChanges();
      },
    });
  }

  supprimerRenouvellement(): void {
    if (!this.selected) return;
    if (!confirm(`Supprimer définitivement cette demande de renouvellement ? Cette action est irréversible.`)) return;
    this.http.delete<any>(`${this.apiUrl}/stages/renouvellements/${this.selected.idrenouvellement}`).subscribe({
      next: () => {
        this.showModal = false;
        this.successMessage = 'Demande de renouvellement supprimée.';
        this.charger();
        setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 5000);
      },
      error: (err) => {
        this.erreur = err.error?.message || 'Erreur lors de la suppression.';
        this.cdr.detectChanges();
      },
    });
  }

  ouvrirDecision(type: 'ACCEPTE' | 'REJETE'): void {
    this.decisionType = type;
    this.motifRefus = '';
    this.conventionFile = null;
    this.lettreNonConforme = false;
    this.conventionNonConforme = false;
    this.dateDebutEffective = '';
    this.dateFinEffective = '';
    this.showDecisionModal = true;
  }

  fermerDecision(): void {
    this.showDecisionModal = false;
    this.decisionType = null;
    this.motifRefus = '';
    this.lettreNonConforme = false;
    this.conventionNonConforme = false;
    this.conventionFile = null;
    this.dateDebutEffective = '';
    this.dateFinEffective = '';
  }

  onConventionChange(event: Event): void {
    this.conventionFile = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  confirmerDecision(): void {
    if (!this.selected || !this.decisionType) return;
    if (this.decisionType === 'REJETE' && !this.motifRefus.trim()) return;
    const conventionDejaLiee = this.selected?.stageNouveau?.statusStage === 'EN_COURS';
    if (this.decisionType === 'ACCEPTE' && !this.conventionFile && !conventionDejaLiee) return;
    this.soumission = true;
    const body: Record<string, any> = { statusRenouvellement: this.decisionType };
    if (this.decisionType === 'REJETE') {
      body['motifRefus'] = this.motifRefus.trim();
      body['lettreNonConforme'] = this.lettreNonConforme;
      body['conventionNonConforme'] = this.conventionNonConforme;
    }
    if (this.decisionType === 'ACCEPTE') {
      if (this.dateDebutEffective) body['dateDebutEffective'] = this.dateDebutEffective;
      if (this.dateFinEffective) body['dateFinEffective'] = this.dateFinEffective;
    }

    this.http.put<{ success: boolean; data: any }>(
      `${this.apiUrl}/stages/renouvellements/${this.selected.idrenouvellement}/evaluer`,
      body
    ).subscribe({
      next: (res) => {
        if (this.decisionType === 'ACCEPTE' && this.conventionFile) {
          const nouveauStageId = res.data?.stageNouveau?.idstage ?? res.data?.stage_nouveau_idstage;
          if (nouveauStageId) {
            const fd = new FormData();
            fd.append('stage_idstage', String(nouveauStageId));
            fd.append('typeDocument', 'CONVENTION');
            fd.append('document', this.conventionFile, this.conventionFile.name);
            this.http.post(`${this.apiUrl}/stages/documents`, fd).subscribe({
              next: () => {
                this.soumission = false;
                this.showDecisionModal = false;
                this.showModal = false;
                this.successMessage = 'Renouvellement accepté et convention uploadée avec succès.';
                this.charger();
                setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 4000);
              },
              error: () => {
                this.soumission = false;
                this.showDecisionModal = false;
                this.showModal = false;
                this.successMessage = 'Renouvellement accepté. L\'upload de la convention a échoué — réessayez ultérieurement.';
                this.charger();
                setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 6000);
              },
            });
          } else {
            this.soumission = false;
            this.showDecisionModal = false;
            this.showModal = false;
            this.successMessage = 'Renouvellement accepté avec succès.';
            this.charger();
            setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 4000);
          }
        } else {
          this.soumission = false;
          this.showDecisionModal = false;
          this.showModal = false;
          this.successMessage = 'Renouvellement rejeté.';
          this.charger();
          setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 4000);
        }
      },
      error: (err) => {
        this.soumission = false;
        this.erreur = err.error?.message || 'Une erreur est survenue.';
        this.cdr.detectChanges();
      },
    });
  }

  ouvrirConventionModal(): void {
    this.conventionRemplacement = null;
    this.showConventionModal = true;
  }

  fermerConventionModal(): void {
    this.showConventionModal = false;
    this.conventionRemplacement = null;
  }

  onConventionRemplacementChange(event: Event): void {
    this.conventionRemplacement = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  confirmerConvention(): void {
    if (!this.selected || !this.conventionRemplacement) return;
    const stageId = this.selected.stageNouveau?.idstage;
    if (!stageId) {
      this.erreur = 'Impossible de trouver le nouveau stage associé.';
      this.cdr.detectChanges();
      return;
    }
    this.soumissionConvention = true;
    const fd = new FormData();
    fd.append('stage_idstage', String(stageId));
    fd.append('typeDocument', 'CONVENTION');
    fd.append('document', this.conventionRemplacement, this.conventionRemplacement.name);
    this.http.post(`${this.apiUrl}/stages/documents`, fd).subscribe({
      next: () => {
        this.soumissionConvention = false;
        this.showConventionModal = false;
        this.successMessage = 'Convention uploadée avec succès.';
        this.charger();
        setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 4000);
      },
      error: (err) => {
        this.soumissionConvention = false;
        this.erreur = err.error?.message || 'Erreur lors de l\'upload de la convention.';
        this.cdr.detectChanges();
      },
    });
  }

  accederLettre(mode: 'voir' | 'telecharger'): void {
    if (!this.selected) return;
    const filename = this.selected.lettreMotivationRenouvellement_filename || `lettre_${this.selected.idrenouvellement}.pdf`;
    this.http.get(`${this.apiUrl}/stages/renouvellements/${this.selected.idrenouvellement}/lettre`, { responseType: 'blob' }).subscribe({
      next: (blob) => this.ouvrirOuTelechargerBlob(blob, filename, mode),
      error: () => { this.erreur = 'Impossible de charger la lettre.'; this.cdr.detectChanges(); },
    });
  }

  accederConvention(mode: 'voir' | 'telecharger'): void {
    if (!this.selected) return;
    const filename = this.selected.conventionStageEnCours_filename || `convention_${this.selected.idrenouvellement}.pdf`;
    this.http.get(`${this.apiUrl}/stages/renouvellements/${this.selected.idrenouvellement}/convention`, { responseType: 'blob' }).subscribe({
      next: (blob) => this.ouvrirOuTelechargerBlob(blob, filename, mode),
      error: () => { this.erreur = 'Impossible de charger la convention.'; this.cdr.detectChanges(); },
    });
  }

  private ouvrirOuTelechargerBlob(blob: Blob, filename: string, mode: 'voir' | 'telecharger'): void {
    const url = URL.createObjectURL(blob);
    if (mode === 'voir') {
      window.open(url, '_blank');
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  getInitiales(r: Renouvellement): string {
    const c = r.stageActuel?.candidat;
    if (!c) return '?';
    return ((c.prenom?.[0] || '') + (c.nom?.[0] || '')).toUpperCase();
  }

  getStatutBadge(statut: string): string {
    switch (statut) {
      case 'EN_ATTENTE':             return 'bg-amber-100 text-amber-700';
      case 'PROGRAMMATION_EN_COURS': return 'bg-blue-100 text-blue-700';
      case 'ACCEPTE':                return 'bg-green-100 text-green-700';
      case 'REJETE':                 return 'bg-red-100 text-red-700';
      case 'EN_COURS':               return 'bg-indigo-100 text-indigo-700';
      case 'EXPIRE':                 return 'bg-orange-100 text-orange-700';
      case 'TERMINE':                return 'bg-gray-200 text-gray-600';
      case 'RAPPORT_SOUMIS':         return 'bg-purple-100 text-purple-700';
      default:                       return 'bg-gray-100 text-gray-500';
    }
  }

  getStatutLabel(statut: string): string {
    switch (statut) {
      case 'EN_ATTENTE':             return 'En attente';
      case 'PROGRAMMATION_EN_COURS': return 'Programmation en cours';
      case 'ACCEPTE':                return 'Accepté';
      case 'REJETE':                 return 'Rejeté';
      case 'EN_COURS':               return 'En cours';
      case 'EXPIRE':                 return 'Expiré';
      case 'TERMINE':                return 'Terminé';
      case 'RAPPORT_SOUMIS':         return 'Rapport soumis';
      default:                       return statut;
    }
  }

  exporterCSV(): void {
    const rows = this.renouvellementsFiltres;
    if (!rows.length) return;
    const header = ['ID', 'Candidat', 'Email', 'Domaine', 'Durée (mois)', 'Date demande', 'Statut', 'Convention'];
    const lines = rows.map(r => [
      r.idrenouvellement,
      `${r.stageActuel?.candidat?.prenom || ''} ${r.stageActuel?.candidat?.nom || ''}`.trim(),
      r.stageActuel?.candidat?.email || '',
      r.stageActuel?.domaineStage || '',
      r.dureeDemandee,
      r.dateRenouvellement ? new Date(r.dateRenouvellement).toLocaleDateString('fr-FR') : '',
      this.getStatutLabel(r.statusRenouvellement),
      r.conventionStageEnCours_filename ? 'Jointe' : 'Manquante',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = '﻿' + [header.join(','), ...lines].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `renouvellements_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  formatDate(d?: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR');
  }
}
