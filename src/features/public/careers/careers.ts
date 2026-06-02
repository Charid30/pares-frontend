import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Campagne, RecrutementService } from '../../../core/services/recrutement.service';
import { Loader } from "../../../shared/components/loader/loader";
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-careers',
  imports: [CommonModule, RouterModule, Loader],
  templateUrl: './careers.html',
  styleUrl: './careers.css',
})
export class Careers implements OnInit {

  campagnes: Campagne[] = [];
  isLoading = false;
  isLoadingMore = false;
  error: string | null = null;

  // Pagination
  currentPage = 1;
  itemsPerPage = 5;
  totalCampagnes = 0;
  hasMore = false;

  constructor(
    private recrutementService: RecrutementService,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    setTimeout(() => {
      this.cdr.detectChanges();
    }, 2000);
    this.loadCampagnesActives();
  }

  /**
   * Navigation intelligente : redirige vers authPath si connecté,
   * sinon vers guestPath (défaut : page de connexion).
   */
  go(authPath: string, guestPath: string = '/auth/login'): void {
    if (this.authService.isLoggedIn()) {
      this.router.navigate([authPath]);
    } else {
      this.router.navigate([guestPath]);
    }
  }

  /**
   * Charger les campagnes actives
   */
  loadCampagnesActives(reset: boolean = true): void {
    if (reset) {
      this.currentPage = 1;
      this.campagnes = [];
    } else {
      this.isLoadingMore = true;
    }

    this.error = null;

    this.recrutementService.getCampagnesActives(this.currentPage, this.itemsPerPage).subscribe({
      next: (response) => {
        if (reset) {
          this.campagnes = response.data;
        } else {
          this.campagnes = [...this.campagnes, ...response.data];
        }

        if (response.pagination) {
          this.totalCampagnes = response.pagination.total;
          this.hasMore = this.currentPage < response.pagination.totalPages;
        } else {
          this.totalCampagnes = response.data.length;
          this.hasMore = response.data.length === this.itemsPerPage;
        }

        this.isLoading = false;
        this.isLoadingMore = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erreur lors du chargement des campagnes:', err);
        // Page publique : on masque l'erreur technique et on affiche "aucune campagne"
        this.campagnes = [];
        this.error = null;
        this.isLoading = false;
        this.isLoadingMore = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Charger plus de campagnes (pagination)
   */
  loadMore(): void {
    if (!this.isLoadingMore && this.hasMore) {
      this.currentPage++;
      this.loadCampagnesActives(false);
    }
  }

  /**
   * Vérifier si une campagne est bientôt ouverte
   */
  isBientot(campagne: Campagne): boolean {
    const dateDebut = new Date(campagne.dateDebut);
    const now = new Date();
    const diffDays = Math.ceil((dateDebut.getTime() - now.getTime()) / (1000 * 3600 * 24));
    return diffDays > 0 && diffDays <= 7;
  }

  /**
   * Vérifier si la date limite approche (moins de 7 jours)
   */
  isDateLimiteProche(campagne: Campagne): boolean {
    const dateFin = new Date(campagne.dateFin);
    const now = new Date();
    const diffDays = Math.ceil((dateFin.getTime() - now.getTime()) / (1000 * 3600 * 24));
    return diffDays > 0 && diffDays <= 7;
  }

  /**
   * Formater la date au format français
   */
  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
}
