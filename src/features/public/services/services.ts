import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ScrollRevealDirective } from '../../../shared/directives/scroll-reveal.directive';

@Component({
  selector: 'app-services',
  imports: [CommonModule, RouterModule, ScrollRevealDirective],
  templateUrl: './services.html',
  styleUrl: './services.css',
})
export class Services implements OnInit, OnDestroy {

  activeSection = 'stages';
  private observer: IntersectionObserver | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.activeSection = entry.target.id;
            this.cdr.detectChanges();
          }
        });
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    );

    ['stages', 'audience', 'offres', 'aides', 'terrain', 'collecte'].forEach(id => {
      const el = document.getElementById(id);
      if (el) this.observer!.observe(el);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  scrollTo(id: string): void {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  go(authPath: string, guestPath: string = '/auth/login'): void {
    if (this.authService.isLoggedIn()) {
      this.router.navigate([authPath]);
    } else {
      this.router.navigate([guestPath]);
    }
  }
}
