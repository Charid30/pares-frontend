import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DashboardService, RecentActivity } from '../../../../core/services/dashboard.service';
import { SearchService } from '../../../../core/services/search.service';

@Component({
  selector: 'app-activites',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, DatePipe],
  templateUrl: './activites.html',
})
export class Activites implements OnInit, OnDestroy {

  activities: RecentActivity[] = [];
  filtered: RecentActivity[] = [];
  paginated: RecentActivity[] = [];
  isLoading = true;
  errorMessage = '';

  // Pagination
  currentPage = 1;
  pageSize    = 15;

  get totalPages(): number { return Math.ceil(this.filtered.length / this.pageSize); }
  get totalItems():  number { return this.filtered.length; }
  get startIndex():  number { return (this.currentPage - 1) * this.pageSize + 1; }
  get endIndex():    number { return Math.min(this.currentPage * this.pageSize, this.filtered.length); }

  get pages(): number[] {
    const total = this.totalPages;
    const cur   = this.currentPage;
    const delta = 2;
    const range: number[] = [];
    for (let i = Math.max(1, cur - delta); i <= Math.min(total, cur + delta); i++) range.push(i);
    return range;
  }

  // Filtres locaux (type + période) — la recherche texte vient du header global
  filtreType    = '';
  filtrePeriode = '30';
  searchTerm    = ''; // alimenté par SearchService

  private searchSub?: Subscription;

  readonly TYPES = [
    { value: '',             label: 'Tous les types' },
    { value: 'candidat',    label: 'Inscriptions'   },
    { value: 'stage',       label: 'Stages'         },
    { value: 'recrutement', label: 'Recrutements'   },
    { value: 'offre',       label: 'Offres'         },
    { value: 'aide',        label: 'Aides'          },
  ];

  readonly PERIODES = [
    { value: '7',  label: '7 derniers jours'  },
    { value: '30', label: '30 derniers jours' },
    { value: '60', label: '60 derniers jours' },
    { value: '90', label: '90 derniers jours' },
  ];

  constructor(
    private dashboardService: DashboardService,
    private searchService: SearchService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // S'abonner à la barre de recherche globale du header
    this.searchSub = this.searchService.term$.subscribe(term => {
      this.searchTerm = term;
      this.appliquerFiltres();
    });
    this.charger();
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  charger(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.dashboardService.getRecentActivities(200, parseInt(this.filtrePeriode)).subscribe({
      next: (res) => {
        if (res.success) {
          this.activities = res.data.map(a => ({ ...a, date: new Date(a.date) }));
          this.appliquerFiltres();
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Erreur lors du chargement des activités';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  appliquerFiltres(): void {
    this.filtered = this.activities.filter(a => {
      const matchType   = !this.filtreType  || a.type === this.filtreType;
      const matchSearch = !this.searchTerm  ||
        a.description.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        a.user.toLowerCase().includes(this.searchTerm.toLowerCase())        ||
        a.action.toLowerCase().includes(this.searchTerm.toLowerCase());
      return matchType && matchSearch;
    });
    this.currentPage = 1; // retour page 1 à chaque filtre
    this.paginer();
    this.cdr.detectChanges();
  }

  paginer(): void {
    const start = (this.currentPage - 1) * this.pageSize;
    this.paginated = this.filtered.slice(start, start + this.pageSize);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.paginer();
    this.cdr.detectChanges();
  }

  onPeriodeChange(): void { this.charger(); }

  getTypeLabel(type: string): string {
    return this.TYPES.find(t => t.value === type)?.label || type;
  }

  getTypeColor(type: string): string {
    const map: Record<string, string> = {
      candidat:    'bg-blue-100 text-blue-700',
      stage:       'bg-amber-100 text-amber-700',
      recrutement: 'bg-primary-100 text-primary-700',
      offre:       'bg-secondary-100 text-secondary-700',
      aide:        'bg-purple-100 text-purple-700',
    };
    return map[type] || 'bg-gray-100 text-gray-600';
  }

  getTypeIcon(type: string): string {
    const map: Record<string, string> = {
      candidat:    'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
      stage:       'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
      recrutement: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
      offre:       'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
      aide:        'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
    };
    return map[type] || 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
  }

  getStatusClass(status: string | null): string {
    if (!status) return '';
    const map: Record<string, string> = {
      EN_ATTENTE: 'bg-amber-50 text-amber-700 border border-amber-200',
      EN_COURS:   'bg-blue-50 text-blue-700 border border-blue-200',
      ACCEPTE:    'bg-green-50 text-green-700 border border-green-200',
      REJETE:     'bg-red-50 text-red-700 border border-red-200',
      SOUMISE:    'bg-indigo-50 text-indigo-700 border border-indigo-200',
      TERMINE:    'bg-gray-50 text-gray-600 border border-gray-200',
    };
    return map[status] || 'bg-gray-50 text-gray-500 border border-gray-200';
  }

  getStatusLabel(status: string | null): string {
    if (!status) return '';
    const map: Record<string, string> = {
      EN_ATTENTE: 'En attente', EN_COURS: 'En cours',
      ACCEPTE: 'Accepté', REJETE: 'Rejeté',
      SOUMISE: 'Soumise', TERMINE: 'Terminé',
    };
    return map[status] || status;
  }

  timeAgo(date: Date): string {
    const diff = Date.now() - new Date(date).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return "À l'instant";
    if (m < 60) return `Il y a ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `Il y a ${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7)  return `Il y a ${d}j`;
    return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
