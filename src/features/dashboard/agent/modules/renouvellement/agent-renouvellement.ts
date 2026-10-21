// agent-renouvellement.ts — Liste et traitement des demandes de renouvellement
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../../core/services/auth.service';

interface Candidat {
  idcandidats: number;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
}

interface StageActuel {
  idstage: number;
  domaineStage?: string;
  typeStage?: string;
  dateFinEffective?: string;
  candidat?: Candidat;
  /** Convention de la demande de stage (celle qui a validé le stage en cours) */
  documents?: { iddocument: number; document_filename: string }[];
  direction?: { iddirection: number; nom: string; accronyme?: string };
}

interface StageNouveau {
  idstage: number;
  statusStage: string;
  dateDebutEffective?: string;
  dateFinEffective?: string;
  dureeStage?: number;
  documents?: { document_filename: string }[];
}

type StatusRenouvellement = 'EN_ATTENTE' | 'EN_COURS_DE_TRAITEMENT' | 'PROGRAMMATION_EN_COURS' | 'ACCEPTE' | 'REJETE' | 'EN_COURS' | 'EXPIRE' | 'TERMINE' | 'RAPPORT_SOUMIS';

interface Renouvellement {
  idrenouvellement: number;
  statusRenouvellement: StatusRenouvellement;
  dureeDemandee: number;
  dateRenouvellement: string;
  lettreMotivationRenouvellement_filename?: string;
  peutAgir?: boolean;
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
  stats: { total: number; enAttente: number; enTraitement: number; approuve: number; accepte: number; enCours: number; expire: number; termine: number; rejete: number };
}

@Component({
  selector: 'app-agent-renouvellement',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agent-renouvellement.html',
})
export class AgentRenouvellement implements OnInit {

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
  stats: PaginatedResult['stats'] = { total: 0, enAttente: 0, enTraitement: 0, approuve: 0, accepte: 0, enCours: 0, expire: 0, termine: 0, rejete: 0 };

  // Modal détail
  showModal = false;
  selected: Renouvellement | null = null;

  // Modal approbation (agent)
  showApprobationModal = false;
  soumissionApprobation = false;

  // Modal décision (valider/rejeter selon permissions)
  showDecisionModal = false;
  decisionType: 'ACCEPTE' | 'REJETE' | null = null;
  motifRefus = '';
  conventionFile: File | null = null;
  soumission = false;
  // Acceptation : date de début (optionnelle) et durée accordée (par défaut la durée demandée)
  dateDebutEffective = '';
  dureeAccordee: number | null = null;
  lettreNonConforme = false;

  // Modal convention (remplacer/joindre après acceptation)
  showConventionModal = false;
  conventionRemplacement: File | null = null;
  soumissionConvention = false;
  printingAllDocs = false;
  downloadingAllDocs = false;

