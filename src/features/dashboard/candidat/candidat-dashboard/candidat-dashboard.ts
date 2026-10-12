import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../../core/services/auth.service';
import { Router, RouterModule } from '@angular/router';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-candidat-dashboard',
  imports: [CommonModule, RouterModule],
  templateUrl: './candidat-dashboard.html',
  styleUrl: './candidat-dashboard.css',
})
export class CandidatDashboard implements OnInit {

  currentUser: any = null;
  todayDate = '';
  errorMessage: string | null = null;

  renouvEnAttente = 0;
  renouvActifs = 0;
  renouvRejetes = 0;
  renouvTermines = 0;

  private api = environment.apiUrl;

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();

    if (!this.currentUser) {
      this.router.navigate(['/auth/login']);
      return;
    }

    this.todayDate = new Date().toLocaleDateString('fr-FR', {
      weekday: 'short', day: 'numeric', month: 'long'
    });

    this.chargerRenouvellements();
  }

  private chargerRenouvellements(): void {
    this.http.get<{ success: boolean; data: any[] }>(`${this.api}/candidat/renouvellements`, { withCredentials: true })
      .subscribe({
        next: (res) => {
          const list = res.data || [];
          this.renouvEnAttente = list.filter(r => r.statusRenouvellement === 'EN_ATTENTE').length;
          this.renouvRejetes   = list.filter(r => r.statusRenouvellement === 'REJETE').length;
          this.renouvTermines  = list.filter(r => ['TERMINE', 'RAPPORT_SOUMIS'].includes(r.statusRenouvellement)).length;
          this.renouvActifs    = list.filter(r => ['PROGRAMMATION_EN_COURS', 'ACCEPTE', 'EN_COURS'].includes(r.statusRenouvellement)).length;
        },
        error: () => { /* silencieux */ }
      });
  }
}
