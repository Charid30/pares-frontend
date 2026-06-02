import {
  Component, OnInit, AfterViewInit,
  ElementRef, ViewChild,
  ChangeDetectorRef
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { CommercialService, Offre } from "../../../../core/services/commercial.service";
import { DashboardService, MainStats } from "../../../../core/services/dashboard.service";
import { AuthService } from "../../../../core/services/auth.service";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

@Component({
  selector: "app-commercial-dashboard",
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: "./commercial-dashboard.html",
  styleUrls: ["./commercial-dashboard.css"],
})
export class CommercialDashboard implements OnInit, AfterViewInit {
  @ViewChild("chartCanvas") chartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild("donutCanvas") donutCanvas!: ElementRef<HTMLCanvasElement>;

  currentUser: any = null;
  today = new Date();
  chart: Chart | null = null;
  donutChart: Chart | null = null;

  // États de chargement par section (comme stages-suivi)
  loadingStats = true;
  loadingOffres = true;
  error: string | null = null;

  // Stats depuis /api/dashboard/main-stats (accessible AGENT_COMMERCIAL)
  mainStats: MainStats | null = null;

  // Offres depuis /api/offres
  offres: Offre[] = [];
  recentOffres: Offre[] = [];
  pendingOffres: Offre[] = [];

  // Stats calculées localement depuis les offres
  offresActives = 0;
  offresEnAttente = 0;
  offresCloturees = 0;
  candidaturesTotal = 0;
  offresAdmin = 0;
  offresCandidat = 0;
  tauxValidation = 0;

  // Données graphiques
  chartLabels: string[] = [];
  chartOffresData: number[] = [];
  chartCandidaturesData: number[] = [];
  donutData: number[] = [0, 0, 0, 0];

  readonly donutLabels = ["Actives", "En attente", "Clôturées", "Brouillon"];
  readonly MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

  constructor(
    private commercialService: CommercialService,
    private dashboardService: DashboardService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadStats();
    this.loadOffres();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initCharts();
    }, 200);
  }

  get loading(): boolean {
    return this.loadingStats && this.loadingOffres;
  }

  get greeting(): string {
    const h = this.today.getHours();
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon après-midi";
    return "Bonsoir";
  }

  // ── Chargement stats globales (dashboard commun)
  loadStats(): void {
    this.loadingStats = true;
    this.dashboardService.getMainStats().subscribe({
      next: (res) => {
        if (res.success) this.mainStats = res.data;
        this.loadingStats = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loadingStats = false;
        this.error = err.status === 403
          ? 'Accès refusé (403) — Vérifiez les permissions du compte.'
          : 'Impossible de charger les statistiques.';
        this.cdr.detectChanges();
      }
    });
  }

  // ── Chargement liste offres
  loadOffres(): void {
    this.loadingOffres = true;
    this.commercialService.getAllOffres({}).subscribe({
      next: (res) => {
        if (res.success) {
          this.offres = res.data;
          this.processOffres(res.data);
        }
        this.loadingOffres = false;
        this.cdr.detectChanges();
        this.updateCharts();
      },
      error: (err) => {
        console.error("Erreur chargement offres:", err);
        this.loadingOffres = false;
        this.cdr.detectChanges();
      }
    });
  }

  refreshData(): void {
    this.error = null;
    this.loadStats();
    this.loadOffres();
  }

  // ── Calculs locaux à partir de la liste des offres
  private processOffres(offres: Offre[]): void {
    this.offresActives   = offres.filter(o => o.statusOffre === "ACTIVE").length;
    this.offresEnAttente = offres.filter(o => o.statusOffre === "EN_ATTENTE" || o.statusOffre === "EN_TRAITEMENT").length;
    this.offresCloturees = offres.filter(o => o.statusOffre === "CLOTUREE").length;
    this.candidaturesTotal = offres.reduce((sum, o) => sum + (o.nombreCandidaturesActuelles || 0), 0);

    this.offresAdmin    = offres.filter(o => o.creePar === "ADMIN").length;
    this.offresCandidat = offres.filter(o => o.creePar === "CANDIDAT").length;

    const validees = offres.filter(o => o.statusOffre === "VALIDEE").length;
    this.tauxValidation = offres.length > 0 ? Math.round((validees / offres.length) * 100) : 0;

    const brouillon = offres.filter(o => o.statusOffre === "BROUILLON").length;
    this.donutData = [this.offresActives, this.offresEnAttente, this.offresCloturees, brouillon];

    const sorted = [...offres].sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
    this.recentOffres  = sorted.slice(0, 8);
    this.pendingOffres = offres
      .filter(o => o.statusOffre === "EN_ATTENTE" || o.statusOffre === "EN_TRAITEMENT")
      .sort((a, b) => new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime())
      .slice(0, 6);

    this.buildChartData(offres);
  }

  private buildChartData(offres: Offre[]): void {
    const now = new Date();
    const labels: string[] = [], offresCount: number[] = [], candCount: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(this.MONTHS[d.getMonth()]);
      const duMois = offres.filter(o => {
        const c = new Date(o.createdDate);
        return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth();
      });
      offresCount.push(duMois.length);
      candCount.push(duMois.reduce((sum, o) => sum + (o.nombreCandidaturesActuelles || 0), 0));
    }
    this.chartLabels = labels;
    this.chartOffresData = offresCount;
    this.chartCandidaturesData = candCount;
  }

  // ── Graphiques
  private initCharts(): void {
    this.initLineChart();
    this.initDonutChart();
  }

  private updateCharts(): void {
    if (this.chart) {
      this.chart.data.labels = this.chartLabels;
      this.chart.data.datasets[0].data = this.chartOffresData;
      this.chart.data.datasets[1].data = this.chartCandidaturesData;
      this.chart.update();
    }
    if (this.donutChart) {
      this.donutChart.data.datasets[0].data = this.donutData;
      this.donutChart.update();
    }
  }

  private initLineChart(): void {
    if (!this.chartCanvas) return;
    const ctx = this.chartCanvas.nativeElement.getContext("2d");
    if (!ctx) return;
    if (this.chart) { this.chart.destroy(); }
    this.chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: this.chartLabels.length > 0 ? this.chartLabels : this.getLastMonths(6),
        datasets: [
          {
            label: "Offres créées",
            data: this.chartOffresData.length > 0 ? this.chartOffresData : [0,0,0,0,0,0],
            borderColor: "#3B82F6", backgroundColor: "rgba(59,130,246,0.1)",
            fill: true, tension: 0.4, pointRadius: 4, pointHoverRadius: 6,
            pointBackgroundColor: "#3B82F6", pointBorderColor: "#fff", pointBorderWidth: 2
          },
          {
            label: "Candidatures reçues",
            data: this.chartCandidaturesData.length > 0 ? this.chartCandidaturesData : [0,0,0,0,0,0],
            borderColor: "#10B981", backgroundColor: "rgba(16,185,129,0.1)",
            fill: true, tension: 0.4, pointRadius: 4, pointHoverRadius: 6,
            pointBackgroundColor: "#10B981", pointBorderColor: "#fff", pointBorderWidth: 2
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { intersect: false, mode: "index" },
        plugins: {
          legend: { display: true, position: "top", labels: { usePointStyle: true, padding: 20, font: { size: 12 } } },
          tooltip: { backgroundColor: "rgba(17,24,39,0.9)", titleColor: "#fff", bodyColor: "#fff", padding: 12, cornerRadius: 8 },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: "#9CA3AF", font: { size: 11 } } },
          y: { beginAtZero: true, grid: { color: "rgba(156,163,175,0.1)" }, ticks: { color: "#9CA3AF", font: { size: 11 }, stepSize: 1 } },
        },
      },
    });
  }

  private initDonutChart(): void {
    if (!this.donutCanvas) return;
    const ctx = this.donutCanvas.nativeElement.getContext("2d");
    if (!ctx) return;
    if (this.donutChart) { this.donutChart.destroy(); }
    this.donutChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: this.donutLabels,
        datasets: [{
          data: this.donutData,
          backgroundColor: ["#3B82F6","#F97316","#10B981","#9CA3AF"],
          borderColor: ["#fff","#fff","#fff","#fff"],
          borderWidth: 3, hoverOffset: 6
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: "65%",
        plugins: {
          legend: { display: true, position: "bottom", labels: { usePointStyle: true, padding: 16, font: { size: 12 } } },
          tooltip: { backgroundColor: "rgba(17,24,39,0.9)", titleColor: "#fff", bodyColor: "#fff", padding: 12, cornerRadius: 8 },
        },
      },
    });
  }

  // ── Helpers affichage
  getLastMonths(count: number): string[] {
    const result: string[] = [];
    const now = new Date();
    for (let i = count - 1; i >= 0; i--) {
      result.push(this.MONTHS[new Date(now.getFullYear(), now.getMonth() - i, 1).getMonth()]);
    }
    return result;
  }

  getTotalOffres(): number {
    return this.donutData.reduce((sum, v) => sum + v, 0);
  }

  getTimeAgo(dateStr: string): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays === 1) return "Hier";
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      BROUILLON: "Brouillon", EN_ATTENTE: "En attente", EN_TRAITEMENT: "En traitement",
      VALIDEE: "Validée", REJETEE: "Rejetée", ACTIVE: "Active", CLOTUREE: "Clôturée"
    };
    return map[status] || status;
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      ACTIVE:        "bg-green-100 text-green-700",
      EN_ATTENTE:    "bg-orange-100 text-orange-700",
      EN_TRAITEMENT: "bg-blue-100 text-blue-700",
      VALIDEE:       "bg-teal-100 text-teal-700",
      REJETEE:       "bg-red-100 text-red-700",
      CLOTUREE:      "bg-gray-100 text-gray-600",
      BROUILLON:     "bg-gray-100 text-gray-500"
    };
    return map[status] || "bg-gray-100 text-gray-600";
  }

  getCreePar(creePar: string): string {
    return creePar === "ADMIN" ? "Agent" : "Candidat";
  }

  getCreeParClass(creePar: string): string {
    return creePar === "ADMIN" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700";
  }
}
