import { ToastService } from './toast.service';

describe('ToastService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('affiche un toast puis le fait sortir (animation) avant de le retirer', () => {
    const service = new ToastService();
    service.succes('Enregistré', 'Le stage a été mis à jour');
    expect(service.toasts()).toHaveLength(1);
    expect(service.toasts()[0]).toMatchObject({ type: 'success', titre: 'Enregistré', sortie: false });

    vi.advanceTimersByTime(4500);
    expect(service.toasts()[0].sortie).toBe(true); // repart vers la droite
    vi.advanceTimersByTime(300);
    expect(service.toasts()).toHaveLength(0);
  });

  it('une erreur reste plus longtemps qu\'un succès', () => {
    const service = new ToastService();
    service.erreur('Échec');
    vi.advanceTimersByTime(4500);
    expect(service.toasts()[0].sortie).toBe(false);
    vi.advanceTimersByTime(2500);
    expect(service.toasts()[0].sortie).toBe(true);
  });

  it('se ferme au clic et garde 5 toasts au plus', () => {
    const service = new ToastService();
    for (let i = 0; i < 7; i++) service.info(`Message ${i}`);
    expect(service.toasts()).toHaveLength(5);
    const id = service.toasts()[0].id;
    service.fermer(id);
    vi.advanceTimersByTime(300);
    expect(service.toasts().find(t => t.id === id)).toBeUndefined();
  });
});
