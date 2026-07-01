// src/core/models/user.model.ts - Modèles pour les utilisateurs et agents

export interface Role {
  idrole: number;
  accronyme: string;
  description: string;
  lectureGlobale?: boolean;
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
  /** Rôles additionnels (table users_roles) — le rôle principal reste role/role_idrole */
  additionalRoles?: Role[];
  createdDate?: Date;
  del: number;
}

export interface Agent {
  idagents: number;
  /** Rattachement : exactement un des deux (service_idservice OU direction_iddirection) */
  service_idservice: number | null;
  direction_iddirection?: number | null;
  nom: string;
  prenom: string;
  matricule: string;
  email: string;
  service?: Service;
  directionDirecte?: Direction;
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
  /** Exactement un des deux doit être fourni */
  service_idservice?: number;
  direction_iddirection?: number;
  /** 1er = rôle principal, suivants = rôles additionnels */
  roleIds: number[];
  username: string;
  password: string;
  confirmPassword: string;
}

export interface UpdateAgentDTO {
  nom?: string;
  prenom?: string;
  matricule?: string;
  email?: string;
  /** Si l'un des deux est fourni, il remplace le rattachement existant en entier */
  service_idservice?: number;
  direction_iddirection?: number;
  /** 1er = rôle principal, suivants = rôles additionnels */
  roleIds?: number[];
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
