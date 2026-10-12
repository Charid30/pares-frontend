// admin-db-explorer.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface QueryResult {
  rows: Record<string, any>[];
  rowCount: number;
  columns: string[];
  truncated: boolean;
  affectedRows: number | null;
  query: string;
}

const DESTRUCTIVE = /^\s*(DELETE|DROP|TRUNCATE|ALTER|UPDATE)\b/i;

@Component({
  selector: 'app-admin-db-explorer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-db-explorer.html',
})
export class AdminDbExplorer implements OnInit {
  private api = environment.apiUrl;

  tables: string[] = [];
  sqlInput = '';
  result: QueryResult | null = null;
  errorMsg = '';
  loading = false;
  loadingTables = false;
  queryHistory: string[] = [];

  presets = [
    {
      label: 'Renouvellements en attente',
      sql: "SELECT rs.idrenouvellement_stage, rs.statusRenouvellement, rs.dureeDemandee, rs.dateRenouvellement,\n  s.idstage, s.statusStage, c.nom, c.prenom, c.email\nFROM renouvellement_stage rs\nJOIN stage s ON s.idstage = rs.stage_actuel_idstage\nJOIN candidats c ON c.idcandidats = s.candidats_idcandidats\nWHERE rs.del = 0\nORDER BY rs.dateRenouvellement DESC",
    },
    {
      label: 'Tous les renouvellements',
      sql: "SELECT * FROM renouvellement_stage WHERE del = 0 ORDER BY dateRenouvellement DESC",
    },
    {
      label: 'Stages EN_ATTENTE',
      sql: "SELECT idstage, statusStage, dateDepot, nomMaitreStage, candidats_idcandidats, estRenouvellement\nFROM stage\nWHERE statusStage = 'EN_ATTENTE' AND del = 0\nORDER BY dateDepot DESC",
    },
    {
      label: 'Stages EN_COURS',
      sql: "SELECT idstage, statusStage, dateDebut, dateFin, nomMaitreStage, candidats_idcandidats\nFROM stage\nWHERE statusStage = 'EN_COURS' AND del = 0\nORDER BY dateDebut DESC",
    },
    {
      label: 'Liste des candidats',
      sql: "SELECT idcandidats, nom, prenom, email, telephone, createdAt\nFROM candidats\nORDER BY createdAt DESC",
    },
    {
      label: 'Agents / Utilisateurs',
      sql: "SELECT u.idagents, u.username, u.email, r.nom AS role, u.actif, u.createdAt\nFROM agents u\nLEFT JOIN roles r ON r.idroles = u.roles_idroles\nORDER BY u.createdAt DESC",
    },
    {
      label: 'Tables de la base',
      sql: 'SHOW TABLES',
    },
  ];

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadTables();
  }

  loadTables(): void {
    this.loadingTables = true;
    this.http.get<any>(`${this.api}/admin/db-explorer/tables`).subscribe({
      next: (r) => {
        this.tables = r.success ? r.data : [];
        this.loadingTables = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingTables = false;
        this.cdr.detectChanges();
      },
    });
  }

  usePreset(sql: string): void {
    this.sqlInput = sql;
    this.cdr.detectChanges();
  }

  selectTable(table: string): void {
    this.sqlInput = `SELECT * FROM \`${table}\` LIMIT 50`;
    this.cdr.detectChanges();
  }

  execute(): void {
    const q = this.sqlInput.trim();
    if (!q) return;

    if (DESTRUCTIVE.test(q)) {
      const confirmed = window.confirm(
        '⚠️ Cette requête va modifier ou supprimer des données.\n\nÊtes-vous sûr de vouloir continuer ?'
      );
      if (!confirmed) return;
    }

    this.loading = true;
    this.result = null;
    this.errorMsg = '';
    this.cdr.detectChanges();

    this.http.post<any>(`${this.api}/admin/db-explorer/query`, { query: q }).subscribe({
      next: (r) => {
        if (r.success) {
          this.result = r.data;
          if (!this.queryHistory.includes(q)) {
            this.queryHistory.unshift(q);
            if (this.queryHistory.length > 8) this.queryHistory.pop();
          }
        } else {
          this.errorMsg = r.message;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMsg = err?.error?.message || 'Erreur serveur';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  exportCsv(): void {
    if (!this.result || this.result.rows.length === 0) return;
    const { columns, rows } = this.result;
    const header = columns.join(';');
    const body = rows
      .map((row) => columns.map((c) => `"${String(row[c] ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob(['﻿' + header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `export_${Date.now()}.csv`;
    a.click();
  }

  clearEditor(): void {
    this.sqlInput = '';
    this.result = null;
    this.errorMsg = '';
    this.cdr.detectChanges();
  }

  useHistory(q: string): void {
    this.sqlInput = q;
    this.cdr.detectChanges();
  }

  formatValue(val: any): string {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  }

  isNull(val: any): boolean {
    return val === null || val === undefined;
  }
}
