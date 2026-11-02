// Chargement du script Cloudflare Turnstile (captcha de l'inscription), une seule fois et seulement quand il sert.
const SCRIPT_TURNSTILE = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export interface TurnstileApi {
  render(element: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window { turnstile?: TurnstileApi; }
}

let chargement: Promise<TurnstileApi> | null = null;

export function chargerTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  chargement ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_TURNSTILE;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile indisponible')));
    script.onerror = () => {
      chargement = null; // un nouvel essai reste possible
      script.remove();
      reject(new Error('Turnstile indisponible'));
    };
    document.head.appendChild(script);
  });
  return chargement;
}
