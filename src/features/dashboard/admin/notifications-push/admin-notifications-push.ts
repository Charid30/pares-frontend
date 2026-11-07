// admin-notifications-push.ts — Notifications envoyées volontairement par l'admin (2026-11-07) :
// aux candidats, aux agents (tous ou ceux de certaines directions) ou à tout le monde.
// Chaque destinataire la reçoit dans sa cloche et en push sur ses appareils abonnés.
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { ToastService } from '../../../../core/services/toast.service';

type Cible = 'CANDIDATS' | 'AGENTS' | 'TOUS';

interface Apercu { candidats: number; agents: number; appareils: number; pushActif: boolean; }
interface Direction { iddirection: number; nom: string; accronyme: string; }
interface Diffusion {
  id: number; titre: string; message: string; cible: Cible;
  directions: { iddirection: number; nom: string }[];
  nbDestinataires: number; nbAppareils: number; nbPushReussis: number | null; nbPushEchecs: number | null;
  envoyePar: string; createdDate: string;
}

@Component({
  selector: 'app-admin-notifications-push',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-notifications-push.html',
})
export class AdminNotificationsPush implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly confirmService = inject(ConfirmService);
  private readonly toastService = inject(ToastService);
  private readonly apiUrl = `${environment.apiUrl}/admin/notifications-diffusion`;

  readonly TITRE_MAX = 100;
  readonly MESSAGE_MAX = 500;
  readonly cibles: { valeur: Cible; libelle: string; detail: string }[] = [
    { valeur: 'CANDIDATS', libelle: 'Candidats', detail: 'Tous les comptes candidats' },
    { valeur: 'AGENTS', libelle: 'Agents', detail: 'Tous les agents actifs, ou ceux de certaines directions' },
    { valeur: 'TOUS', libelle: 'Tout le monde', detail: 'Candidats et agents' },
  ];

  cible: Cible = 'CANDIDATS';
  directionsChoisies: number[] = [];
  titre = '';
  message = '';

  directions: Direction[] = [];
  apercu: Apercu | null = null;
  chargementApercu = false;
  envoi = false;
  historique: Diffusion[] = [];
  chargementHistorique = true;
  erreurHistorique = '';

  ngOnInit(): void {
    this.http.get<any>(`${environment.apiUrl}/stages/directions`).subscribe({
      next: (res) => { this.directions = res.data || []; this.cdr.detectChanges(); },
      error: () => {},
    });
    this.calculerApercu();
    this.chargerHistorique();
  }

  choisirCible(cible: Cible): void {
    this.cible = cible;
    if (cible === 'CANDIDATS') this.directionsChoisies = [];
    this.calculerApercu();
  }

  basculerDirection(id: number): void {
    this.directionsChoisies = this.directionsChoisies.includes(id)
      ? this.directionsChoisies.filter(d => d !== id)
      : [...this.directionsChoisies, id];
    this.calculerApercu();
  }

  get ciblageAgents(): boolean { return this.cible !== 'CANDIDATS'; }

  get nbDestinataires(): number { return this.apercu ? this.apercu.candidats + this.apercu.agents : 0; }

  get formulaireValide(): boolean {
    const t = this.titre.trim(); const m = this.message.trim();
    return !!t && !!m && t.length <= this.TITRE_MAX && m.length <= this.MESSAGE_MAX && this.nbDestinataires > 0;
  }

  private corps() {
    return { cible: this.cible, directions: this.ciblageAgents ? this.directionsChoisies : [], titre: this.titre, message: this.message };
  }

  calculerApercu(): void {
    this.chargementApercu = true;
    this.http.post<any>(`${this.apiUrl}/apercu`, this.corps()).subscribe({
      next: (res) => { this.apercu = res.data; this.chargementApercu = false; this.cdr.detectChanges(); },
      error: () => { this.apercu = null; this.chargementApercu = false; this.cdr.detectChanges(); },
    });
  }

  chargerHistorique(): void {
    this.http.get<any>(this.apiUrl).subscribe({
      next: (res) => { this.historique = res.data || []; this.chargementHistorique = false; this.cdr.detectChanges(); },
      error: (err) => {
        this.erreurHistorique = err.error?.message || 'Impossible de charger l\'historique';
        this.chargementHistorique = false;
        this.cdr.detectChanges();
      },
    });
  }

  libelleDestinataires(): string {
    const a = this.apercu;
    if (!a) return '';
    const parties = [];
    if (this.cible !== 'AGENTS') parties.push(`${a.candidats} candidat(s)`);
    if (this.cible !== 'CANDIDATS') parties.push(`${a.agents} agent(s)`);
    return parties.join(' et ');
  }

  async envoyer(): Promise<void> {
    if (!this.formulaireValide || this.envoi) return;
    const directions = this.directionsChoisies.length
      ? ` des directions ${this.directions.filter(d => this.directionsChoisies.includes(d.iddirection)).map(d => d.accronyme || d.nom).join(', ')}`
      : '';
    if (!(await this.confirmService.demander({
      titre: 'Envoyer la notification',
      message: `« ${this.titre.trim()} » sera envoyée à ${this.libelleDestinataires()}${directions}, dans leur cloche et en push. L'envoi ne peut pas être annulé.`,
      detail: this.message.trim(),
      confirmer: 'Envoyer',
    }))) return;

    this.envoi = true;
    this.http.post<any>(this.apiUrl, this.corps()).subscribe({
      next: (res) => {
        this.envoi = false;
        this.toastService.succes(res.message || 'Notification envoyée');
        this.titre = ''; this.message = '';
        this.chargerHistorique();
        this.cdr.detectChanges();
        // Bilan des push complété en arrière-plan par le serveur
        setTimeout(() => this.chargerHistorique(), 8000);
      },
      error: (err) => {
        this.envoi = false;
        this.toastService.erreur(err.error?.message || 'Échec de l\'envoi');
        this.cdr.detectChanges();
      },
    });
  }

  libelleCible(d: Diffusion): string {
    const base = this.cibles.find(c => c.valeur === d.cible)?.libelle || d.cible;
    return d.directions.length ? `${base} — ${d.directions.map(x => x.nom).join(', ')}` : base;
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
