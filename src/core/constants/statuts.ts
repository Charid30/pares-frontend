// statuts.ts — Couleurs des statuts, communes à toute l'application (2026-10-25) : un statut = une couleur.
// Chaque écran garde ses libellés (« Validée » pour une aide, « Accepté » pour un stage…) ; seule la couleur
// vient d'ici. La suite des tons suit le circuit d'une demande :
//   attente (ambre) → examen (bleu ciel) → approuvé (indigo) → validé (vert) → en stage (bleu) → clos (gris)
//   + suspendu (orange) et refusé (rouge, réservé aux refus — distinct du rouge SONABHY des boutons).
// Les classes sont écrites en entier (pas de concaténation) pour que Tailwind les génère.

export type TonStatut = 'attente' | 'examen' | 'approuve' | 'valide' | 'enCours' | 'suspendu' | 'neutre' | 'refuse';

/** Formats utilisés par les écrans :
 *  - pastille        : fond + texte (bg-*-100 text-*-700)
 *  - pastilleBordure : fond pâle + texte + bordure complète (bg-*-50 … border border-*-200)
 *  - bordureCouleur  : fond + texte + couleur de bordure (le gabarit ajoute « border »)
 *  - point           : couleur pleine d'un point, d'une barre ou d'une frise
 *  - texte           : couleur du texte seule */
export type FormatStatut = 'pastille' | 'pastilleBordure' | 'bordureCouleur' | 'point' | 'texte';

export const TON_PAR_STATUT: Record<string, TonStatut> = {
  // En attente d'une action
  EN_ATTENTE: 'attente', SOUMIS: 'attente', SOUMISE: 'attente', PENDING: 'attente',
  // En cours d'examen
  EN_COURS_DE_TRAITEMENT: 'examen', EN_TRAITEMENT: 'examen', EN_EXAMEN: 'examen', EN_EVALUATION: 'examen', EN_VERIFICATION: 'examen',
  RAPPORT_SOUMIS: 'examen',
  // Approuvé, étape intermédiaire
  PROGRAMMATION_EN_COURS: 'approuve', APPROUVEE: 'approuve',
  // Validé
  ACCEPTE: 'valide', ACCEPTEE: 'valide', VALIDE: 'valide', VALIDEE: 'valide', ACTIVE: 'valide', SENT: 'valide',
  // En stage
  EN_COURS: 'enCours', PROLONGE: 'enCours',
  // Interrompu
  SUSPENDU: 'suspendu',
  // Terminé, clos ou neutre (« Annulé » = décision du candidat, pas un refus)
  TERMINE: 'neutre', EXPIRE: 'neutre', EXPIREE: 'neutre', CLOTUREE: 'neutre', ANNULE: 'neutre', BROUILLON: 'neutre',
  // Refusé
  REJETE: 'refuse', REJETEE: 'refuse', REFUSE: 'refuse', FAILED: 'refuse',
};

const CLASSES: Record<TonStatut, Record<FormatStatut, string>> = {
  attente: {
    pastille: 'bg-amber-100 text-amber-700',
    pastilleBordure: 'bg-amber-50 text-amber-700 border border-amber-200',
    bordureCouleur: 'bg-amber-100 text-amber-700 border-amber-200',
    point: 'bg-amber-500',
    texte: 'text-amber-700',
  },
  examen: {
    pastille: 'bg-sky-100 text-sky-700',
    pastilleBordure: 'bg-sky-50 text-sky-700 border border-sky-200',
    bordureCouleur: 'bg-sky-100 text-sky-700 border-sky-200',
    point: 'bg-sky-500',
    texte: 'text-sky-700',
  },
  approuve: {
    pastille: 'bg-indigo-100 text-indigo-700',
    pastilleBordure: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    bordureCouleur: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    point: 'bg-indigo-500',
    texte: 'text-indigo-700',
  },
  valide: {
    pastille: 'bg-green-100 text-green-700',
    pastilleBordure: 'bg-green-50 text-green-700 border border-green-200',
    bordureCouleur: 'bg-green-100 text-green-700 border-green-200',
    point: 'bg-green-500',
    texte: 'text-green-700',
  },
  enCours: {
    pastille: 'bg-blue-100 text-blue-700',
    pastilleBordure: 'bg-blue-50 text-blue-700 border border-blue-200',
    bordureCouleur: 'bg-blue-100 text-blue-700 border-blue-200',
    point: 'bg-blue-500',
    texte: 'text-blue-700',
  },
  suspendu: {
    pastille: 'bg-orange-100 text-orange-700',
    pastilleBordure: 'bg-orange-50 text-orange-700 border border-orange-200',
    bordureCouleur: 'bg-orange-100 text-orange-700 border-orange-200',
    point: 'bg-orange-500',
    texte: 'text-orange-700',
  },
  neutre: {
    pastille: 'bg-gray-100 text-gray-600',
    pastilleBordure: 'bg-gray-50 text-gray-600 border border-gray-200',
    bordureCouleur: 'bg-gray-100 text-gray-600 border-gray-200',
    point: 'bg-gray-400',
    texte: 'text-gray-600',
  },
  refuse: {
    pastille: 'bg-red-100 text-red-700',
    pastilleBordure: 'bg-red-50 text-red-700 border border-red-200',
    bordureCouleur: 'bg-red-100 text-red-700 border-red-200',
    point: 'bg-red-500',
    texte: 'text-red-700',
  },
};

/** Ton d'un statut ; un statut inconnu ou vide est neutre (gris). */
export function tonStatut(statut: string | null | undefined): TonStatut {
  return (statut && TON_PAR_STATUT[statut]) || 'neutre';
}

/** Classes Tailwind d'un statut dans le format demandé. */
export function classesStatut(statut: string | null | undefined, format: FormatStatut = 'pastille'): string {
  return CLASSES[tonStatut(statut)][format];
}
