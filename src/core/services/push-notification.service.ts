// src/core/services/push-notification.service.ts
// Notifications push navigateur (Web Push API) — s'appuie sur le service worker
// déjà enregistré (public/sw.js) pour recevoir les push même onglet fermé.
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

interface VapidKeyResponse {
  success: boolean;
  data: { publicKey: string; enabled: boolean };
}

@Injectable({ providedIn: 'root' })
export class PushNotificationService {

  private readonly api = `${environment.apiUrl}/push`;

  constructor(private http: HttpClient) {}

  /** Le navigateur supporte-t-il les notifications push ? */
  get isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  /** État actuel de la permission navigateur */
  get permission(): NotificationPermission | 'unsupported' {
    if (!this.isSupported) return 'unsupported';
    return Notification.permission;
  }

  /** Vérifie si un abonnement push est déjà actif sur cet appareil */
  async isSubscribed(): Promise<boolean> {
    if (!this.isSupported) return false;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  }

  /**
   * Demande la permission au navigateur (si nécessaire), puis crée l'abonnement
   * push et l'envoie au backend. Retourne true si l'activation a réussi.
   */
  async subscribe(): Promise<boolean> {
    if (!this.isSupported) return false;

    if (Notification.permission === 'denied') return false;

    if (Notification.permission !== 'granted') {
      const result = await Notification.requestPermission();
      if (result !== 'granted') return false;
    }

    const { data } = await firstValueFrom(this.http.get<VapidKeyResponse>(`${this.api}/vapid-public-key`));
    if (!data.enabled || !data.publicKey) return false;

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(data.publicKey),
      });
    }

    await firstValueFrom(this.http.post(`${this.api}/subscribe`, { subscription: subscription.toJSON() }));
    return true;
  }

  /** Désactive les notifications push sur cet appareil */
  async unsubscribe(): Promise<void> {
    if (!this.isSupported) return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await firstValueFrom(this.http.post(`${this.api}/unsubscribe`, { endpoint })).catch(() => {});
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}
