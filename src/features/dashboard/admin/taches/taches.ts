import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DashboardService, PendingItem } from '../../../../core/services/dashboard.service';
import { SearchService } from '../../../../core/services/search.service';

@Component({
  selector: 'app-taches',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, DatePipe],
  templateUrl: './taches.html',
})
export class Taches implements OnInit, OnDestroy {

  items: PendingItem[] = [];
  filtered: PendingItem[] = [];
  paginated: PendingItem[] = [];
  isLoading = true;
  errorMessage = '';
  searchTerm = '';

  // Filtres
  filtreType     = '';
  filtrePriorite = '';

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

  // Compteurs par priorité
  get countUrgent(): number { return this.items.filter(i => i.priority === 'high').length; }
  get countNormal(): number { return this.items.filter(i => i.priority === 'medium').length; }
  get countFaible(): number { return this.items.filter(i => i.priority === 'low').length; }

  readonly TYPES = [
    { value: '',             label: 'Tous les types'  },
    { value: 'stage',       label: 'Stages'          },
    { value: 'recrutement', label: 'Recrutements'    },
    { value: 'aide',        label: 'Aides sociales'  },
    { value: 'offre',       label: 'Offres'          },
  ];

  readonly PRIORITES = [
    { value: '',       label: 'Toutes priorités' },
    { value: 'high',   label: 'Urgent'           },
    { value: 'medium', label: 'Normal'           },
    { value: 'low',    label: 'Faible'           },
  ];

  private searchSub?: Subscription;

  constructor(
    private dashboardService: DashboardService,
    private searchService: SearchService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
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
    this.dashboardService.getPendingItems(200).subscribe({
      next: (res) => {
        if (res.success) {
          this.items = res.data.map(p => ({ ...p, date: new Date(p.date) }));
          this.appliquerFiltres();
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Erreur lors du chargement des tâches';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  appliquerFiltres(): void {
    this.filtered = this.items.filter(item => {
      const matchType     = !this.filtreType     || item.type     === this.filtreType;
      const matchPriorite = !this.filtrePriorite || item.priority === this.filtrePriorite;
      const matchSearch   = !this.searchTerm     ||
        item.title.toLowerCase().includes(this.searchTerm.toLowerCase())    ||
        item.subtitle.toLowerCase().includes(this.searchTerm.toLowerCase());
      return matchType && matchPriorite && matchSearch;
    });
    this.currentPage = 1;
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

  getRoute(item: PendingItem): string {
    const map: Record<string, string> = {
      stage:       '/admin/stages',
      recrutement: '/admin/recrutements',
      aide:        '/admin/aides-sociales',
      offre:       '/admin/offres-commerciales',
    };
    return map[item.type] || '/admin/dashboard';
  }

  getTypeLabel(type: string): string {
    return this.TYPES.find(t => t.value === type)?.label || type;
  }

  getTypeColor(type: string): string {
    const map: Record<string, string> = {
      stage:       'bg-amber-100 text-amber-700',
      recrutement: 'bg-primary-100 text-primary-700',
      aide:        'bg-purple-100 text-purple-700',
      offre:       'bg-secondary-100 text-secondary-700',
    };
    return map[type] || 'bg-gray-100 text-gray-600';
  }

  getTypeIcon(type: string): string {
    const map: Record<string, string> = {
      stage:       'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
      recrutement: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
      aide:        'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
      offre:       'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    };
    return map[type] || 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
  }

  getPriorityClass(priority: string): string {
    const map: Record<string, string> = {
      high:   'bg-red-100 text-red-700 border border-red-200',
      medium: 'bg-amber-100 text-amber-700 border border-amber-200',
      low:    'bg-green-100 text-green-700 border border-green-200',
    };
    return map[priority] || 'bg-gray-100 text-gray-600 border border-gray-200';
  }

  getPriorityLabel(priority: string): string {
    const map: Record<string, string> = { high: 'Urgent', medium: 'Normal', low: 'Faible' };
    return map[priority] || priority;
  }

  getPriorityDotClass(priority: string): string {
    const map: Record<string, string> = { high: 'bg-red-500', medium: 'bg-amber-400', low: 'bg-green-400' };
    return map[priority] || 'bg-gray-300';
  }

  timeAgo(date: Date | string): string {
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
