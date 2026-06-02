import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Loader } from "../../../shared/components/loader/loader";
import { AuthService } from '../../../core/services/auth.service';
import { ScrollRevealDirective } from '../../../shared/directives/scroll-reveal.directive';

@Component({
  selector: 'app-about',
  imports: [CommonModule, RouterModule, Loader, ScrollRevealDirective],
  templateUrl: './about.html',
  styleUrl: './about.css',
})
export class About implements OnInit {

  isLoading = false;

  constructor(
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    setTimeout(() => {
      this.isLoading = false;
      this.cdr.detectChanges();
    }, 2000);
  }

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
