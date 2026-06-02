// permissions-list.ts
import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { PermissionService } from '../../../../core/services/permission.service';
import { ModuleAction, RoleWithPermissions } from '../../../../core/models/user.model';

interface Toast {
  id: number;
  type: 'success' | 'error';
  title: string;
  message: string;
}

@Component({
  selector: 'app-permissions-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './permissions-list.html',
})
export class PermissionsList implements OnInit {

  // Données
  roles: RoleWithPermissions[] = [];
  modules: ModuleAction[] = [];
  actions: ModuleAction[] = [];

  // Rôles masqués (système)
  readonly SYSTEM_ROLES = ['ADMIN', 'CANDIDAT'];

  // États globaux
  loading = false;

  // ── Modal création/édition rôle ──────────────────────────────────────────
  showModal = false;
  modalMode: 'create' | 'edit' = 'create';
  modalStep = 1; // 1 = infos rôle, 2 = permissions
  editingRole: RoleWithPermissions | null = null;

  // Étape 1
  formAccronyme = '';
  formDescription = '';
  formError = '';
  submitting = false;

  // Étape 2 — matrice permissions
  permMatrix: { [module: string]: { [action: string]: boolean } } = {};
  savingPerms = false;

  // ── Modal suppression ────────────────────────────────────────────────────
  showDeleteModal = false;
  deletingRole: RoleWithPermissions | null = null;
  deleting = false;

  // ── Modal édition permissions standalone ────────────────────────────────
  showPermsModal = false;
  permsRole: RoleWithPermissions | null = null;
  savingPermsStandalone = false;

  // Toasts
  toasts: Toast[] = [];
  private toastId = 0;

