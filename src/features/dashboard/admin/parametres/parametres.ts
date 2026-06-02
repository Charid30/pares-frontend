// parametres.ts - PAGE DES PARAMETRES ADMIN
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface Toast {
  id: number;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

interface Tab {
  id: string;
  label: string;
  icon: string;
}

interface Settings {
  general: {
    nomOrganisation: string;
    sigle: string;
    emailContact: string;
    telephone: string;
    adresse: string;
    siteWeb: string;
    boitePostale: string;
  };
  email: {
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string;
    smtpPass: string;
    smtpPassConfigured?: boolean;
    smtpFromName: string;
    notifyStageStatus: boolean;
    notifyNewCampagne: boolean;
    notifyAttestation: boolean;
    notifyRapportValide: boolean;
  };
  stages: {
    dureeMinimale: number;
    dureeMaximale: number;
    maxRenouvellements: number;
    delaiTraitement: number;
    typesStage: string[];
    domainesStage: string[];
  };
  recrutement: {
    delaiReponse: number;
    maxCandidaturesParPersonne: number;
    documentsRequis: string[];
  };
  securite: {
    dureeSession: number;
    maxTentativesConnexion: number;
    longueurMinMotDePasse: number;
    dureeBlocage: number;
  };
}

interface SystemInfo {
  version: string;
  lastUpdate: string;
  apiStatus: 'OK' | 'ERROR';
  dbStatus: 'OK' | 'ERROR';
  stats?: {
    candidats: number;
    stages: number;
    campagnes: number;
    utilisateurs: number;
  };
}

@Component({
  selector: 'app-parametres',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './parametres.html',
  styles: [`
    .toast-enter {
      animation: slideIn 0.3s ease-out;
    }
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `]
})
export class Parametres implements OnInit {
  private apiUrl = environment.apiUrl;

  loading = false;
  saving = false;
  changingPassword = false;
  activeTab = 'general';
  toasts: Toast[] = [];
  private toastCounter = 0;

  tabs: Tab[] = [
    { id: 'general', label: 'Général', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { id: 'emails', label: 'Emails', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    { id: 'stages', label: 'Stages', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { id: 'recrutement', label: 'Recrutement', icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    { id: 'securite', label: 'Sécurité', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
    { id: 'systeme', label: 'Système', icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01' }
  ];

  // Paramètres par défaut
  settings: Settings = {
    general: {
      nomOrganisation: 'Société Nationale Burkinabè d\'Hydrocarbures',
      sigle: 'SONABHY',
      emailContact: 'contact@sonabhy.bf',
      telephone: '+226 25 30 65 00',
      adresse: '01 BP 439 Ouagadougou 01, Burkina Faso',
      siteWeb: 'https://www.sonabhy.bf',
      boitePostale: 'BP 439 Ouagadougou 01'
    },
    email: {
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: '',
      smtpPass: '',
      smtpFromName: 'SONABHY Portail',
      notifyStageStatus: true,
      notifyNewCampagne: true,
      notifyAttestation: true,
      notifyRapportValide: true
    },
    stages: {
      dureeMinimale: 1,
      dureeMaximale: 6,
      maxRenouvellements: 1,
      delaiTraitement: 7,
      typesStage: ['Stage de soutenance', 'Stage de perfectionnement'],
      domainesStage: [
        'Direction Générale',
        'Direction des Ressources Humaines',
        'Direction Financière et Comptable',
        'Direction Commerciale',
        'Direction des Opérations',
        'Direction des Systèmes d\'Information',
        'Direction Juridique',
        'Direction de l\'Audit Interne',
        'Direction de la Communication'
      ]
    },
    recrutement: {
      delaiReponse: 30,
      maxCandidaturesParPersonne: 3,
      documentsRequis: [
        'Curriculum Vitae (CV)',
        'Lettre de motivation',
        'Copie des diplômes',
        'Copie de la pièce d\'identité',
        'Certificats de travail'
      ]
    },
    securite: {
      dureeSession: 24,
      maxTentativesConnexion: 5,
      longueurMinMotDePasse: 8,
      dureeBlocage: 30
    }
  };

  // Backup pour annuler
  private settingsBackup: Settings | null = null;

  passwordForm = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  systemInfo: SystemInfo = {
    version: '1.0.1',
    lastUpdate: '13/02/2026',
    apiStatus: 'OK',
    dbStatus: 'OK',
    stats: {
      candidats: 0,
      stages: 0,
      campagnes: 0,
      utilisateurs: 0
    }
  };

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadSettings();
    this.loadSystemInfo();
  }

  loadSettings(): void {
    this.loading = true;
    this.http.get<any>(`${this.apiUrl}/admin/settings`).subscribe({
      next: (r) => {
        if (r.success && r.data) {
          this.settings = { ...this.settings, ...r.data };
        }
        this.settingsBackup = JSON.parse(JSON.stringify(this.settings));
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        // Conserver les valeurs par défaut si l'API échoue
        this.settingsBackup = JSON.parse(JSON.stringify(this.settings));
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  loadSystemInfo(): void {
    // Vérifier le statut de l'API
    this.http.get(`${this.apiUrl}/health`).subscribe({
      next: () => {
        this.systemInfo.apiStatus = 'OK';
        this.systemInfo.dbStatus = 'OK';
        this.cdr.detectChanges();
      },
      error: () => {
        this.systemInfo.apiStatus = 'ERROR';
        this.cdr.detectChanges();
      }
    });

    // Charger les statistiques
    this.http.get<any>(`${this.apiUrl}/admin/dashboard/stats`).subscribe({
      next: (response) => {
        if (response.success) {
          this.systemInfo.stats = {
            candidats: response.data.candidats?.total || 0,
            stages: response.data.stages?.total || 0,
            campagnes: response.data.recrutements?.campagnesActives || 0,
            utilisateurs: response.data.utilisateurs?.total || 0
          };
          this.cdr.detectChanges();
        }
      },
      error: () => {}
    });
  }

  saveSettings(): void {
    this.saving = true;
    this.http.put<any>(`${this.apiUrl}/admin/settings`, this.settings).subscribe({
      next: (r) => {
        this.settingsBackup = JSON.parse(JSON.stringify(this.settings));
        this.saving = false;
        this.showToast('success', 'Succès', r.message || 'Les paramètres ont été sauvegardés');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.saving = false;
        this.showToast('error', 'Erreur', err.error?.message || 'Erreur lors de la sauvegarde');
        this.cdr.detectChanges();
      },
    });
  }

  resetSettings(): void {
    if (this.settingsBackup) {
      this.settings = JSON.parse(JSON.stringify(this.settingsBackup));
      this.showToast('info', 'Annulé', 'Les modifications ont été annulées');
    }
  }

  changePassword(): void {
    if (!this.passwordForm.currentPassword || !this.passwordForm.newPassword || !this.passwordForm.confirmPassword) {
      this.showToast('error', 'Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    if (this.passwordForm.newPassword !== this.passwordForm.confirmPassword) {
      this.showToast('error', 'Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    if (this.passwordForm.newPassword.length < this.settings.securite.longueurMinMotDePasse) {
      this.showToast('error', 'Erreur', `Le mot de passe doit contenir au moins ${this.settings.securite.longueurMinMotDePasse} caractères`);
      return;
    }

    this.changingPassword = true;
    this.http.put<any>(`${this.apiUrl}/admin/settings/change-password`, this.passwordForm).subscribe({
      next: (r) => {
        this.changingPassword = false;
        this.passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
        this.showToast('success', 'Succès', r.message || 'Votre mot de passe a été modifié');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.changingPassword = false;
        this.showToast('error', 'Erreur', err.error?.message || 'Erreur lors du changement de mot de passe');
        this.cdr.detectChanges();
      },
    });
  }

  // === Toast notifications ===
  showToast(type: 'success' | 'error' | 'info', title: string, message: string): void {
    const toast: Toast = {
      id: ++this.toastCounter,
      type,
      title,
      message
    };
    this.toasts.push(toast);

    setTimeout(() => this.removeToast(toast.id), 5000);
  }

  removeToast(id: number): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }
}
