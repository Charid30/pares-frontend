// src/features/dashboard/agent/modules/candidatures/agent-candidatures.ts
import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../../../core/services/auth.service';
import { environment } from '../../../../../environments/environment';
import { StatCard } from '../../../../../shared/components/stat-card/stat-card';

interface Document {
  iddocument: number;
  typeDocument: string;
  document_filename: string;
  document_size?: number;
  dateUpload: string;
  description?: string;
}

interface Candidature {
  idcandidature: number;
  statusCandidature: 'SOUMISE' | 'EN_VERIFICATION' | 'ACCEPTEE' | 'REJETEE';
  motifRefus?: string;
  dateCandidature: string;
  createdDate?: string;
  candidat?: { idcandidats: number; nom: string; prenom: string; email: string; telephone?: string };
  profil?: { idprofil: number; titreProfil: string; campagne?: { idcampagne: number; titreCampagne: string } };
  documents?: Document[];
}

@Component({
  selector: 'app-agent-candidatures',
  standalone: true,
  imports: [CommonModule, FormsModule, StatCard],
  templateUrl: './agent-candidatures.html',
})
export class AgentCandidatures implements OnInit {

  candidatures: Candidature[] = [];
  candidaturesFiltrees: Candidature[] = [];
  loading = false;
  erreur = '';
  search = '';
  filtreStatut = '';
  candidatureEnRefus: Candidature | null = null;
  motifRefus = '';
  soumission = false;
  showDetailModal = false;
  detailCandidature: Candidature | null = null;
  loadingDetail = false;

  // Toasts
  toasts: { id: number; title: string; message: string; type: 'success' | 'error' | 'warning' }[] = [];
  private toastIdCounter = 0;

  // Permissions (réactives)
  get peutConsulter(): boolean { return this.authService.hasPermission('CANDIDATURES', 'CONSULTER'); }
  get peutValider():   boolean { return this.authService.hasPermission('CANDIDATURES', 'VALIDER'); }
  get peutRejeter():   boolean { return this.authService.hasPermission('CANDIDATURES', 'REJETER'); }

  statsStatuts = [
    { value: 'SOUMISE',         label: 'Soumises',        dot: 'bg-yellow-400', ringClass: 'ring-yellow-400', count: 0, accent: 'amber',   icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { value: 'EN_VERIFICATION', label: 'En vérification', dot: 'bg-blue-500',   ringClass: 'ring-blue-400',   count: 0, accent: 'blue',    icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
    { value: 'ACCEPTEE',        label: 'Acceptées',       dot: 'bg-green-500',  ringClass: 'ring-green-400',  count: 0, accent: 'emerald', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { value: 'REJETEE',         label: 'Rejetées',        dot: 'bg-red-500',    ringClass: 'ring-red-400',    count: 0, accent: 'rose',    icon: 'M6 18L18 6M6 6l12 12' },
  ];

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private authService: AuthService, private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  ngOnInit(): void {
    if (!this.peutConsulter) return;
    this.charger();
  }

  charger(): void {
    this.loading = true;
    this.erreur = '';
    this.http.get<any>(`${this.apiUrl}/recrutement/campagnes?limit=100`).subscribe({
      next: (res) => {
        const campagnes = res.data?.items || [];
        if (campagnes.length === 0) {
          this.loading = false;
          this.cdr.detectChanges();
          return;
        }
        const allCandidatures: Candidature[] = [];
        let pending = campagnes.length;
        campagnes.forEach((camp: any) => {
          this.http.get<any>(`${this.apiUrl}/recrutement/campagnes/${camp.idcampagne}/candidatures`).subscribe({
            next: (r) => {
              const cands = r.data || [];
              allCandidatures.push(...cands);
              pending--;
              if (pending === 0) {
                this.candidatures = allCandidatures;
                this.calculerStats();
                this.filtrer();
                this.loading = false;
                this.cdr.detectChanges();
              }
            },
            error: () => {
              pending--;
              if (pending === 0) {
                this.candidatures = allCandidatures;
                this.calculerStats();
                this.filtrer();
                this.loading = false;
                this.cdr.detectChanges();
              }
            },
          });
        });
      },
      error: (err) => {
        this.erreur = err.error?.message || 'Erreur lors du chargement';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  calculerStats(): void {
    this.statsStatuts.forEach(s => {
      s.count = this.candidatures.filter(c => c.statusCandidature === s.value).length;
    });
  }

  filtrer(): void {
    this.candidaturesFiltrees = this.candidatures.filter(c => {
      const nom = `${c.candidat?.nom || ''} ${c.candidat?.prenom || ''} ${c.candidat?.email || ''} ${c.profil?.titreProfil || ''}`.toLowerCase();
      const matchSearch = !this.search || nom.includes(this.search.toLowerCase());
      const matchStatut = !this.filtreStatut || c.statusCandidature === this.filtreStatut;
      return matchSearch && matchStatut;
    });
  }

  effacerFiltres(): void {
    this.search = '';
    this.filtreStatut = '';
    this.filtrer();
  }

  getInitiales(c: Candidature): string {
    if (!c.candidat) return '?';
    return ((c.candidat.nom?.[0] || '') + (c.candidat.prenom?.[0] || '')).toUpperCase() || '?';
  }

  voirDetail(c: Candidature): void {
    this.detailCandidature = c;
    this.showDetailModal = true;
    this.loadingDetail = true;
    this.cdr.detectChanges();

    this.http.get<any>(`${this.apiUrl}/recrutement/candidatures/${c.idcandidature}`).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.detailCandidature = res.data || c;
          this.loadingDetail = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.loadingDetail = false;
          this.cdr.detectChanges();
        });
      },
    });
  }

  fermerDetail(): void {
    this.showDetailModal = false;
    this.detailCandidature = null;
    this.loadingDetail = false;
  }

  previewDocument(doc: Document): void {
    this.http.get(`${this.apiUrl}/recrutement/documents/${doc.iddocument}/download`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      },
      error: () => {
        this.showToast('Erreur', 'Impossible d\'ouvrir le document', 'error');
        this.cdr.detectChanges();
      },
    });
  }

