// api-keys.ts — Gestion des clés API pour applications externes (ADMIN)
// Routes backend :
//   GET    /api/admin/api-keys                → liste
//   POST   /api/admin/api-keys                → créer (retourne rawKey UNE SEULE FOIS)
//   PUT    /api/admin/api-keys/:id            → modifier (nom, scope, actif...)
//   POST   /api/admin/api-keys/:id/regenerer  → régénérer la valeur de la clé
//   DELETE /api/admin/api-keys/:id            → révoquer
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ChangeDetectorRef, OnInit, NgZone, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { Loader } from '../../../../shared/components/loader/loader';
import { StatCard } from '../../../../shared/components/stat-card/stat-card';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmService } from '../../../../core/services/confirm.service';

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
  private readonly confirmService = inject(ConfirmService);
  private readonly toastService = inject(ToastService);

  keys: ApiKeyItem[] = [];
  isLoading = false;
  errorMessage = '';

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

  async creerCle(): Promise<void> {
    if (!this.form.nomApplication.trim()) {
      this.errorCreate = 'Le nom de l\'application est obligatoire.';
      return;
    }
    if (!(await this.confirmService.demander({ titre: 'Créer la clé API', message: 'Une nouvelle clé d\'accès à l\'API sera générée pour cette application.', confirmer: 'Créer' }))) return;
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
  async toggleActif(key: ApiKeyItem): Promise<void> {
    if (!(await this.confirmService.demander({ titre: key.actif ? 'Désactiver la clé' : 'Activer la clé', message: key.actif ? 'L\'application ne pourra plus utiliser l\'API avec cette clé.' : 'L\'application pourra de nouveau utiliser l\'API.', detail: key.nomApplication, confirmer: key.actif ? 'Désactiver' : 'Activer', danger: key.actif }))) return;
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
          this.toastService.erreur(err.error?.message || 'Erreur lors de la modification.');
          this.cdr.detectChanges();
        });
      },
    });
  }

  async changerScope(key: ApiKeyItem, scope: string): Promise<void> {
    const ok = await this.confirmService.demander({
      titre: 'Changer le scope', message: 'Les droits d\'accès de cette clé à l\'API seront modifiés.', detail: key.nomApplication, confirmer: 'Changer',
    });
    if (!ok) {
      // La liste affiche déjà le nouveau choix : on la ramène à la valeur enregistrée
      const actuel = key.scope;
      key.scope = null as unknown as ApiKeyItem['scope'];
      this.cdr.detectChanges();
      key.scope = actuel;
      this.cdr.detectChanges();
      return;
    }
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
          this.toastService.erreur(err.error?.message || 'Erreur lors de la modification.');
          this.cdr.detectChanges();
        });
      },
    });
  }

  // ─── Confirmation (révocation / régénération) ────────────────────────────
  async demanderConfirmation(action: 'revoke' | 'regenerate', key: ApiKeyItem): Promise<void> {
    const ok = await this.confirmService.demander(action === 'revoke'
      ? { titre: 'Révoquer cette clé ?', message: 'La clé cessera immédiatement de fonctionner. Cette action est définitive.', detail: key.nomApplication, confirmer: 'Révoquer', danger: true }
      : { titre: 'Régénérer cette clé ?', message: "L'ancienne clé cessera immédiatement de fonctionner et une nouvelle valeur sera générée.", detail: key.nomApplication, confirmer: 'Régénérer', danger: true });
    if (!ok) return;
    this.confirmAction = action;
    this.confirmTarget = key;
    this.executerConfirmation();
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
            this.toastService.erreur(err.error?.message || 'Erreur lors de la révocation.');
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
            this.toastService.erreur(err.error?.message || 'Erreur lors de la régénération.');
            this.cdr.detectChanges();
          });
        },
      });
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  private flashSuccess(msg: string): void {
    this.toastService.succes(msg);
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
