// api-keys.ts — Gestion des clés API pour applications externes (ADMIN)
// Routes backend :
//   GET    /api/admin/api-keys                → liste
//   POST   /api/admin/api-keys                → créer (retourne rawKey UNE SEULE FOIS)
//   PUT    /api/admin/api-keys/:id            → modifier (nom, scope, actif...)
//   POST   /api/admin/api-keys/:id/regenerer  → régénérer la valeur de la clé
//   DELETE /api/admin/api-keys/:id            → révoquer
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ChangeDetectorRef, OnInit, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { Loader } from '../../../../shared/components/loader/loader';
import { StatCard } from '../../../../shared/components/stat-card/stat-card';

interface ApiKeyItem {
  idapikey: number;
  nomApplication: string;
  description: string | null;
  keyPrefix: string;
  scope: 'LECTURE' | 'ECRITURE' | 'LECTURE_ECRITURE';
  actif: boolean;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdBy: string | null;
  createdAt: string;
}

@Component({
  selector: 'app-api-keys',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, Loader, StatCard],
  templateUrl: './api-keys.html',
  styleUrl: './api-keys.css',
})
export class ApiKeys implements OnInit {

  keys: ApiKeyItem[] = [];
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  // ── Modal création ────────────────────────────────────────────────────────
  showCreateModal = false;
  isSubmitting = false;
  errorCreate = '';
  form = {
    nomApplication: '',
    description: '',
    scope: 'LECTURE' as string,
    expiresAt: '',
  };

  // ── Affichage de la clé générée (une seule fois) ──────────────────────────
  generatedKey: string | null = null;
  generatedFor = '';
  copied = false;