  constructor(
    private permService: PermissionService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  // ── Chargement ────────────────────────────────────────────────────────────

  loadAll(): void {
    this.loading = true;
    forkJoin({
      meta: this.permService.getModulesActions(),
      roles: this.permService.getAllRoles(),
    }).subscribe({
      next: ({ meta, roles }) => {
        this.ngZone.run(() => {
          if (meta.success) {
            this.modules = meta.data.modules;
            this.actions = meta.data.actions;
          }
          if (roles.success) {
            this.roles = roles.data.filter(r => !this.SYSTEM_ROLES.includes(r.accronyme));
          }
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.showToast('Erreur', 'Impossible de charger les données', 'error');
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
    });
  }

  // ── Helpers matrice ───────────────────────────────────────────────────────

  buildMatrix(role: RoleWithPermissions): void {
    this.permMatrix = {};
    for (const mod of this.modules) {
      this.permMatrix[mod.key] = {};
      for (const act of this.actions) {
        this.permMatrix[mod.key][act.key] = false;
      }
    }
    for (const perm of role.permissions || []) {
      if (this.permMatrix[perm.module]) {
        this.permMatrix[perm.module][perm.action] = true;
      }
    }
  }

  emptyMatrix(): void {
    this.permMatrix = {};
    for (const mod of this.modules) {
      this.permMatrix[mod.key] = {};
      for (const act of this.actions) {
        this.permMatrix[mod.key][act.key] = false;
      }
    }
  }

  togglePermission(moduleKey: string, actionKey: string): void {
    if (this.permMatrix[moduleKey]) {
      this.permMatrix[moduleKey][actionKey] = !this.permMatrix[moduleKey][actionKey];
    }
  }

  toggleRow(moduleKey: string): void {
    const allOn = this.actions.every(a => this.permMatrix[moduleKey]?.[a.key]);
    for (const act of this.actions) this.permMatrix[moduleKey][act.key] = !allOn;
  }

  toggleCol(actionKey: string): void {
    const allOn = this.modules.every(m => this.permMatrix[m.key]?.[actionKey]);
    for (const mod of this.modules) this.permMatrix[mod.key][actionKey] = !allOn;
  }

  isRowAll(moduleKey: string): boolean {
    return this.actions.every(a => this.permMatrix[moduleKey]?.[a.key]);
  }

  isColAll(actionKey: string): boolean {
    return this.modules.every(m => this.permMatrix[m.key]?.[actionKey]);
  }

  countEnabled(): number {
    let count = 0;
    for (const mod of this.modules)
      for (const act of this.actions)
        if (this.permMatrix[mod.key]?.[act.key]) count++;
    return count;
  }

  countRolePerms(role: RoleWithPermissions): number {
    return (role.permissions || []).length;
  }

  collectPermissions(): { module: string; action: string }[] {
    const perms: { module: string; action: string }[] = [];
    for (const mod of this.modules)
      for (const act of this.actions)
        if (this.permMatrix[mod.key]?.[act.key])
          perms.push({ module: mod.key, action: act.key });
    return perms;
  }

  // ── Modal création / édition rôle ────────────────────────────────────────

  openCreateModal(): void {
    this.modalMode = 'create';
    this.editingRole = null;
    this.modalStep = 1;
    this.formAccronyme = '';
    this.formDescription = '';
    this.formError = '';
    this.emptyMatrix();
    this.showModal = true;
  }

  openEditInfoModal(role: RoleWithPermissions): void {
    this.modalMode = 'edit';
    this.editingRole = role;
    this.modalStep = 1;
    this.formAccronyme = role.accronyme;
    this.formDescription = role.description;
    this.formError = '';
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingRole = null;
    this.formError = '';
    this.submitting = false;
  }

  // Étape 1 → Étape 2 (création) ou Enregistrer (édition)
  submitStep1(): void {
    this.formError = '';
    if (!this.formAccronyme.trim()) { this.formError = "L'acronyme est requis"; return; }
    if (!this.formDescription.trim()) { this.formError = 'La description est requise'; return; }

    if (this.modalMode === 'create') {
      // Passer à l'étape 2 sans appel réseau
      this.modalStep = 2;
    } else {
      // Édition : enregistrer directement
      this.submitting = true;
      this.permService.updateRole(this.editingRole!.idrole, this.formAccronyme, this.formDescription).subscribe({
        next: (res) => {
          this.ngZone.run(() => {
            if (res.success) {
              this.showToast('Succès', 'Rôle mis à jour avec succès', 'success');
              const idx = this.roles.findIndex(r => r.idrole === this.editingRole!.idrole);
              if (idx !== -1) { this.roles[idx] = { ...this.roles[idx], ...res.data }; }
              this.closeModal();
            }
            this.submitting = false;
            this.cdr.detectChanges();
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            this.formError = err?.error?.message || 'Erreur lors de la mise à jour';
            this.submitting = false;
            this.cdr.detectChanges();
          });
        },
      });
    }
  }

  // Étape 2 → Créer le rôle + affecter les permissions
  submitStep2(): void {
    this.savingPerms = true;
    const permissions = this.collectPermissions();

    this.permService.createRole(this.formAccronyme, this.formDescription).subscribe({
      next: (resRole) => {
        if (!resRole.success) {
          this.ngZone.run(() => {
            this.formError = 'Erreur lors de la création du rôle';
            this.savingPerms = false;
            this.cdr.detectChanges();
          });
          return;
        }
        const newRole = resRole.data;

        if (permissions.length === 0) {
          // Pas de permissions → terminé
          this.ngZone.run(() => {
            this.roles.push(newRole);
            this.showToast('Succès', `Rôle "${newRole.description}" créé`, 'success');
            this.closeModal();
            this.savingPerms = false;
            this.cdr.detectChanges();
          });
          return;
        }

        this.permService.updateRolePermissions(newRole.idrole, permissions).subscribe({
          next: (resPerms) => {
            this.ngZone.run(() => {
              this.roles.push(resPerms.success ? resPerms.data : newRole);
              this.showToast('Succès', `Rôle "${newRole.description}" créé avec ${permissions.length} permission(s)`, 'success');
              this.closeModal();
              this.savingPerms = false;
              this.cdr.detectChanges();
            });
          },
          error: () => {
            this.ngZone.run(() => {
              // Rôle créé mais permissions échouées → on l'ajoute quand même
              this.roles.push(newRole);
              this.showToast('Attention', 'Rôle créé mais erreur sur les permissions', 'error');
              this.closeModal();
              this.savingPerms = false;
              this.cdr.detectChanges();
            });
          },
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.formError = err?.error?.message || 'Erreur lors de la création';
          this.savingPerms = false;
          this.modalStep = 1; // retour étape 1 si le rôle n'a pas pu être créé
          this.cdr.detectChanges();
        });
      },
    });
  }

  // ── Modal édition permissions standalone ─────────────────────────────────

  openPermsModal(role: RoleWithPermissions): void {
    this.permsRole = role;
    this.buildMatrix(role);
    this.showPermsModal = true;
  }

  closePermsModal(): void {
    this.showPermsModal = false;
    this.permsRole = null;
    this.savingPermsStandalone = false;
  }

  savePermsStandalone(): void {
    if (!this.permsRole) return;
    this.savingPermsStandalone = true;
    const permissions = this.collectPermissions();

    this.permService.updateRolePermissions(this.permsRole.idrole, permissions).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) {
            const idx = this.roles.findIndex(r => r.idrole === this.permsRole!.idrole);
            if (idx !== -1) this.roles[idx] = res.data;
            this.showToast('Succès', `Permissions de "${this.permsRole!.description}" enregistrées`, 'success');
            this.closePermsModal();
          }
          this.savingPermsStandalone = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.showToast('Erreur', err?.error?.message || "Erreur lors de l'enregistrement", 'error');
          this.savingPermsStandalone = false;
          this.cdr.detectChanges();
        });
      },
    });
  }

  // ── Suppression ───────────────────────────────────────────────────────────

  openDeleteModal(role: RoleWithPermissions): void {
    this.deletingRole = role;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.deletingRole = null;
    this.deleting = false;
  }

  confirmDelete(): void {
    if (!this.deletingRole) return;
    this.deleting = true;

    this.permService.deleteRole(this.deletingRole.idrole).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) {
            this.roles = this.roles.filter(r => r.idrole !== this.deletingRole!.idrole);
            this.showToast('Succès', 'Rôle supprimé avec succès', 'success');
            this.closeDeleteModal();
          }
          this.deleting = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.showToast('Erreur', err?.error?.message || 'Impossible de supprimer ce rôle', 'error');
          this.deleting = false;
          this.closeDeleteModal();
          this.cdr.detectChanges();
        });
      },
    });
  }

  // ── Toasts ────────────────────────────────────────────────────────────────

  showToast(title: string, message: string, type: 'success' | 'error'): void {
    const toast: Toast = { id: ++this.toastId, type, title, message };
    this.toasts.push(toast);
    setTimeout(() => this.removeToast(toast.id), 4000);
  }

  removeToast(id: number): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.cdr.detectChanges();
  }
}