  // Permissions
  peutApprouver = false;
  peutValider = false;
  peutRejeter = false;
  peutCreerConvention = false;
  peutModifier = false;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.peutApprouver       = this.authService.hasPermission('STAGE', 'APPROUVER');
    this.peutValider         = this.authService.hasPermission('STAGE', 'VALIDER');
    this.peutRejeter         = this.authService.hasPermission('STAGE', 'REJETER');
    this.peutCreerConvention = this.authService.hasPermission('STAGE', 'CREER');
    this.peutModifier        = this.authService.hasPermission('STAGE', 'MODIFIER');
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
        // Modal ouvert : rafraîchir le renouvellement affiché avec les données à jour
        if (this.showModal && this.selected) {
          const id = this.selected.idrenouvellement;
          this.selected = this.renouvellements.find(r => r.idrenouvellement === id) ?? this.selected;
        }
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
    this.page = 1;
    this.search = '';
    this.dateDebut = '';
    this.dateFin = '';
    this.charger();
  }

  // ── Modal détail ─────────────────────────────────────────────────────────────

  voirDetail(r: Renouvellement): void {
    this.selected = r;
    this.showModal = true;
    this.editionDates = false;
    this.erreur = '';
    this.successMessage = '';
  }

  // ── Modification des dates du nouveau stage (permission MODIFIER, dans sa direction) ──
  editionDates = false;
  nouvelleDateDebut = '';
  nouvelleDuree: number | null = null;
  savingDates = false;

  peutModifierDates(r: Renouvellement): boolean {
    return this.peutModifier && r.peutAgir !== false
      && ['ACCEPTE', 'EN_COURS'].includes(r.statusRenouvellement) && !!r.stageNouveau?.idstage;
  }

  ouvrirEditionDates(): void {
    if (!this.selected?.stageNouveau) return;
    this.nouvelleDateDebut = (this.selected.stageNouveau.dateDebutEffective || '').slice(0, 10);
    this.nouvelleDuree = this.selected.stageNouveau.dureeStage ?? this.selected.dureeDemandee;
    this.editionDates = true;
  }

  enregistrerDates(): void {
    const stageId = this.selected?.stageNouveau?.idstage;
    if (!stageId || !this.nouvelleDateDebut || !this.nouvelleDuree) return;
    this.savingDates = true;
    this.erreur = '';
    // Même route que la modification des dates d'un stage (fin recalculée, statut ajusté)
    this.http.put<{ success: boolean; data: any }>(`${this.apiUrl}/stages/${stageId}`, {
      dateDebutEffective: this.nouvelleDateDebut,
      dureeStage: this.nouvelleDuree,
    }).subscribe({
      next: () => {
        this.savingDates = false;
        this.editionDates = false;
        this.successMessage = 'Dates du renouvellement mises à jour.';
        this.charger();
        setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 4000);
      },
      error: (err) => {
        this.savingDates = false;
        this.erreur = err.error?.message || 'Impossible de modifier les dates.';
        this.cdr.detectChanges();
      },
    });
  }

  /** Début prévu du renouvellement : lendemain de la fin du stage actuel (même règle que le backend) */
  getDebutPrevu(r: Renouvellement): string | undefined {
    const fin = r.stageActuel?.dateFinEffective;
    if (!fin) return undefined;
    const d = new Date(fin);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  /** Ouvre un fichier sélectionné (avant envoi) pour vérification */
  voirFichierLocal(file: File): void {
    const url = URL.createObjectURL(file);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  fermerModal(): void {
    this.showModal = false;
    this.selected = null;
  }

  // ── Actions directes depuis la liste ────────────────────────────────────────

  approuverDirect(r: Renouvellement): void {
    this.selected = r;
    this.showModal = false;
    this.ouvrirApprobation();
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

  // ── Approbation (agent) ──────────────────────────────────────────────────────

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
        this.successMessage = 'Renouvellement approuvé — en attente de validation par l\'administration.';
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

  // ── Valider / Rejeter (selon permissions) ────────────────────────────────────

  ouvrirDecision(type: 'ACCEPTE' | 'REJETE'): void {
    this.decisionType = type;
    this.motifRefus = '';
    this.conventionFile = null;
    this.lettreNonConforme = false;
    this.dateDebutEffective = '';
    this.dureeAccordee = this.selected?.dureeDemandee ?? null;
    this.erreur = '';
    this.showDecisionModal = true;
  }

  fermerDecision(): void {
    this.showDecisionModal = false;
    this.decisionType = null;
    this.motifRefus = '';
    this.lettreNonConforme = false;
    this.conventionFile = null;
    this.dateDebutEffective = '';
    this.dureeAccordee = null;
  }

  /** Durée accordée : entier de 1 à 12 mois (même règle que l'acceptation d'un stage) */
  get dureeValide(): boolean {
    const d = Number(this.dureeAccordee);
    return Number.isInteger(d) && d >= 1 && d <= 12;
  }

  onConventionChange(event: Event): void {
    this.conventionFile = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  /** Le nouveau stage a déjà une convention (jointe auparavant) : elle sera réutilisée */
  get conventionDejaJointe(): boolean {
    return !!this.selected?.stageNouveau?.documents?.length
      || this.selected?.stageNouveau?.statusStage === 'EN_COURS';
  }

  confirmerDecision(): void {
    if (!this.selected || !this.decisionType) return;
    if (this.decisionType === 'REJETE' && !this.motifRefus.trim()) return;
    if (this.decisionType === 'ACCEPTE' && !this.conventionFile && !this.conventionDejaJointe) return;
    if (this.decisionType === 'ACCEPTE' && !this.dureeValide) return;
    this.soumission = true;
    this.erreur = '';

    // Acceptation : la convention part dans le même appel (champ conventionStage), comme pour
    // une demande de stage — le renouvellement n'est jamais accepté sans sa convention.
    let body: FormData | Record<string, any>;
    if (this.decisionType === 'ACCEPTE') {
      const fd = new FormData();
      fd.append('statusRenouvellement', 'ACCEPTE');
      fd.append('dureeAccordee', String(this.dureeAccordee));
      if (this.dateDebutEffective) fd.append('dateDebutEffective', this.dateDebutEffective);
      if (this.conventionFile) fd.append('conventionStage', this.conventionFile, this.conventionFile.name);
      body = fd;
    } else {
      body = {
        statusRenouvellement: 'REJETE',
        motifRefus: this.motifRefus.trim(),
        lettreNonConforme: this.lettreNonConforme,
      };
    }

    this.http.put<{ success: boolean; data: any }>(
      `${this.apiUrl}/stages/renouvellements/${this.selected.idrenouvellement}/evaluer`,
      body
    ).subscribe({
      next: () => {
        this.soumission = false;
        this.showDecisionModal = false;
        this.showModal = false;
        this.successMessage = this.decisionType === 'ACCEPTE'
          ? 'Renouvellement accepté, convention jointe.'
          : 'Renouvellement rejeté.';
        this.charger();
        setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 4000);
      },
      error: (err) => {
        // Le modal reste ouvert : l'erreur s'y affiche, rien n'a été accepté
        this.soumission = false;
        this.erreur = err.error?.message || 'Une erreur est survenue.';
        this.cdr.detectChanges();
      },
    });
  }

  // ── Convention (post-acceptation) ────────────────────────────────────────────

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
    // Convention déjà jointe → remplacement (même route que pour une demande de stage) ;
    // sinon → ajout d'un document CONVENTION sur le nouveau stage.
    const remplacement = !!this.selected.stageNouveau?.documents?.length;
    const fd = new FormData();
    let requete$;
    if (remplacement) {
      fd.append('conventionStage', this.conventionRemplacement, this.conventionRemplacement.name);
      requete$ = this.http.put(`${this.apiUrl}/stages/${stageId}/convention`, fd);
    } else {
      fd.append('stage_idstage', String(stageId));
      fd.append('typeDocument', 'CONVENTION');
      // Date d'émission requise par l'API (createDocumentStageSchema)
      fd.append('dateEmission', new Date().toISOString().slice(0, 10));
      fd.append('document', this.conventionRemplacement, this.conventionRemplacement.name);
      requete$ = this.http.post(`${this.apiUrl}/stages/documents`, fd);
    }
    requete$.subscribe({
      next: () => {
        this.soumissionConvention = false;
        this.showConventionModal = false;
        this.successMessage = remplacement ? 'Convention remplacée avec succès.' : 'Convention jointe avec succès.';
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

  // ── Documents ────────────────────────────────────────────────────────────────

  accederLettre(mode: 'voir' | 'telecharger'): void {
    if (!this.selected) return;
    const filename = this.selected.lettreMotivationRenouvellement_filename || `lettre_${this.selected.idrenouvellement}.pdf`;
    this.http.get(`${this.apiUrl}/stages/renouvellements/${this.selected.idrenouvellement}/lettre`, { responseType: 'blob' }).subscribe({
      next: (blob) => this.ouvrirOuTelechargerBlob(blob, filename, mode),
      error: () => { this.erreur = 'Lettre de renouvellement introuvable sur le serveur (fichier absent).'; this.cdr.detectChanges(); },
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

  /** Convention de la demande de stage à laquelle le renouvellement est rattaché */
  accederConventionDemande(mode: 'voir' | 'telecharger'): void {
    if (!this.selected) return;
    const filename = this.selected.stageActuel?.documents?.[0]?.document_filename || `convention_stage_${this.selected.stageActuel?.idstage}.pdf`;
    this.http.get(`${this.apiUrl}/stages/renouvellements/${this.selected.idrenouvellement}/convention-demande`, { responseType: 'blob' }).subscribe({
      next: (blob) => this.ouvrirOuTelechargerBlob(blob, filename, mode),
      error: () => { this.erreur = 'Impossible de charger la convention de la demande de stage.'; this.cdr.detectChanges(); },
    });
  }

  /** Statuts où un refus est encore possible (avant décision) */
  estAvantDecision(r: Renouvellement): boolean {
    return ['EN_ATTENTE', 'EN_COURS_DE_TRAITEMENT', 'PROGRAMMATION_EN_COURS'].includes(r.statusRenouvellement);
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

  // ── Helpers ──────────────────────────────────────────────────────────────────

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
      if (this.selected.stageActuel?.documents?.length) {
        const blob = await firstValueFrom(
          this.http.get(`${this.apiUrl}/stages/renouvellements/${id}/convention-demande`, { responseType: 'blob' })
        ).catch(() => null);
        if (blob) items.push({ label: 'Convention de la demande de stage', url: window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' })) });
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
      if (this.selected.stageActuel?.documents?.length) {
        const blob = await firstValueFrom(
          this.http.get(`${this.apiUrl}/stages/renouvellements/${id}/convention-demande`, { responseType: 'blob' })
        ).catch(() => null);
        const fname = this.selected.stageActuel.documents[0]?.document_filename || `convention_stage_${this.selected.stageActuel.idstage}.pdf`;
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
      case 'EN_COURS_DE_TRAITEMENT': return 'bg-orange-100 text-orange-700';
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
      case 'EN_COURS_DE_TRAITEMENT': return 'En traitement';
      case 'PROGRAMMATION_EN_COURS': return 'Approuvé';
      case 'ACCEPTE':                return 'Accepté';
      case 'REJETE':                 return 'Rejeté';
      case 'EN_COURS':               return 'En cours';
      case 'EXPIRE':                 return 'Expiré';
      case 'TERMINE':                return 'Terminé';
      case 'RAPPORT_SOUMIS':         return 'Rapport soumis';
      default:                       return statut;
    }
  }
}