  // ── Modal confirmation (révocation / régénération) ────────────────────────
  confirmAction: 'revoke' | 'regenerate' | null = null;
  confirmTarget: ApiKeyItem | null = null;

  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    this.loadKeys();
  }

  loadKeys(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.http.get<any>(`${this.apiUrl}/admin/api-keys`).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success && Array.isArray(res.data)) {
            this.keys = res.data;
          }
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.errorMessage = err.error?.message || 'Erreur lors du chargement';
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      },
    });
  }

  // ─── Création ─────────────────────────────────────────────────────────────
  ouvrirCreation(): void {
    this.form = { nomApplication: '', description: '', scope: 'LECTURE', expiresAt: '' };
    this.errorCreate = '';
    this.showCreateModal = true;
  }

  fermerCreation(): void {
    this.showCreateModal = false;
    this.errorCreate = '';
  }

  creerCle(): void {
    if (!this.form.nomApplication.trim()) {
      this.errorCreate = 'Le nom de l\'application est obligatoire.';
      return;
    }
    this.isSubmitting = true;
    this.errorCreate = '';

    const body: any = {
      nomApplication: this.form.nomApplication.trim(),
      scope: this.form.scope,
    };
    if (this.form.description.trim()) body.description = this.form.description.trim();
    if (this.form.expiresAt) body.expiresAt = this.form.expiresAt;

    this.http.post<any>(`${this.apiUrl}/admin/api-keys`, body).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success && res.data?.rawKey) {
            this.generatedKey = res.data.rawKey;
            this.generatedFor = res.data.nomApplication;
            this.copied = false;
            this.showCreateModal = false;
            this.loadKeys();
          }
          this.isSubmitting = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.errorCreate = err.error?.message || 'Erreur lors de la création.';
          this.isSubmitting = false;
          this.cdr.detectChanges();
        });
      },
    });
  }

  copierCle(): void {
    if (!this.generatedKey) return;
    navigator.clipboard.writeText(this.generatedKey).then(() => {
      this.copied = true;
      this.cdr.detectChanges();
    });
  }

  fermerCleGeneree(): void {
    this.generatedKey = null;
    this.generatedFor = '';
    this.copied = false;
  }

  // ─── Activer / désactiver ────────────────────────────────────────────────
  toggleActif(key: ApiKeyItem): void {
    this.http.put<any>(`${this.apiUrl}/admin/api-keys/${key.idapikey}`, { actif: !key.actif }).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) {
            key.actif = !key.actif;
            this.flashSuccess(key.actif ? 'Clé activée.' : 'Clé désactivée.');
          }
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.errorMessage = err.error?.message || 'Erreur lors de la modification.';
          setTimeout(() => { this.errorMessage = ''; this.cdr.detectChanges(); }, 4000);
          this.cdr.detectChanges();
        });
      },
    });
  }

  changerScope(key: ApiKeyItem, scope: string): void {
    this.http.put<any>(`${this.apiUrl}/admin/api-keys/${key.idapikey}`, { scope }).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) {
            key.scope = scope as ApiKeyItem['scope'];
            this.flashSuccess('Scope mis à jour.');
          }
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.errorMessage = err.error?.message || 'Erreur lors de la modification.';
          setTimeout(() => { this.errorMessage = ''; this.cdr.detectChanges(); }, 4000);
          this.cdr.detectChanges();
        });
      },
    });
  }

  // ─── Confirmation (révocation / régénération) ────────────────────────────
  demanderConfirmation(action: 'revoke' | 'regenerate', key: ApiKeyItem): void {
    this.confirmAction = action;
    this.confirmTarget = key;
  }

  annulerConfirmation(): void {
    this.confirmAction = null;
    this.confirmTarget = null;
  }

  executerConfirmation(): void {
    if (!this.confirmAction || !this.confirmTarget) return;
    const key = this.confirmTarget;
    const action = this.confirmAction;
    this.annulerConfirmation();

    if (action === 'revoke') {
      this.http.delete<any>(`${this.apiUrl}/admin/api-keys/${key.idapikey}`).subscribe({
        next: (res) => {
          this.ngZone.run(() => {
            if (res.success) {
              this.flashSuccess(`Clé « ${key.nomApplication} » révoquée.`);
              this.loadKeys();
            }
            this.cdr.detectChanges();
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            this.errorMessage = err.error?.message || 'Erreur lors de la révocation.';
            setTimeout(() => { this.errorMessage = ''; this.cdr.detectChanges(); }, 4000);
            this.cdr.detectChanges();
          });
        },
      });
    } else {
      this.http.post<any>(`${this.apiUrl}/admin/api-keys/${key.idapikey}/regenerer`, {}).subscribe({
        next: (res) => {
          this.ngZone.run(() => {
            if (res.success && res.data?.rawKey) {
              this.generatedKey = res.data.rawKey;
              this.generatedFor = res.data.nomApplication;
              this.copied = false;
              this.loadKeys();
            }
            this.cdr.detectChanges();
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            this.errorMessage = err.error?.message || 'Erreur lors de la régénération.';
            setTimeout(() => { this.errorMessage = ''; this.cdr.detectChanges(); }, 4000);
            this.cdr.detectChanges();
          });
        },
      });
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  private flashSuccess(msg: string): void {
    this.successMessage = msg;
    setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 4000);
  }

  getScopeLabel(scope: string): string {
    const labels: Record<string, string> = {
      'LECTURE': 'Lecture seule',
      'ECRITURE': 'Écriture seule',
      'LECTURE_ECRITURE': 'Lecture + Écriture',
    };
    return labels[scope] || scope;
  }

  getScopeClass(scope: string): string {
    const classes: Record<string, string> = {
      'LECTURE': 'bg-blue-100 text-blue-700',
      'ECRITURE': 'bg-orange-100 text-orange-700',
      'LECTURE_ECRITURE': 'bg-purple-100 text-purple-700',
    };
    return classes[scope] || 'bg-gray-100 text-gray-600';
  }

  estExpiree(key: ApiKeyItem): boolean {
    return !!key.expiresAt && new Date(key.expiresAt) < new Date();
  }

  // ─── Stats d'en-tête ──────────────────────────────────────────────────────
  get countTotal(): number {
    return this.keys.length;
  }

  get countActives(): number {
    return this.keys.filter(k => k.actif && !this.estExpiree(k)).length;
  }

  get countEcriture(): number {
    return this.keys.filter(k => k.scope === 'ECRITURE' || k.scope === 'LECTURE_ECRITURE').length;
  }

  get countInactives(): number {
    return this.keys.filter(k => !k.actif || this.estExpiree(k)).length;
  }
}
