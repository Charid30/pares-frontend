import { Component, Input, Output, EventEmitter, ChangeDetectorRef, NgZone, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminStageService } from '../../../../../../core/services/admin-stage.service';
import { ToastService } from '../../../../../../core/services/toast.service';
import { ConfirmService } from '../../../../../../core/services/confirm.service';

@Component({
  selector: 'app-stage-demandes-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stage-demandes-modal.html',
})
export class StageDemandesModal implements OnChanges {
  private readonly confirmService = inject(ConfirmService);
  private readonly toastService = inject(ToastService);
  @Input() show = false;
  @Input() demande: any = null;
  @Output() close = new EventEmitter<void>();
  @Output() evaluated = new EventEmitter<void>();

  form = { status: '' as 'APPROUVEE' | 'REJETEE' | '', reponse_drh: '' };
  submitting = false;

  constructor(
    private adminStageService: AdminStageService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show'] && this.show) {
      this.form = { status: '', reponse_drh: '' };
      this.submitting = false;
    }
  }

  getTypeLabel(type: string): string {
    return type === 'SUSPENSION' ? 'Suspension' : 'Annulation';
  }

  fermer(): void {
    this.close.emit();
  }

  async confirmer(): Promise<void> {
    if (!this.demande || !this.form.status) return;
    if (!(await this.confirmService.demander({ titre: 'Enregistrer la décision', message: 'La décision sur la demande de modification sera enregistrée et le candidat notifié.', confirmer: 'Enregistrer' }))) return;
    this.submitting = true;

    this.adminStageService.evaluerDemandeModification(this.demande.id, {
      status: this.form.status as 'APPROUVEE' | 'REJETEE',
      reponse_drh: this.form.reponse_drh || undefined,
    }).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) {
            this.submitting = false;
            this.evaluated.emit();
          } else {
            this.toastService.erreur('Une erreur est survenue');
            this.submitting = false;
          }
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.toastService.erreur(err.error?.message || 'Erreur lors du traitement');
          this.submitting = false;
          this.cdr.detectChanges();
        });
      },
    });
  }
}
