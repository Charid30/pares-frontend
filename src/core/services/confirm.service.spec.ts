import { ConfirmService } from './confirm.service';

describe('ConfirmService', () => {
  it('résout true quand l\'utilisateur confirme, et ferme la fenêtre', async () => {
    const service = new ConfirmService();
    const reponse = service.demander({ titre: 'Supprimer', message: 'Irréversible', danger: true });
    expect(service.demande()?.titre).toBe('Supprimer');
    service.repondre(true);
    expect(await reponse).toBe(true);
    expect(service.demande()).toBeNull();
  });

  it('résout false à l\'annulation', async () => {
    const service = new ConfirmService();
    const reponse = service.demander({ titre: 'Envoyer', message: '' });
    service.repondre(false);
    expect(await reponse).toBe(false);
  });

  it('une nouvelle demande annule la précédente (une seule fenêtre à la fois)', async () => {
    const service = new ConfirmService();
    const premiere = service.demander({ titre: 'A', message: '' });
    const seconde = service.demander({ titre: 'B', message: '' });
    expect(await premiere).toBe(false);
    expect(service.demande()?.titre).toBe('B');
    service.repondre(true);
    expect(await seconde).toBe(true);
  });
});
