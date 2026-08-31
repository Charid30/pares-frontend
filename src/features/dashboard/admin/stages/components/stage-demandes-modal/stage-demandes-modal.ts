import { Component, Input, Output, EventEmitter, ChangeDetectorRef, NgZone, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminStageService } from '../../../../../../core/services/admin-stage.service';

@Component({
  selector: 'app-stage-demandes-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stage-demandes-modal.html',
})
export class StageDemandesModal implements OnChanges {
  @Input() show = false;
  @Input() demande: any = null;
  @Output() close = new EventEmitter<void>();
  @Output() evaluated = new EventEmitter<void>();

  form = { status: '' as 'APPROUVEE' | 'REJETEE' | '', reponse_drh: '' };
  submitting = false;
  errorMessage = '';

  constructor(
    private adminStageService: AdminStageService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show'] && this.show) {
      this.form = { status: '', reponse_drh: '' };
      this.submitting = false;
      this.errorMessage = '';
    }
  }

  getTypeLabel(type: string): string {
    return type === 'SUSPENSION' ? 'Suspension' : 'Annulation';
  }

  fermer(): void {
    this.close.emit();
  }

  confirmer(): void {
    if (!this.demande || !this.form.status) return;
    this.submitting = true;
    this.errorMessage = '';

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
            this.errorMessage = 'Une erreur est survenue';
            this.submitting = false;
          }
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.errorMessage = err.error?.message || 'Erreur lors du traitement';
          this.submitting = false;
          this.cdr.detectChanges();
        });
      },
    });
  }
}
