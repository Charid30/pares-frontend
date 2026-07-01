import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Loader } from "../../../shared/components/loader/loader";
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-careers',
  imports: [CommonModule, RouterModule, Loader],
  templateUrl: './careers.html',
  styleUrl: './careers.css',
})
export class Careers {

  isLoading = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  /**
   * Navigation intelligente : redirige vers authPath si connecté,
   * sinon vers guestPath (défaut : page de connexion).
   */
  go(authPath: string, guestPath: string = '/auth/login'): void {
    if (this.authService.isLoggedIn()) {
      this.router.navigate([authPath]);
    } else {
      this.router.navigate([guestPath]);
    }
  }
}
