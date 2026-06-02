import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from "@angular/router";


@Component({
  selector: 'app-auth-layout',
  imports: [CommonModule, RouterModule],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.css',
})
export class AuthLayout {

}
