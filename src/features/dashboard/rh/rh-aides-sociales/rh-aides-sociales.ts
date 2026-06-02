import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RhService, ApiResponse, DashboardMainStats } from '../../../../core/services/rh.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-rh-aides-sociales',
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './rh-aides-sociales.html',
  styleUrl: './rh-aides-sociales.css',
})
export class RhAidesSociales implements OnInit {
  stats: DashboardMainStats | null = null;
  loading = true;
  error: string | null = null;

  // Permissions module AIDE
  canCreate   = false;
  canEdit     = false;
  canValidate = false;
  canReject   = false;
  canDelete   = false;

  constructor(
    private rhService: RhService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.canCreate   = this.authService.hasPermission('AIDE', 'CREER');
    this.canEdit     = this.authService.hasPermission('AIDE', 'MODIFIER');
    this.canValidate = this.authService.hasPermission('AIDE', 'VALIDER');
    this.canReject   = this.authService.hasPermission('AIDE', 'REJETER');
    this.canDelete   = this.authService.hasPermission('AIDE', 'SUPPRIMER');
    this.loadStats();
  }

  loadStats(): void {
    this.loading = true;
    this.rhService.getDashboardMainStats().subscribe({
      next: (res: ApiResponse<DashboardMainStats>) => {
        if (res.success) this.stats = res.data;
        this.loading = false;
      },
      error: () => {
        this.error = 'Impossible de charger les statistiques.';
        this.loading = false;
      }
    });
  }
}
