import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../../../core/services/auth.service';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-candidat-dashboard',
  imports: [CommonModule, RouterModule],
  templateUrl: './candidat-dashboard.html',
  styleUrl: './candidat-dashboard.css',
})
export class CandidatDashboard implements OnInit {

  currentUser: any = null;
  todayDate = '';
  errorMessage: string | null = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();

    if (!this.currentUser) {
      this.router.navigate(['/auth/login']);
      return;
    }

    // Date du jour en français
    this.todayDate = new Date().toLocaleDateString('fr-FR', {
      weekday: 'short', day: 'numeric', month: 'long'
    });
  }
}
