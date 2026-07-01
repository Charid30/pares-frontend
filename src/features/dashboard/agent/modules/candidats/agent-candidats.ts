import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../../../core/services/auth.service';
import { environment } from '../../../../../environments/environment';
import { StatCard } from '../../../../../shared/components/stat-card/stat-card';

interface Candidat {
  idcandidats: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  nip?: string;
  ifu?: string;
  createdDate: string;
  stagesCount?: number;
  candidaturesCount?: number;
  user?: { idusers: number; username: string };
}

interface CandidatDetail extends Candidat {
  stages: any[];
  candidatures: any[];
  stats: {
    totalStages: number;
    stagesEnCours: number;
    stagesTermines: number;
    totalCandidatures: number;
    candidaturesRetenues: number;
  };
}

interface Stats {
  total: number;
  thisMonth: number;
  withStages: number;
  withCandidatures: number;
}

@Component({
  selector: 'app-agent-candidats',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, ReactiveFormsModule, StatCard],
  templateUrl: './agent-candidats.html',
})
export class AgentCandidats implements OnInit {

  // ── Données ─────────────────────────────────────────────────
  candidats: Candidat[] = [];
  stats: Stats = { total: 0, thisMonth: 0, withStages: 0, withCandidatures: 0 };

  // ── État ─────────────────────────────────────────────────────
  isLoading = false;
  isLoadingDetail = false;
  errorMessage = '';
  successMessage = '';

  // ── Filtres / Pagination ──────────────────────────────────────
  search = '';
  page = 1;
  limit = 12;
  total = 0;
  totalPages = 1;

  // ── Modals ───────────────────────────────────────────────────
  candidatDetail: CandidatDetail | null = null;
  showCreateModal = false;
  showEditModal = false;
  showDeleteModal = false;
  candidatAEditer: Candidat | null = null;
  candidatASupprimer: Candidat | null = null;
  tempPassword = '';       // Mot de passe temporaire après création
  isSaving = false;
  isDeleting = false;

  // ── Formulaires ───────────────────────────────────────────────
  createForm: FormGroup;
  editForm: FormGroup;

  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.createForm = this.fb.group({
      nom: ['', Validators.required],
      prenom: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      telephone: ['', Validators.required],
      username: ['']
    });

