import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Loader } from "../../../shared/components/loader/loader";

@Component({
  selector: 'app-contact',
  imports: [CommonModule, ReactiveFormsModule, Loader],
  templateUrl: './contact.html',
  styleUrl: './contact.css',
})
export class Contact {

  contactForm!: FormGroup;
  isSubmitting = false;
  submitSuccess = false;
  submitError = false;
  isLoading = false;

  constructor(private fb: FormBuilder, private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    setTimeout(() => {
      console.log('Timeout exécuté, isLoading = false');
      // this.isLoading = false;
      this.cdr.detectChanges(); // Force la détection de changements
    }, 1000);
    this.contactForm = this.fb.group({
      nom: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      telephone: ['', [Validators.required]],
      sujet: ['', [Validators.required]],
      message: ['', [Validators.required, Validators.minLength(10)]],
    });
  }

  onSubmit(): void {
    if (this.contactForm.valid) {
      this.isSubmitting = true;
      this.submitSuccess = false;
      this.submitError = false;

      // Simuler l'envoi (à remplacer par un vrai appel API)
      setTimeout(() => {
        this.isSubmitting = false;
        this.submitSuccess = true;
        this.contactForm.reset();

        // Masquer le message de succès après 5 secondes
        setTimeout(() => {
          this.submitSuccess = false;
        }, 5000);
      }, 2000);
    }
  }

}
