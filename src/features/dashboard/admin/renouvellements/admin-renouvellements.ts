// admin-renouvellements.ts — Liste et traitement des demandes de renouvellement (admin)
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
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
  documents?: { document_filename: string }[];
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
  printingAllDocs = false;
  downloadingAllDocs = false;

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
    this.accederConventionRow(this.selected, mode);
  }

  accederConventionRow(r: Renouvellement, mode: 'voir' | 'telecharger', event?: Event): void {
    event?.stopPropagation();
    const filename = r.stageNouveau?.documents?.[0]?.document_filename || `convention_renouvellement_${r.idrenouvellement}.pdf`;
    this.http.get(`${this.apiUrl}/stages/renouvellements/${r.idrenouvellement}/convention`, { responseType: 'blob' }).subscribe({
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

  async imprimerDocuments(): Promise<void> {
    if (!this.selected || this.printingAllDocs) return;
    const c = this.selected.stageActuel?.candidat;
    const candidatNom = c ? `${c.prenom || ''} ${c.nom || ''}`.trim() : 'Candidat';
    const id = this.selected.idrenouvellement;
    const items: { label: string; url: string }[] = [];
    this.printingAllDocs = true;
    this.cdr.detectChanges();
    try {
      if (this.selected.lettreMotivationRenouvellement_filename) {
        const blob = await firstValueFrom(
          this.http.get(`${this.apiUrl}/stages/renouvellements/${id}/lettre`, { responseType: 'blob' })
        ).catch(() => null);
        if (blob) items.push({ label: 'Lettre de renouvellement', url: window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' })) });
      }
      if (this.selected.stageNouveau?.documents?.length) {
        const blob = await firstValueFrom(
          this.http.get(`${this.apiUrl}/stages/renouvellements/${id}/convention`, { responseType: 'blob' })
        ).catch(() => null);
        if (blob) items.push({ label: 'Convention de renouvellement', url: window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' })) });
      }
    } finally {
      this.printingAllDocs = false;
      this.cdr.detectChanges();
    }
    if (items.length === 0) return;
    const printWindow = window.open('', '_blank', 'width=960,height=700');
    if (!printWindow) { items.forEach(it => window.URL.revokeObjectURL(it.url)); return; }
    const embedsHtml = items.map((it, idx) =>
      `<div class="doc-page"><div class="doc-label">${idx + 1} / ${items.length} — ${it.label}</div><embed src="${it.url}" type="application/pdf" width="100%" height="100%"/></div>`
    ).join('');
    printWindow.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<title>Impression renouvellement — ${candidatNom}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f3f4f6}
.notice{display:flex;align-items:flex-start;gap:10px;background:#fffbeb;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin:16px;font-size:13px;color:#92400e;line-height:1.5}.notice strong{color:#78350f}
.doc-page{background:white;margin:16px;border-radius:8px;box-shadow:0 1px 6px rgba(0,0,0,.12);overflow:hidden;height:calc(100vh - 48px)}
.doc-label{padding:9px 16px;background:#1e293b;color:white;font-size:12px;font-weight:600;letter-spacing:.3px}
embed{display:block;height:calc(100% - 36px);width:100%}
@media print{@page{size:A4 portrait;margin:8mm}body{background:white}.notice{display:none}
.doc-page{margin:0;box-shadow:none;border-radius:0;height:100vh;page-break-after:always;break-after:page}.doc-label{display:none}embed{height:100vh}}</style></head>
<body><div class="notice"><svg width="18" height="18" fill="none" stroke="#d97706" stroke-width="2" viewBox="0 0 24 24" style="flex-shrink:0;margin-top:1px"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
<span><strong>Important :</strong> Sélectionnez <strong>Recto simple</strong> dans la boîte d'impression.</span></div>
${embedsHtml}<script>let n=0;document.querySelectorAll('embed').forEach(e=>e.addEventListener('load',()=>{if(++n>=${items.length})setTimeout(()=>window.print(),500)}));setTimeout(()=>window.print(),4000);<\/script></body></html>`);
    printWindow.document.close();
  }

  async telechargerZip(): Promise<void> {
    if (!this.selected || this.downloadingAllDocs) return;
    const c = this.selected.stageActuel?.candidat;
    const candidatNom = c ? `${c.prenom || ''}_${c.nom || ''}`.replace(/\s+/g, '_') : 'Candidat';
    const id = this.selected.idrenouvellement;
    this.downloadingAllDocs = true;
    this.cdr.detectChanges();
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      if (this.selected.lettreMotivationRenouvellement_filename) {
        const blob = await firstValueFrom(
          this.http.get(`${this.apiUrl}/stages/renouvellements/${id}/lettre`, { responseType: 'blob' })
        ).catch(() => null);
        if (blob) zip.file(this.selected.lettreMotivationRenouvellement_filename, blob as Blob);
      }
      if (this.selected.stageNouveau?.documents?.length) {
        const blob = await firstValueFrom(
          this.http.get(`${this.apiUrl}/stages/renouvellements/${id}/convention`, { responseType: 'blob' })
        ).catch(() => null);
        const fname = this.selected.stageNouveau.documents[0]?.document_filename || `convention_renouvellement_${id}.pdf`;
        if (blob) zip.file(fname, blob as Blob);
      }
      const content: Blob = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url; a.download = `Renouvellement_${candidatNom}.zip`; a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      this.erreur = 'Erreur lors de la génération du ZIP.';
    } finally {
      this.downloadingAllDocs = false;
      this.cdr.detectChanges();
    }
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
