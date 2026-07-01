// app.routes.ts
import { Routes } from '@angular/router';
import { PublicLayout } from '../layouts/public-layout/public-layout';
import { AuthLayout } from '../layouts/auth-layout/auth-layout';
import { authGuard } from '../core/guards/auth-guard';
import { roleGuard } from '../core/guards/role-guard';
import { noAuthGuard } from '../core/guards/no-auth-guard';
import { permissionGuard } from '../core/guards/permission-guard';
import { CandidatLayout } from '../layouts/candidat-layout/candidat-layout';
import { AdminLayout } from '../layouts/admin-layout/admin-layout';
import { AgentLayout } from '../layouts/agent-layout/agent-layout';

export const routes: Routes = [
    // Routes publiques (avec navbar et footer)
    // noAuthGuard : si l'utilisateur est déjà connecté, il est redirigé vers son dashboard
    {
        path: '',
        component: PublicLayout,
        canActivate: [noAuthGuard],
        children: [
            {
                path: '',
                redirectTo: 'accueil',
                pathMatch: 'full'
            },
            {
                path: 'accueil',
                loadComponent: () => import('../features/public/home/home').then(m => m.Home)
            },
            {
                path: 'a-propos',
                loadComponent: () => import('../features/public/about/about').then(m => m.About)
            },
            {
                path: 'services',
                loadComponent: () => import('../features/public/services/services').then(m => m.Services)
            },
            {
                path: 'carrieres',
                loadComponent: () => import('../features/public/careers/careers').then(m => m.Careers)
            },
            {
                path: 'contact',
                loadComponent: () => import('../features/public/contact/contact').then(m => m.Contact)
            },
        ]
    },
    // Routes d'authentification (sans navbar et footer)
    // noAuthGuard : si l'utilisateur est déjà connecté, il est redirigé vers son dashboard
    {
        path: 'auth',
        component: AuthLayout,
        canActivate: [noAuthGuard],
        children: [
            {
                path: 'login',
                loadComponent: () => import('../features/auth/login/login').then(m => m.Login)
            },
            {
                path: 'register',
                loadComponent: () => import('../features/auth/register/register').then(m => m.Register)
            },
            {
                path: 'forgot-password',
                loadComponent: () => import('../features/auth/forgot-password/forgot-password').then(m => m.ForgotPassword)
            },
        ]
    },

    // Routes CANDIDAT (avec navbar simple)
    {
        path: 'dashboard/candidat',
        component: CandidatLayout,
        canActivate: [authGuard, roleGuard],
        data: { roles: ['CANDIDAT'] },
        children: [
            {
                path: '',
                loadComponent: () => import('../features/dashboard/candidat/candidat-dashboard/candidat-dashboard').then(m => m.CandidatDashboard)
            },
            {
                path: 'profil',
                loadComponent: () => import('../features/dashboard/candidat/profil/profil').then(m => m.Profil)
            },
            {
                path: 'documents',
                loadComponent: () => import('../features/dashboard/candidat/documents/documents').then(m => m.Documents)
            },
            {
                path: 'stages',
                loadComponent: () => import('../features/dashboard/candidat/stages/stages').then(m => m.Stages)
            },
            // Opportunités
            {
                path: 'opportunites/offres-commerciales',
                loadComponent: () => import('../features/dashboard/candidat/opportunites/offres-commerciales/offres-commerciales').then(m => m.OffresCommerciales)
            },
            {
                path: 'opportunites/aides-sociales',
                loadComponent: () => import('../features/dashboard/candidat/opportunites/aides-sociales/aides-sociales').then(m => m.AidesSociales)
            },
            {
                path: 'opportunites/demandes-audience',
                loadComponent: () => import('../features/dashboard/candidat/opportunites/demandes-audience/demandes-audience').then(m => m.DemandesAudience)
            },
        ]
    },

    // =====================================================
    // Routes ADMIN (avec sidebar)
    // =====================================================
    {
        path: 'admin',
        component: AdminLayout,
        canActivate: [authGuard, roleGuard],
        data: { roles: ['ADMIN'] },
        children: [
            // Dashboard
            {
                path: 'dashboard',
                loadComponent: () => import('../features/dashboard/admin/admin-dashboard/admin-dashboard').then(m => m.AdminDashboard)
            },
            // Gestion des candidats
            {
                path: 'candidats',
                loadComponent: () => import('../features/dashboard/admin/candidats/candidats-list').then(m => m.CandidatsList)
            },
            // Gestion des stages
            {
                path: 'stages',
                loadComponent: () => import('../features/dashboard/admin/stages/stages-list').then(m => m.StagesList)
            },
            // Suivi des stages en cours
            {
                path: 'suivi-stages',
                loadComponent: () => import('../features/dashboard/admin/stages/stages-suivi').then(m => m.StagesSuivi)
            },
            // Demandes de suspension / annulation de stage
            {
                path: 'suspensions',
                loadComponent: () => import('../features/dashboard/admin/suspensions/suspensions-list').then(m => m.SuspensionsList)
            },
            // Gestion des offres commerciales
            {
                path: 'offres-commerciales',
                loadComponent: () => import('../features/dashboard/admin/offres-commerciales/offres-list').then(m => m.OffresList)
            },
            // Gestion des aides sociales
            {
                path: 'aides-sociales',
                loadComponent: () => import('../features/dashboard/admin/aides-sociales/aides-list').then(m => m.AidesList)
            },
            // Gestion des demandes d'audience
            {
                path: 'audiences',
                loadComponent: () => import('../features/dashboard/admin/audiences/audiences-list').then(m => m.AudiencesList)
            },
            // Gestion des utilisateurs
            {
                path: 'utilisateurs',
                loadComponent: () => import('../features/dashboard/admin/utilisateurs/utilisateurs-list').then(m => m.UtilisateursList)
            },
            // Gestion des services
            {
                path: 'services',
                loadComponent: () => import('../features/dashboard/admin/services/services-list').then(m => m.ServicesList)
            },
            // Gestion des directions
            {
                path: 'directions',
                loadComponent: () => import('../features/dashboard/admin/directions/directions-list').then(m => m.DirectionsList)
            },
            // Gestion des permissions par rôle
            {
                path: 'permissions',
                loadComponent: () => import('../features/dashboard/admin/permissions/permissions-list').then(m => m.PermissionsList)
            },
            // Paramètres
            {
                path: 'parametres',
                loadComponent: () => import('../features/dashboard/admin/parametres/parametres').then(m => m.Parametres)
            },
            // Profil administrateur
            {
                path: 'profil',
                loadComponent: () => import('../features/dashboard/admin/profil/admin-profil').then(m => m.AdminProfil)
            },
            // Page Activités récentes (Voir tout depuis le dashboard)
            {
                path: 'activites',
                loadComponent: () => import('../features/dashboard/admin/activites/activites').then(m => m.Activites)
            },
            // Page Tâches à traiter (Toutes les tâches depuis le dashboard)
            {
                path: 'taches',
                loadComponent: () => import('../features/dashboard/admin/taches/taches').then(m => m.Taches)
            },
            // Journal d'activité (audit logs)
            {
                path: 'audit',
                loadComponent: () => import('../features/dashboard/admin/audit-logs/audit-logs').then(m => m.AuditLogs)
            },
            // Surveillance sécurité (IPs bannies + tentatives d'injection)
            {
                path: 'securite',
                loadComponent: () => import('../features/dashboard/admin/securite/securite').then(m => m.Securite)
            },
            // Redirection par défaut
            {
                path: '',
                redirectTo: 'dashboard',
                pathMatch: 'full'
            }
        ]
    },

    // =====================================================
    // Routes AGENT GÉNÉRIQUE (rôles personnalisés)
    // Menu et accès construits dynamiquement selon permissions
    // =====================================================
    {
        path: 'dashboard/agent',
        component: AgentLayout,
        canActivate: [authGuard],
        children: [
            // Dashboard d'accueil agent
            {
                path: '',
                loadComponent: () => import('../features/dashboard/agent/agent-dashboard/agent-dashboard').then(m => m.AgentDashboard),
            },
            // Module Stage — menu d'action, limité à la direction de l'agent
            {
                path: 'stages',
                canActivate: [permissionGuard],
                data: { module: 'STAGE', scope: 'direction' },
                loadComponent: () => import('../features/dashboard/agent/modules/stage/agent-stage').then(m => m.AgentStage),
            },
            // Module Stage — vue globale (rôle "lecture globale" / sous-admin), 3 écrans dédiés
            {
                path: 'stages-global/en-attente',
                canActivate: [permissionGuard],
                data: { module: 'STAGE', scope: 'global', readOnly: true, statusFilter: 'EN_ATTENTE' },
                loadComponent: () => import('../features/dashboard/agent/modules/stage/agent-stage').then(m => m.AgentStage),
            },
            {
                path: 'stages-global/approuve',
                canActivate: [permissionGuard],
                data: { module: 'STAGE', scope: 'global', readOnly: false, statusFilter: 'PROGRAMMATION_EN_COURS', allowedTransitions: ['ACCEPTE'] },
                loadComponent: () => import('../features/dashboard/agent/modules/stage/agent-stage').then(m => m.AgentStage),
            },
            {
                path: 'stages-global/en-cours',
                canActivate: [permissionGuard],
                data: { module: 'STAGE', scope: 'global', readOnly: true, statusFilter: 'ACCEPTE,EN_COURS' },
                loadComponent: () => import('../features/dashboard/agent/modules/stage/agent-stage').then(m => m.AgentStage),
            },
            {
                path: 'stages-global/termine',
                canActivate: [permissionGuard],
                data: { module: 'STAGE', scope: 'global', readOnly: false, statusFilter: 'RAPPORT_SOUMIS,TERMINE' },
                loadComponent: () => import('../features/dashboard/agent/modules/stage/agent-stage').then(m => m.AgentStage),
            },
            // Module Offres Commerciales
            {
                path: 'offres',
                canActivate: [permissionGuard],
                data: { module: 'OFFRE' },
                loadComponent: () => import('../features/dashboard/agent/modules/offre/agent-offre').then(m => m.AgentOffre),
            },
            // Module Aides Sociales
            {
                path: 'aides',
                canActivate: [permissionGuard],
                data: { module: 'AIDE' },
                loadComponent: () => import('../features/dashboard/agent/modules/aide/agent-aide').then(m => m.AgentAide),
            },
            // Module Candidatures Reçues
            {
                path: 'candidatures',
                canActivate: [permissionGuard],
                data: { module: 'CANDIDATURES' },
                loadComponent: () => import('../features/dashboard/agent/modules/candidatures/agent-candidatures').then(m => m.AgentCandidatures),
            },
            // Module Candidats
            {
                path: 'candidats',
                canActivate: [permissionGuard],
                data: { module: 'CANDIDATS' },
                loadComponent: () => import('../features/dashboard/agent/modules/candidats/agent-candidats').then(m => m.AgentCandidats),
            },
            // Module Suivi des Stages
            {
                path: 'suivi-stages',
                canActivate: [permissionGuard],
                data: { module: 'SUIVI_STAGE' },
                loadComponent: () => import('../features/dashboard/agent/modules/suivi-stage/agent-suivi-stage').then(m => m.AgentSuiviStage),
            },
            // Module Suspensions / Annulations
            {
                path: 'suspensions',
                canActivate: [permissionGuard],
                data: { module: 'SUSPENSION_STAGE' },
                loadComponent: () => import('../features/dashboard/agent/modules/suspensions/agent-suspensions').then(m => m.AgentSuspensions),
            },
            // Module Demandes d'Audience
            {
                path: 'audiences',
                canActivate: [permissionGuard],
                data: { module: 'DEMANDE_AUDIENCE' },
                loadComponent: () => import('../features/dashboard/agent/modules/audience/agent-audience').then(m => m.AgentAudience),
            },
            // Module Agents
            {
                path: 'agents',
                canActivate: [permissionGuard],
                data: { module: 'AGENTS' },
                loadComponent: () => import('../features/dashboard/agent/modules/agents/agent-agents').then(m => m.AgentAgents),
            },
            // Module Services
            {
                path: 'services',
                canActivate: [permissionGuard],
                data: { module: 'SERVICES' },
                loadComponent: () => import('../features/dashboard/agent/modules/services/agent-services').then(m => m.AgentServices),
            },
            // Fallback
            {
                path: '**',
                redirectTo: '',
                pathMatch: 'full',
            }
        ]
    },

    // Page Accès refusé
    {
        path: 'access-denied',
        loadComponent: () => import('../features/errors/access-denied/access-denied').then(m => m.AccessDenied)
    },
    // Page 404
    {
        path: '**',
        loadComponent: () => import('../features/errors/not-found/not-found').then(m => m.NotFound)
    }
];