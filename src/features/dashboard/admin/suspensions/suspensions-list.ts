// src/features/dashboard/admin/suspensions/suspensions-list.ts
// Admin — Gestion des demandes de suspension / annulation de stage
import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AdminStageService, DemandeModificationStage } from '../../../../core/services/admin-stage.service';
import { SearchService } from '../../../../core/services/search.service';
import { StatCard } from '../../../../shared/components/stat-card/stat-card';

interface Toast {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

@Component({
  selector: 'app-suspensions-list',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, StatCard],
  templateUrl: './suspensions-list.html',
})
export class SuspensionsList implements OnInit, OnDestroy {

  demandes: DemandeModificationStage[] = [];
  demandesFiltrees: DemandeModificationStage[] = [];
  isLoading = false;

  // Filtres
  searchTerm = '';
  filtreType = '';
  filtreStatut = '';

  // Compteurs
  countEnAttente = 0;
  countSuspendus = 0;   // demandes de SUSPENSION approuvées (stage → SUSPENDU)
  countAnnules = 0;     // demandes d'ANNULATION approuvées (stage → ANNULÉ)
  countRejetee = 0;

  // Modal d'évaluation
  showEvalModal = false;
  selectedDemande: DemandeModificationStage | null = null;
  evalForm = { status: '' as 'APPROUVEE' | 'REJETEE' | '', reponse_drh: '' };
  isSubmitting = false;
  errorEval = '';

  toasts: Toast[] = [];
  private toastId = 0;
  private searchSub?: Subscription;

  constructor(
    private adminStageService: AdminStageService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private searchService: SearchService,
  ) {}

  ngOnInit(): void {
    this.load();
    this.searchSub = this.searchService.term$.pipe(
      debounceTime(200),
      distinctUntilChanged(),
    ).subscribe(term => {
      this.searchTerm = term;
      this.appliquerFiltres();
    });
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  load(): void {
    this.isLoading = true;
    this.adminStageService.getDemandesModification().subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) {
            this.demandes = res.data || [];
            this.calculerCompteurs();
            this.appliquerFiltres();
          }
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      },
    });
  }

  calculerCompteurs(): void {
    this.countEnAttente = this.demandes.filter(d => d.status === 'EN_ATTENTE').length;
    this.countSuspendus = this.demandes.filter(d => d.status === 'APPROUVEE' && d.type === 'SUSPENSION').length;
    this.countAnnules   = this.demandes.filter(d => d.status === 'APPROUVEE' && d.type === 'ANNULATION').length;
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

  ouvrirEval(demande: DemandeModificationStage): void {
    this.selectedDemande = demande;
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
    this.adminStageService.evaluerDemandeModification(this.selectedDemande.id, {
      status: this.evalForm.status as 'APPROUVEE' | 'REJETEE',
      reponse_drh: this.evalForm.reponse_drh?.trim() || undefined,
    }).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) {
            this.fermerEval();
            this.load();
            this.showToast('success', 'Décision enregistrée', 'La demande a été traitée avec succès.');
          }
          this.isSubmitting = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.errorEval = err.error?.message || 'Erreur lors de l\'enregistrement.';
          this.isSubmitting = false;
          this.cdr.detectChanges();
        });
      },
    });
  }

  ouvrirFichier(d: DemandeModificationStage, champ: 'justification' | 'lettre'): void {
    this.adminStageService.downloadDemandeModificationFichier(d.id, champ).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      },
      error: () => this.showToast('error', 'Erreur', 'Impossible d\'ouvrir le fichier.'),
    });
  }

  peutTraiter(d: DemandeModificationStage): boolean {
    return d.status === 'EN_ATTENTE';
  }

  getNomCandidat(d: DemandeModificationStage): string {
    return d.candidat ? `${d.candidat.prenom} ${d.candidat.nom}`.trim() : 'Candidat inconnu';
  }

  getInitiales(d: DemandeModificationStage): string {
    if (!d.candidat) return '?';
    return ((d.candidat.prenom?.[0] || '') + (d.candidat.nom?.[0] || '')).toUpperCase() || '?';
  }

  getTypeLabel(type: string): string {
    return type === 'SUSPENSION' ? 'Suspension' : 'Annulation';
  }

  getTypeClass(type: string): string {
    return type === 'SUSPENSION' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  }

  getTypeBarClass(type: string): string {
    return type === 'SUSPENSION' ? 'bg-amber-500' : 'bg-red-500';
  }

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

  showToast(type: Toast['type'], title: string, message: string): void {
    const toast: Toast = { id: ++this.toastId, type, title, message };
    this.toasts.push(toast);
    this.cdr.detectChanges();
    setTimeout(() => this.ngZone.run(() => this.removeToast(toast.id)), 5000);
  }

  removeToast(id: number): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.cdr.detectChanges();
  }
}
