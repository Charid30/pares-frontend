import {
  Component, OnInit, AfterViewInit,
  ElementRef, ViewChild,
  ChangeDetectorRef, NgZone
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { FinancierService, Aide } from "../../../../core/services/financier.service";
import { DashboardService, MainStats } from "../../../../core/services/dashboard.service";
import { AuthService } from "../../../../core/services/auth.service";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

@Component({
  selector: "app-financier-dashboard",
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: "./financier-dashboard.html",
  styleUrls: ["./financier-dashboard.css"],
})
export class FinancierDashboard implements OnInit, AfterViewInit {
  @ViewChild("chartCanvas") chartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild("donutCanvas") donutCanvas!: ElementRef<HTMLCanvasElement>;

  currentUser: any = null;
  today = new Date();
  chart: Chart | null = null;
  donutChart: Chart | null = null;

  loadingStats = true;
  loadingAides = true;
  error: string | null = null;

  mainStats: MainStats | null = null;

  // Aides depuis /api/aides
  aides: Aide[] = [];
  recentAides: Aide[] = [];
  pendingAides: Aide[] = [];

  // Stats calculées depuis les aides
  aidesActives = 0;
  aidesEnAttente = 0;
  aidesCloturees = 0;
  beneficiairesTotal = 0;
  aidesAdmin = 0;
  aidesCandidat = 0;
  tauxValidation = 0;

  // Données graphiques
  chartLabels: string[] = [];
  chartAidesData: number[] = [];
  chartBeneficiairesData: number[] = [];
  donutData: number[] = [0, 0, 0, 0];

  readonly donutLabels = ["Actives", "En attente", "Clôturées", "Brouillon"];
  readonly MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

  constructor(
    private financierService: FinancierService,
    private dashboardService: DashboardService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadStats();
    this.loadAides();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initCharts();
    }, 200);
  }

  get greeting(): string {
    const h = this.today.getHours();
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon après-midi";
    return "Bonsoir";
  }

  loadStats(): void {
    this.loadingStats = true;
    this.dashboardService.getMainStats().subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) this.mainStats = res.data;
          this.loadingStats = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.loadingStats = false;
          this.error = err.status === 403
            ? "Accès refusé (403) — Vérifiez les permissions du compte."
            : "Impossible de charger les statistiques.";
          this.cdr.detectChanges();
        });
      }
    });
  }

  loadAides(): void {
    this.loadingAides = true;
    this.financierService.getAllAides({}).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          if (res.success) {
            this.aides = res.data;
            this.processAides(res.data);
          }
          this.loadingAides = false;
          this.cdr.detectChanges();
          this.updateCharts();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          console.error("Erreur chargement aides:", err);
          this.loadingAides = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  refreshData(): void {
    this.error = null;
    this.loadStats();
    this.loadAides();
  }

  private processAides(aides: Aide[]): void {
    this.aidesActives   = aides.filter(a => a.statusAide === "ACTIVE").length;
    this.aidesEnAttente = aides.filter(a => a.statusAide === "EN_ATTENTE" || a.statusAide === "EN_TRAITEMENT").length;
    this.aidesCloturees = aides.filter(a => a.statusAide === "CLOTUREE").length;
    this.beneficiairesTotal = aides.reduce((sum, a) => sum + (a.nombreBeneficiairesActuels || 0), 0);

    this.aidesAdmin    = aides.filter(a => a.creePar === "ADMIN").length;
    this.aidesCandidat = aides.filter(a => a.creePar === "CANDIDAT").length;

    const validees = aides.filter(a => a.statusAide === "VALIDEE").length;
    this.tauxValidation = aides.length > 0 ? Math.round((validees / aides.length) * 100) : 0;

    const brouillon = aides.filter(a => a.statusAide === "BROUILLON").length;
    this.donutData = [this.aidesActives, this.aidesEnAttente, this.aidesCloturees, brouillon];

    const sorted = [...aides].sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
    this.recentAides  = sorted.slice(0, 8);
    this.pendingAides = aides
      .filter(a => a.statusAide === "EN_ATTENTE" || a.statusAide === "EN_TRAITEMENT")
      .sort((a, b) => new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime())
      .slice(0, 6);

    this.buildChartData(aides);
  }

  private buildChartData(aides: Aide[]): void {
    const now = new Date();
    const labels: string[] = [], aidesCount: number[] = [], benefCount: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(this.MONTHS[d.getMonth()]);
      const duMois = aides.filter(a => {
        const c = new Date(a.createdDate);
        return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth();
      });
      aidesCount.push(duMois.length);
      benefCount.push(duMois.reduce((sum, a) => sum + (a.nombreBeneficiairesActuels || 0), 0));
    }
    this.chartLabels = labels;
    this.chartAidesData = aidesCount;
    this.chartBeneficiairesData = benefCount;
  }

  private initCharts(): void {
    this.initLineChart();
    this.initDonutChart();
  }

  private updateCharts(): void {
    if (this.chart) {
      this.chart.data.labels = this.chartLabels;
      this.chart.data.datasets[0].data = this.chartAidesData;
      this.chart.data.datasets[1].data = this.chartBeneficiairesData;
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
            label: "Aides créées",
            data: this.chartAidesData.length > 0 ? this.chartAidesData : [0,0,0,0,0,0],
            borderColor: "#10B981", backgroundColor: "rgba(16,185,129,0.1)",
            fill: true, tension: 0.4, pointRadius: 4, pointHoverRadius: 6,
            pointBackgroundColor: "#10B981", pointBorderColor: "#fff", pointBorderWidth: 2
          },
          {
            label: "Bénéficiaires",
            data: this.chartBeneficiairesData.length > 0 ? this.chartBeneficiairesData : [0,0,0,0,0,0],
            borderColor: "#6366F1", backgroundColor: "rgba(99,102,241,0.1)",
            fill: true, tension: 0.4, pointRadius: 4, pointHoverRadius: 6,
            pointBackgroundColor: "#6366F1", pointBorderColor: "#fff", pointBorderWidth: 2
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
          backgroundColor: ["#10B981", "#F97316", "#6B7280", "#9CA3AF"],
          borderColor: ["#fff", "#fff", "#fff", "#fff"],
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

  // ── Helpers
  getLastMonths(count: number): string[] {
    const result: string[] = [];
    const now = new Date();
    for (let i = count - 1; i >= 0; i--) {
      result.push(this.MONTHS[new Date(now.getFullYear(), now.getMonth() - i, 1).getMonth()]);
    }
    return result;
  }

  getTotalAides(): number {
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
    return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
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
    return creePar === "ADMIN" ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700";
  }
}
