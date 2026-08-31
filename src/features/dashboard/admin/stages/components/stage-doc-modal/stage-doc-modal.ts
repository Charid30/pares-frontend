import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AdminStageService } from '../../../../../../core/services/admin-stage.service';
import { AuthService } from '../../../../../../core/services/auth.service';
import { environment } from '../../../../../../environments/environment';

@Component({
  selector: 'app-stage-doc-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stage-doc-modal.html',
})
export class StageDocModal implements OnChanges {
  @Input() show = false;
  @Input() stageId: number | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() documentCreated = new EventEmitter<number>();

  docType: 'CONVENTION' | 'ATTESTATION' = 'CONVENTION';
  docDateEmission = '';
  docFile: File | null = null;
  errorDoc = '';
  soumissionDoc = false;
  stageHasConvention = false;
  checkingConvention = false;

  constructor(
    private http: HttpClient,
    private adminStageService: AdminStageService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show'] && this.show && this.stageId) {
      this.reset();
      this.checkExistingConvention();
    }
  }

  private reset(): void {
    this.docType = 'CONVENTION';
    this.docDateEmission = new Date().toISOString().substring(0, 10);
    this.docFile = null;
    this.errorDoc = '';
    this.soumissionDoc = false;
    this.stageHasConvention = false;
    this.checkingConvention = true;
  }

  private checkExistingConvention(): void {
    this.adminStageService.getStageById(this.stageId!).subscribe({
      next: (res) => {
        const docs: any[] = (res.data as any)?.documents || [];
        this.stageHasConvention = docs.some((d: any) => d.typeDocument === 'CONVENTION');
        if (this.stageHasConvention) this.docType = 'ATTESTATION';
        this.checkingConvention = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.checkingConvention = false;
        this.cdr.detectChanges();
      },
    });
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.docFile = input.files?.[0] || null;
  }

  fermer(): void {
    this.close.emit();
  }

  creerDocument(): void {
    if (!this.stageId || this.soumissionDoc) return;
    if (!this.docFile) { this.errorDoc = 'Veuillez sélectionner un fichier PDF'; this.cdr.detectChanges(); return; }
    if (!this.docDateEmission) { this.errorDoc = "La date d'émission est requise"; this.cdr.detectChanges(); return; }

    this.soumissionDoc = true;
    this.errorDoc = '';

    const formData = new FormData();
    formData.append('stage_idstage', String(this.stageId));
    formData.append('typeDocument', this.docType);
    formData.append('dateEmission', this.docDateEmission);
    formData.append('document', this.docFile);
    const user = this.authService.getCurrentUser();
    if (user) formData.append('emetteurNom', `${user.prenom || ''} ${user.nom || ''}`.trim());

    const stageId = this.stageId;
    this.http.post<any>(`${environment.apiUrl}/stages/documents`, formData).subscribe({
      next: () => {
        this.soumissionDoc = false;
        this.documentCreated.emit(stageId!);
      },
      error: (err) => {
        this.errorDoc = err.error?.message || 'Erreur lors de la création du document';
        this.soumissionDoc = false;
        this.cdr.detectChanges();
      },
    });
  }
}
