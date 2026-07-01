// src/app/core/services/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

export interface UserPermission {
  module: string;
  action: string;
}

export interface UserRoleInfo {
  idrole: number;
  accronyme: string;
  description: string;
  lectureGlobale?: boolean;
}

export interface UserDirectionInfo {
  iddirection: number;
  nom: string;
  accronyme: string;
}

export interface User {
  idusers: number;
  username: string;
  email?: string;
  nom?: string;
  prenom?: string;
  genre?: string;
  matricule?: string;
  role: string;        // rôle principal (rétro-compat)
  roleId?: number;     // id principal (rétro-compat)
  roleDescription?: string;
  roles?: UserRoleInfo[]; // tous les rôles (principal + additionnels)
  permissions?: UserPermission[];
  candidatId?: number;
  agentId?: number;
  directions?: UserDirectionInfo[]; // direction(s) de l'agent connecté (via son service)
  lectureGlobaleModules?: string[]; // modules pour lesquels un rôle lectureGlobale donne CONSULTER
  globalActionPermissions?: UserPermission[]; // permissions d'action uniquement via rôle lectureGlobale
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: User;
  };
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  nom: string;
  prenom: string;
  genre: string;
  telephone: string;
  nip: string;
  ifu?: string;
  recipisse?: string;
}

