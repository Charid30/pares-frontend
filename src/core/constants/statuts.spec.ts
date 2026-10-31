import { TON_PAR_STATUT, classesStatut, tonStatut } from './statuts';

// Statuts existant en base (ENUM des modèles Sequelize du backend, 2026-10-25) + statut calculé PROLONGE.
// Un statut ajouté côté serveur doit être ajouté ici ET dans TON_PAR_STATUT, sinon il s'affiche en gris.
const STATUTS_EN_BASE = [
  // stage / renouvellement
  'EN_ATTENTE', 'EN_COURS_DE_TRAITEMENT', 'PROGRAMMATION_EN_COURS', 'ACCEPTE', 'REJETE', 'EN_COURS', 'TERMINE',
  'EXPIRE', 'RAPPORT_SOUMIS', 'SUSPENDU', 'ANNULE', 'PROLONGE',
  // aides / offres
  'BROUILLON', 'EN_TRAITEMENT', 'VALIDEE', 'REJETEE', 'ACTIVE', 'CLOTUREE',
  // demandes de modification (suspension / annulation)
  'APPROUVEE',
  // rapports de stage, candidatures
  'SOUMIS', 'EN_EVALUATION', 'VALIDE', 'REFUSE', 'SOUMISE', 'EN_EXAMEN',
  // candidatures (recrutement), aides expirées
  'EN_VERIFICATION', 'ACCEPTEE', 'EXPIREE',
  // file d'e-mails
  'PENDING', 'SENT', 'FAILED',
];

describe('statuts — un statut = une couleur', () => {
  it('chaque statut existant en base a un ton', () => {
    const sansTon = STATUTS_EN_BASE.filter(s => !(s in TON_PAR_STATUT));
    expect(sansTon).toEqual([]);
  });

  it('les mêmes statuts ont la même couleur partout', () => {
    expect(classesStatut('ACCEPTE')).toBe(classesStatut('VALIDEE'));
    expect(classesStatut('EN_COURS')).toBe(classesStatut('PROLONGE'));
    expect(classesStatut('TERMINE')).toBe(classesStatut('EXPIRE'));
    expect(classesStatut('REJETE')).toBe(classesStatut('REJETEE'));
  });

  it('formats et cas limites', () => {
    expect(classesStatut('EN_ATTENTE', 'point')).toBe('bg-amber-500');
    expect(classesStatut('REJETE', 'pastilleBordure')).toBe('bg-red-50 text-red-700 border border-red-200');
    expect(tonStatut(null)).toBe('neutre');
    expect(tonStatut('INCONNU')).toBe('neutre');
    expect(tonStatut('ANNULE')).toBe('neutre'); // décision du candidat, pas un refus
  });
});
