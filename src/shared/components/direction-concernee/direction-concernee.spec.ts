import { TestBed } from '@angular/core/testing';
import { DirectionConcernee } from './direction-concernee';

const DIRECTIONS = [
  { iddirection: 1, nom: 'Direction Générale', accronyme: 'DG' },
  { iddirection: 6, nom: 'Cabinet', accronyme: 'CAB' },
  { iddirection: 15, nom: 'Ressources Humaines', accronyme: 'DRH' },
];

describe('DirectionConcernee', () => {
  const ouvrir = () => {
    const fixture = TestBed.createComponent(DirectionConcernee);
    fixture.componentRef.setInput('ouvert', true);
    fixture.componentRef.setInput('directionActuelleId', 6);
    fixture.componentRef.setInput('directions', DIRECTIONS);
    fixture.detectChanges();
    return fixture;
  };
  const bouton = (el: HTMLElement, texte: string) =>
    Array.from(el.querySelectorAll('button')).find(b => b.textContent!.includes(texte)) as HTMLButtonElement;

  it('Oui : la validation continue', () => {
    const fixture = ouvrir();
    let oui = false;
    fixture.componentInstance.oui.subscribe(() => (oui = true));
    expect(fixture.nativeElement.textContent).toContain('CAB — Cabinet');
    bouton(fixture.nativeElement, 'Oui, valider').click();
    expect(oui).toBe(true);
  });

  it('Non : choix d\'une autre direction, puis redirection vers elle', () => {
    const fixture = ouvrir();
    let cible: number | null = null;
    fixture.componentInstance.rediriger.subscribe((id: number) => (cible = id));
    bouton(fixture.nativeElement, 'Non, rediriger').click();
    fixture.detectChanges();

    const options = Array.from(fixture.nativeElement.querySelectorAll('option') as NodeListOf<HTMLOptionElement>).map(o => o.textContent!.trim());
    expect(options).not.toContain('CAB — Cabinet');   // la direction actuelle n'est pas proposée
    expect(bouton(fixture.nativeElement, 'Rediriger').disabled).toBe(true);

    // choix comme le ferait l'agent dans la liste
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = Array.from(select.options).find(o => o.textContent!.includes('DRH'))!.value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    bouton(fixture.nativeElement, 'Rediriger').click();
    expect(cible).toBe(15);
  });
});