    this.editForm = this.fb.group({
      nom: ['', Validators.required],
      prenom: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      telephone: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.chargerStats();
    this.chargerCandidats();
  }

  // ── Permissions ───────────────────────────────────────────────
  get peutConsulter(): boolean { return this.authService.hasPermission('CANDIDATS', 'CONSULTER'); }
  get peutCreer(): boolean     { return this.authService.hasPermission('CANDIDATS', 'CREER'); }
  get peutModifier(): boolean  { return this.authService.hasPermission('CANDIDATS', 'MODIFIER'); }
  get peutSupprimer(): boolean { return this.authService.hasPermission('CANDIDATS', 'SUPPRIMER'); }

  // ── Chargement ────────────────────────────────────────────────
  chargerStats(): void {
    this.http.get<any>(`${this.apiUrl}/admin/candidats/stats`).subscribe({
      next: (res) => {
        if (res.success) this.stats = res.data;
        this.cdr.detectChanges();
      },
      error: () => this.cdr.detectChanges()
    });
  }

  chargerCandidats(): void {
    this.isLoading = true;
    this.errorMessage = '';
    const params = new URLSearchParams({
      page: String(this.page),
      limit: String(this.limit),
      ...(this.search ? { search: this.search } : {})
    });

    this.http.get<any>(`${this.apiUrl}/admin/candidats?${params}`).subscribe({
      next: (res) => {
        if (res.success) {
          this.candidats = res.data?.items || [];
          this.total = res.data?.total || 0;
          this.totalPages = res.data?.totalPages || 1;
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Erreur lors du chargement des candidats';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onSearch(): void {
    this.page = 1;
    this.chargerCandidats();
  }

  changerPage(p: number): void {
    if (p < 1 || p > this.totalPages) return;
    this.page = p;
    this.chargerCandidats();
  }

  get visiblePages(): number[] {
    const pages: number[] = [];
    const start = Math.max(1, this.page - 2);
    const end = Math.min(this.totalPages, this.page + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  // ── Détail ────────────────────────────────────────────────────
  voirDetail(candidat: Candidat): void {
    this.isLoadingDetail = true;
    this.candidatDetail = null;
    this.http.get<any>(`${this.apiUrl}/admin/candidats/${candidat.idcandidats}`).subscribe({
      next: (res) => {
        if (res.success) this.candidatDetail = res.data;
        this.isLoadingDetail = false;
        this.cdr.detectChanges();
      },
      error: () => {
        // Fallback : afficher les données de la liste
        this.candidatDetail = { ...candidat, stages: [], candidatures: [], stats: { totalStages: 0, stagesEnCours: 0, stagesTermines: 0, totalCandidatures: 0, candidaturesRetenues: 0 } };
        this.isLoadingDetail = false;
        this.cdr.detectChanges();
      }
    });
  }

  fermerDetail(): void {
    this.candidatDetail = null;
    this.cdr.detectChanges();
  }

  // ── Créer ─────────────────────────────────────────────────────
  ouvrirCreateModal(): void {
    this.createForm.reset();
    this.tempPassword = '';
    this.errorMessage = '';
    this.showCreateModal = true;
    this.cdr.detectChanges();
  }

  fermerCreateModal(): void {
    this.showCreateModal = false;
    this.tempPassword = '';
    this.cdr.detectChanges();
  }

  creerCandidat(): void {
    if (this.createForm.invalid || this.isSaving) return;
    this.isSaving = true;
    this.errorMessage = '';

    this.http.post<any>(`${this.apiUrl}/admin/candidats`, this.createForm.value).subscribe({
      next: (res) => {
        if (res.success) {
          this.tempPassword = res.data.tempPassword || '';
          this.showSuccessMessage('Candidat créé avec succès !');
          this.chargerStats();
          this.chargerCandidats();
          if (!this.tempPassword) this.fermerCreateModal();
          // Si tempPassword, on garde le modal pour afficher le mdp
        }
        this.isSaving = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Erreur lors de la création';
        this.isSaving = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Modifier ──────────────────────────────────────────────────
  ouvrirEditModal(candidat: Candidat): void {
    this.candidatAEditer = candidat;
    this.editForm.patchValue({
      nom: candidat.nom,
      prenom: candidat.prenom,
      email: candidat.email,
      telephone: candidat.telephone
    });
    this.errorMessage = '';
    this.showEditModal = true;
    this.cdr.detectChanges();
  }

  fermerEditModal(): void {
    this.showEditModal = false;
    this.candidatAEditer = null;
    this.cdr.detectChanges();
  }

  modifierCandidat(): void {
    if (this.editForm.invalid || !this.candidatAEditer || this.isSaving) return;
    this.isSaving = true;
    this.errorMessage = '';

    this.http.put<any>(`${this.apiUrl}/admin/candidats/${this.candidatAEditer.idcandidats}`, this.editForm.value).subscribe({
      next: (res) => {
        if (res.success) {
          this.showSuccessMessage('Candidat modifié avec succès !');
          this.fermerEditModal();
          this.chargerCandidats();
        }
        this.isSaving = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Erreur lors de la modification';
        this.isSaving = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Supprimer ─────────────────────────────────────────────────
  ouvrirDeleteModal(candidat: Candidat): void {
    this.candidatASupprimer = candidat;
    this.showDeleteModal = true;
    this.cdr.detectChanges();
  }

  fermerDeleteModal(): void {
    this.showDeleteModal = false;
    this.candidatASupprimer = null;
    this.cdr.detectChanges();
  }

  supprimerCandidat(): void {
    if (!this.candidatASupprimer || this.isDeleting) return;
    this.isDeleting = true;

    this.http.delete<any>(`${this.apiUrl}/admin/candidats/${this.candidatASupprimer.idcandidats}`).subscribe({
      next: (res) => {
        if (res.success) {
          this.showSuccessMessage('Candidat supprimé avec succès !');
          this.fermerDeleteModal();
          this.chargerStats();
          this.chargerCandidats();
        }
        this.isDeleting = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Erreur lors de la suppression';
        this.isDeleting = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Helpers ───────────────────────────────────────────────────
  showSuccessMessage(msg: string): void {
    this.successMessage = msg;
    this.cdr.detectChanges();
    setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 4000);
  }

  getInitiale(nom: string): string {
    return (nom || '?').charAt(0).toUpperCase();
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}
