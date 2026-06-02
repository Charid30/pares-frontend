import { Component, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { RhService, ApiResponse, DashboardMainStats } from '../../../../core/services/rh.service';

@Component({
  selector: 'app-rh-rapports',
  imports: [CommonModule, RouterModule],
  templateUrl: './rh-rapports.html',
  styleUrl: './rh-rapports.css',
})
export class RhRapports implements OnInit {
  stats: DashboardMainStats | null = null;
  loading = true;
  error: string | null = null;
  today = new Date();

  constructor(
    private rhService: RhService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.loading = true;
    this.error = null;

    this.rhService.getDashboardMainStats().subscribe({
      next: (res: ApiResponse<DashboardMainStats>) => {
        this.ngZone.run(() => {
          if (res.success) this.stats = res.data;
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.error = 'Impossible de charger les statistiques.';
          this.loading = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  // Calcul taux de transformation candidatures->retenues (basé sur stats disponibles)
  get tauxTransformation(): number {
    if (!this.stats?.recrutements) return 0;
    const total = this.stats.recrutements.totalCandidatures || 0;
    if (total === 0) return 0;
    // Approximation : campagnesActives / totalCandidatures ratio
    return Math.min(100, Math.round((this.stats.recrutements.campagnesActives / total) * 100));
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
  }
}
