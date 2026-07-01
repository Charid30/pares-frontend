// src/features/dashboard/agent/modules/suspensions/agent-suspensions.ts
// Agent — Demandes de suspension / annulation de stage (module SUSPENSION_STAGE)
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../../../core/services/auth.service';
import { environment } from '../../../../../environments/environment';
import { StatCard } from '../../../../../shared/components/stat-card/stat-card';

interface DemandeModification {
  id: number;
  stage_idstage: number;
  type: 'SUSPENSION' | 'ANNULATION';
  motif: string;
  dateDebut: string | null;
  justification_filename: string | null;
  lettreManuscrite_filename: string | null;
  status: 'EN_ATTENTE' | 'APPROUVEE' | 'REJETEE';
  reponse_drh: string | null;
  createdDate: string;
  processedBy: string | null;
  stage?: { idstage: number; typeStage?: string; domaineStage?: string };
  candidat?: { idcandidats: number; nom: string; prenom: string; email: string; telephone?: string };
}

@Component({
  selector: 'app-agent-suspensions',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, StatCard],
  templateUrl: './agent-suspensions.html',
})
export class AgentSuspensions implements OnInit {

  demandes: DemandeModification[] = [];
  demandesFiltrees: DemandeModification[] = [];
  loading = false;

  searchTerm = '';
  filtreType = '';
  filtreStatut = '';

  countEnAttente = 0;
  countApprouvee = 0;
  countRejetee = 0;

  showEvalModal = false;
  selectedDemande: DemandeModification | null = null;
  evalForm = { status: '' as 'APPROUVEE' | 'REJETEE' | '', reponse_drh: '' };
  isSubmitting = false;
  errorEval = '';

  toasts: { id: number; title: string; message: string; type: 'success' | 'error' }[] = [];
  private toastId = 0;

  // Permissions
  get peutConsulter(): boolean { return this.authService.hasPermission('SUSPENSION_STAGE', 'CONSULTER'); }
  get peutValider():   boolean { return this.authService.hasPermission('SUSPENSION_STAGE', 'VALIDER'); }
  get peutRejeter():   boolean { return this.authService.hasPermission('SUSPENSION_STAGE', 'REJETER'); }
  get peutTraiterModule(): boolean { return this.peutValider || this.peutRejeter; }

  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    if (!this.peutConsulter && !this.peutTraiterModule) return;
    this.load();
  }

  load(): void {
    this.loading = true;
    this.http.get<any>(`${this.apiUrl}/stages/demandes-modification`).subscribe({
      next: (res) => {
        this.demandes = res.data || [];
        this.calculerCompteurs();
        this.appliquerFiltres();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  calculerCompteurs(): void {
    this.countEnAttente = this.demandes.filter(d => d.status === 'EN_ATTENTE').length;
    this.countApprouvee = this.demandes.filter(d => d.status === 'APPROUVEE').length;
    this.countRejetee   = this.demandes.filter(d => d.status === 'REJETEE').length;
  }

  appliquerFiltres(): void {
    const term = this.searchTerm.toLowerCase();
    this.demandesFiltrees = this.demandes.filter(d => {
      const nom = `${d.candidat?.prenom || ''} ${d.candidat?.nom || ''}`.toLowerCase();
      const matchSearch = !term || nom.includes(term) || (d.motif || '').toLowerCase().includes(term);
      const matchType = !this.filtreType || d.type === this.filtreType;
      const matchStatut = !this.filtreStatut || d.status === this.filtreStatut;
      return matchSearch && matchType && matchStatut;
    });
  }

  effacerFiltres(): void {
    this.searchTerm = '';
    this.filtreType = '';
    this.filtreStatut = '';
    this.appliquerFiltres();
  }

  ouvrirEval(d: DemandeModification): void {
    this.selectedDemande = d;
    this.evalForm = { status: '', reponse_drh: '' };
    this.errorEval = '';
    this.showEvalModal = true;
  }

  fermerEval(): void {
    this.showEvalModal = false;
    this.selectedDemande = null;
    this.errorEval = '';
  }

  evaluer(): void {
    if (!this.selectedDemande || !this.evalForm.status) {
      this.errorEval = 'Veuillez choisir une décision.';
      return;
    }
    this.isSubmitting = true;
    this.errorEval = '';
    this.http.put<any>(`${this.apiUrl}/stages/demandes-modification/${this.selectedDemande.id}/evaluer`, {
      status: this.evalForm.status,
      reponse_drh: this.evalForm.reponse_drh?.trim() || null,
    }).subscribe({
      next: (res) => {
        if (res.success) {
          this.fermerEval();
          this.load();
          this.showToast('Succès', 'La demande a été traitée avec succès.');
        }
        this.isSubmitting = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorEval = err.error?.message || 'Erreur lors de l\'enregistrement.';
        this.isSubmitting = false;
        this.cdr.detectChanges();
      },
    });
  }

  ouvrirFichier(d: DemandeModification, champ: 'justification' | 'lettre'): void {
    this.http.get(`${this.apiUrl}/stages/demandes-modification/${d.id}/${champ}`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      },
      error: () => this.showToast('Erreur', 'Impossible d\'ouvrir le fichier.', 'error'),
    });
  }

  peutTraiter(d: DemandeModification): boolean {
    return d.status === 'EN_ATTENTE' && this.peutTraiterModule;
  }

  getNomCandidat(d: DemandeModification): string {
    return d.candidat ? `${d.candidat.prenom} ${d.candidat.nom}`.trim() : 'Candidat inconnu';
  }

  getInitiales(d: DemandeModification): string {
    if (!d.candidat) return '?';
    return ((d.candidat.prenom?.[0] || '') + (d.candidat.nom?.[0] || '')).toUpperCase() || '?';
  }

  getTypeLabel(type: string): string { return type === 'SUSPENSION' ? 'Suspension' : 'Annulation'; }
  getTypeClass(type: string): string { return type === 'SUSPENSION' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'; }
  getTypeBarClass(type: string): string { return type === 'SUSPENSION' ? 'bg-amber-500' : 'bg-red-500'; }

  getStatutLabel(s: string): string {
    const l: Record<string, string> = { EN_ATTENTE: 'En attente', APPROUVEE: 'Approuvée', REJETEE: 'Rejetée' };
    return l[s] || s;
  }

  getStatutClass(s: string): string {
    const c: Record<string, string> = {
      EN_ATTENTE: 'bg-blue-100 text-blue-700',
      APPROUVEE:  'bg-emerald-100 text-emerald-700',
      REJETEE:    'bg-red-100 text-red-700',
    };
    return c[s] || 'bg-gray-100 text-gray-600';
  }

  showToast(title: string, message: string, type: 'success' | 'error' = 'success'): void {
    const id = ++this.toastId;
    this.toasts.push({ id, title, message, type });
    setTimeout(() => this.dismissToast(id), 4000);
  }

  dismissToast(id: number): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.cdr.detectChanges();
  }
}
