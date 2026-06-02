// src/core/models/user.model.ts - Modèles pour les utilisateurs et agents

export interface Role {
  idrole: number;
  accronyme: string;
  description: string;
}

export interface Permission {
  idpermission: number;
  role_idrole: number;
  module: string;
  action: string;
}

export interface ModuleAction {
  key: string;
  label: string;
}

export interface PermissionMeta {
  modules: ModuleAction[];
  actions: ModuleAction[];
}

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

export interface User {
  idusers: number;
  username: string;
  password?: string;
  role_idrole: number;
  role?: Role;
  createdDate?: Date;
  del: number;
}

export interface Agent {
  idagents: number;
  service_idservice: number;
  nom: string;
  prenom: string;
  matricule: string;
  email: string;
  service?: Service;
  users?: User[];
  createdDate?: Date;
  createdBy?: string;
  lastModifiedDate?: Date;
  lastModifiedBy?: string;
  del: number;
}

export interface Service {
  idservice: number;
  accronyme: string;
  description: string;
}

export interface Direction {
  iddirection: number;
  nom: string;
  accronyme: string;
}

// DTOs pour la création
export interface CreateAgentDTO {
  nom: string;
  prenom: string;
  matricule: string;
  email: string;
  service_idservice: number;
  role_idrole: number;
  username: string;
  password: string;
  confirmPassword: string;
}

export interface UpdateAgentDTO {
  nom?: string;
  prenom?: string;
  matricule?: string;
  email?: string;
  service_idservice?: number;
  role_idrole?: number;
}

// Réponse API
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Statistiques utilisateurs
export interface UserStats {
  totalUsers: number;
  totalAgents: number;
  agentsRH: number;
  agentsFinanciers: number;
  agentsCommerciaux: number;
  admins: number;
}