// Rôles système avec layout dédié (tous les autres → /dashboard/agent)
export const SYSTEM_AGENT_ROLES = ['ADMIN'];

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private tokenExpiryTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Fix #2 : token uniquement en mémoire (jamais en localStorage) ──────────
  // Le token JWT est posé côté serveur dans un cookie HttpOnly inaccessible à JS.
  // On garde une copie en mémoire uniquement pour la durée de la session courante
  // (perdue au rechargement → le cookie prend le relais automatiquement).
  private tokenInMemory: string | null = null;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.loadUserFromStorage();
  }

  // ── Fix #5 : décodage JWT sécurisé ────────────────────────────────────────
  // Vérifie que le token a bien 3 parties avant tout décodage.
  private decodeJwtPayload(token: string): Record<string, any> | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
      return JSON.parse(atob(parts[1]));
    } catch {
      return null;
    }
  }

  /**
   * Connexion
   */
  login(username: string, password: string, rememberMe = false): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, { username, password, rememberMe }, { withCredentials: true }).pipe(
      tap(response => {
        if (response.success) {
          this.setSession(response.data.token, response.data.user);
        }
      })
    );
  }

  /**
   * Inscription
   */
  register(data: RegisterData): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/register`, data, { withCredentials: true }).pipe(
      tap(response => {
        if (response.success) {
          this.setSession(response.data.token, response.data.user);
        }
      })
    );
  }

  /**
   * Rafraîchir les permissions depuis le serveur
   */
  refreshUser(): Observable<void> {
    return this.http.get<any>(`${this.apiUrl}/profile`).pipe(
      tap((response) => {
        if (response.success && response.data?.permissions) {
          const current = this.currentUserSubject.value;
          if (current) {
            const updated: User = {
              ...current,
              permissions: response.data.permissions,
              roles: response.data.roles ?? current.roles,
              directions: response.data.directions ?? current.directions,
              lectureGlobaleModules: response.data.lectureGlobaleModules ?? current.lectureGlobaleModules,
              globalActionPermissions: response.data.globalActionPermissions ?? current.globalActionPermissions,
            };
            localStorage.setItem('user', JSON.stringify(updated));
            this.currentUserSubject.next(updated);
          }
        }
      }),
      map(() => void 0),
    );
  }

  /**
   * Vérifier si un email existe pour réinitialisation de mot de passe
   */
  checkEmailForReset(email: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/forgot-password`, { email });
  }

  /**
   * Réinitialiser le mot de passe via token (lien email)
   */
  resetPassword(token: string, newPassword: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/reset-password`, { token, newPassword });
  }

  /**
   * Déconnexion manuelle → invalide le token côté serveur + efface le cookie + redirige
   */
  logout(): void {
    // Le cookie est envoyé automatiquement (withCredentials), le backend le révoque et l'efface
    this.http.post(`${this.apiUrl}/logout`, {}, { withCredentials: true }).subscribe({ error: () => {} });
    this.clearSession();
    this.router.navigate(['/accueil']);
  }

  /**
   * Déconnexion automatique (token expiré / 401)
   */
  logoutExpired(): void {
    this.clearSession();
    if (!this.router.url.startsWith('/auth')) {
      this.router.navigate(['/auth/login']);
    }
  }

  /**
   * Vérifier si l'utilisateur est connecté (basé sur l'expiry stockée + user en mémoire)
   */
  isLoggedIn(): boolean {
    const expStr = localStorage.getItem('tokenExpiry');
    if (!expStr) return false;
    const exp = parseInt(expStr, 10);
    if (exp * 1000 < Date.now()) {
      this.clearSession();
      return false;
    }
    return !!this.currentUserSubject.value;
  }

  /**
   * Obtenir le token en mémoire (null après rechargement — le cookie prend le relais)
   */
  getToken(): string | null {
    return this.tokenInMemory;
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  updateCurrentUser(user: User): void {
    localStorage.setItem('user', JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  /** Tous les acronymes de rôle de l'utilisateur (principal + additionnels), avec repli rétro-compat. */
  getUserRoleAccronymes(user = this.getCurrentUser()): string[] {
    if (!user) return [];
    if (Array.isArray(user.roles) && user.roles.length) {
      return user.roles.map(r => r.accronyme);
    }
    return user.role ? [user.role] : [];
  }

  /** L'utilisateur possède-t-il un rôle ADMIN (principal ou additionnel) ? */
  private isAdminUser(user = this.getCurrentUser()): boolean {
    return this.getUserRoleAccronymes(user).includes('ADMIN');
  }

  hasRole(role: string): boolean {
    return this.getUserRoleAccronymes().includes(role);
  }

  hasAnyRole(roles: string[]): boolean {
    const userRoles = this.getUserRoleAccronymes();
    return userRoles.some(r => roles.includes(r));
  }

  hasPermission(module: string, action: string): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;
    if (this.isAdminUser(user)) return true;
    if (!user.permissions) return false;
    return user.permissions.some(p => p.module === module && p.action === action);
  }

  hasModuleAccess(module: string): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;
    if (this.isAdminUser(user)) return true;
    if (!user.permissions) return false;
    return user.permissions.some(p => p.module === module);
  }

  getAccessibleModules(): string[] {
    const user = this.getCurrentUser();
    if (!user) return [];
    if (this.isAdminUser(user)) return ['CANDIDATURES', 'CANDIDATS', 'STAGE', 'SUIVI_STAGE', 'SUSPENSION_STAGE', 'OFFRE', 'AIDE', 'DEMANDE_AUDIENCE', 'AGENTS', 'SERVICES'];
    if (!user.permissions) return [];
    return Array.from(new Set(user.permissions.map(p => p.module)));
  }

  /**
   * Rôle "lecture globale" (sous-admin) sur ce module : reflète exactement
   * hasGlobalReadAccess() côté backend — utilisé pour distinguer un menu
   * "vue globale" lecture seule d'un menu d'action limité à la direction de l'agent.
   */
  hasLectureGlobale(module: string): boolean {
    return !!this.getCurrentUser()?.lectureGlobaleModules?.includes(module);
  }

  /**
   * Permission d'action accordée via un rôle lectureGlobale uniquement.
   * À utiliser sur les écrans "Vue globale" (scope=global) pour ne pas laisser
   * fuiter les permissions du rôle d'action classique (ex. APPROUVER de "Approbateur de stage")
   * sur des stages hors direction.
   */
  hasGlobalPermission(module: string, action: string): boolean {
    return !!this.getCurrentUser()?.globalActionPermissions?.some(
      p => p.module === module && p.action === action
    );
  }

  /** Direction(s) associée(s) au service de l'agent connecté. */
  getUserDirections(): UserDirectionInfo[] {
    return this.getCurrentUser()?.directions || [];
  }

  /** Accronyme de la première direction de l'agent connecté, s'il y en a une. */
  getUserDirectionAccronyme(): string | null {
    return this.getUserDirections()[0]?.accronyme || null;
  }

  isSystemRole(): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;
    const accronymes = this.getUserRoleAccronymes(user);
    return accronymes.some(r => SYSTEM_AGENT_ROLES.includes(r)) || accronymes.includes('CANDIDAT');
  }

  /**
   * Détermine le rôle déterminant le dashboard/layout, en tenant compte des rôles multiples.
   * Priorité : ADMIN (si présent) > CANDIDAT > rôle principal (agent générique).
   */
  getEffectiveDashboardRole(user = this.getCurrentUser()): string {
    if (!user) return '';
    const accronymes = this.getUserRoleAccronymes(user);
    if (accronymes.includes('ADMIN')) return 'ADMIN';
    if (accronymes.includes('CANDIDAT')) return 'CANDIDAT';
    return user.role || accronymes[0] || '';
  }

  // ── Session ────────────────────────────────────────────────────────────────

  private setSession(token: string, user: User): void {
    // Token uniquement en mémoire (le cookie HttpOnly est posé par le serveur)
    this.tokenInMemory = token;
    // Données utilisateur en localStorage (non sensibles)
    localStorage.setItem('user', JSON.stringify(user));
    // Expiry en localStorage pour isLoggedIn() après rechargement (pas le token lui-même)
    const payload = this.decodeJwtPayload(token);
    if (payload?.['exp']) {
      localStorage.setItem('tokenExpiry', String(payload['exp']));
    }
    this.currentUserSubject.next(user);
    this.scheduleTokenExpiry(token);
  }

  private loadUserFromStorage(): void {
    const expStr = localStorage.getItem('tokenExpiry');
    const userJson = localStorage.getItem('user');
    if (!expStr || !userJson) return;

    const exp = parseInt(expStr, 10);
    if (exp * 1000 < Date.now()) {
      // Expiry dépassée au démarrage → nettoyer silencieusement
      localStorage.removeItem('user');
      localStorage.removeItem('tokenExpiry');
      return;
    }

    try {
      const user = JSON.parse(userJson);
      this.currentUserSubject.next(user);
      // Programmer le logout automatique même sans token en mémoire
      const msUntilExpiry = exp * 1000 - Date.now();
      if (msUntilExpiry > 0) {
        this.tokenExpiryTimer = setTimeout(() => this.logoutExpired(), msUntilExpiry);
      }
    } catch {
      localStorage.removeItem('user');
      localStorage.removeItem('tokenExpiry');
    }
  }

  private scheduleTokenExpiry(token: string): void {
    if (this.tokenExpiryTimer) clearTimeout(this.tokenExpiryTimer);
    const payload = this.decodeJwtPayload(token);
    if (!payload) return;
    const msUntilExpiry = payload['exp'] * 1000 - Date.now();
    if (msUntilExpiry > 0) {
      this.tokenExpiryTimer = setTimeout(() => this.logoutExpired(), msUntilExpiry);
    }
  }

  private clearSession(): void {
    if (this.tokenExpiryTimer) {
      clearTimeout(this.tokenExpiryTimer);
      this.tokenExpiryTimer = null;
    }
    this.tokenInMemory = null;
    localStorage.removeItem('user');
    localStorage.removeItem('tokenExpiry');
    this.currentUserSubject.next(null);
  }
}