  downloadDocument(doc: Document): void {
    this.http.get(`${this.apiUrl}/recrutement/documents/${doc.iddocument}/download`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.document_filename;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.showToast('Erreur', 'Impossible de télécharger le document', 'error');
        this.cdr.detectChanges();
      },
    });
  }

  evaluer(c: Candidature, statut: string): void {
    this.http.put(`${this.apiUrl}/recrutement/candidatures/${c.idcandidature}/evaluer`, { statusCandidature: statut }).subscribe({
      next: () => {
        c.statusCandidature = statut as any;
        this.calculerStats();
        this.filtrer();
        this.showToast('Succès', `Candidature mise à jour : ${this.getStatutLabel(statut)}`);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.showToast('Erreur', err.error?.message || 'Erreur lors de la mise à jour', 'error');
        this.cdr.detectChanges();
      },
    });
  }

  ouvrirRefus(c: Candidature): void {
    this.candidatureEnRefus = c;
    this.motifRefus = '';
  }

  confirmerRefus(): void {
    if (!this.candidatureEnRefus || !this.motifRefus.trim()) return;
    this.soumission = true;
    this.http.put(`${this.apiUrl}/recrutement/candidatures/${this.candidatureEnRefus.idcandidature}/evaluer`, {
      statusCandidature: 'REJETEE',
      motifRefus: this.motifRefus.trim(),
    }).subscribe({
      next: () => {
        if (this.candidatureEnRefus) {
          this.candidatureEnRefus.statusCandidature = 'REJETEE';
          this.candidatureEnRefus.motifRefus = this.motifRefus;
        }
        this.calculerStats();
        this.filtrer();
        this.showToast('Succès', 'Candidature rejetée');
        this.candidatureEnRefus = null;
        this.motifRefus = '';
        this.soumission = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.showToast('Erreur', err.error?.message || 'Erreur lors du rejet', 'error');
        this.soumission = false;
        this.cdr.detectChanges();
      },
    });
  }

  showToast(title: string, message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
    const id = ++this.toastIdCounter;
    this.toasts.push({ id, title, message, type });
    setTimeout(() => this.dismissToast(id), 4000);
  }

  dismissToast(id: number): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.cdr.detectChanges();
  }

  getStatutBarClass(s: string): string {
    const c: Record<string, string> = {
      SOUMISE: 'bg-yellow-400', EN_VERIFICATION: 'bg-blue-500',
      ACCEPTEE: 'bg-green-500', REJETEE: 'bg-red-500',
    };
    return c[s] || 'bg-gray-300';
  }

  getStatutLabel(s: string): string {
    const labels: Record<string, string> = {
      SOUMISE: 'Soumise', EN_VERIFICATION: 'En vérification',
      ACCEPTEE: 'Acceptée', REJETEE: 'Rejetée',
    };
    return labels[s] || s;
  }

  getStatutClass(s: string): string {
    const classes: Record<string, string> = {
      SOUMISE: 'bg-yellow-100 text-yellow-700',
      EN_VERIFICATION: 'bg-blue-100 text-blue-700',
      ACCEPTEE: 'bg-green-100 text-green-700',
      REJETEE: 'bg-red-100 text-red-700',
    };
    return classes[s] || 'bg-gray-100 text-gray-700';
  }
}
