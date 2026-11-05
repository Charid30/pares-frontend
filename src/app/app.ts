import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PwaInstallBanner } from '../shared/components/pwa-install-banner/pwa-install-banner';
import { ToastContainer } from '../shared/components/toast-container/toast-container';
import { ConfirmDialog } from '../shared/components/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, PwaInstallBanner, ToastContainer, ConfirmDialog],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('pares-frontend');
}
