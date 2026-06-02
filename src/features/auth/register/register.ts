import { Component, OnInit, OnDestroy, ElementRef, ViewChild, ChangeDetectorRef, NgZone } from '@angular/core';
import { FormGroup, FormBuilder, Validators, AbstractControl, ValidationErrors, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService, RegisterData } from '../../../core/services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-register',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register implements OnInit, OnDestroy {

  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasEl!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  registerForm!: FormGroup;
  currentStep = 1;
  isLoading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  showPassword = false;

  // ── OCR / scanner ────────────────────────────────────────────────────────
  /** 'idle' | 'choosing' | 'camera' | 'scanning' | 'error' */
  showIfuField = false;

  // ── OCR / scanner ────────────────────────────────────────────────────────
  /** 'idle' | 'choosing' | 'camera' | 'scanning' | 'error' */
  scanState: 'idle' | 'choosing' | 'camera' | 'scanning' | 'error' = 'idle';
  scanError: string | null = null;
  scanProgress: string = 'Analyse en cours...';
  debugPreprocessedImage: string | null = null; // image pré-traitée visible en debug
  private stream: MediaStream | null = null;
  private ocrTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) { }

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/dashboard/candidat']);
      return;
    }

    this.registerForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)]],
      confirmPassword: ['', [Validators.required]],
      prenom: ['', [Validators.required]],
      nom: ['', [Validators.required]],
      telephone: ['', [Validators.required, Validators.pattern(/^[0-9]{8}$/)]],
      nip: ['', [Validators.required, Validators.pattern(/^[0-9]{17}$/)]],
      ifu: ['', [Validators.pattern(/^\d{8}[A-Za-z]$/)]],
      acceptTerms: [false, [Validators.requiredTrue]],
    }, { validators: this.passwordMatchValidator });
  }

  ngOnDestroy(): void {
    this.stopCamera();
    if (this.ocrTimeoutId) clearTimeout(this.ocrTimeoutId);
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const p = control.get('password');
    const c = control.get('confirmPassword');
    if (!p || !c) return null;
    return p.value === c.value ? null : { passwordMismatch: true };
  }

  private step1Fields = ['username', 'email', 'password', 'confirmPassword'];

  nextStep(): void {
    this.step1Fields.forEach(f => this.registerForm.get(f)?.markAsTouched());
    const invalid = this.step1Fields.some(f => this.registerForm.get(f)?.invalid);
    if (invalid || !!this.registerForm.errors?.['passwordMismatch']) return;
    this.currentStep = 2;
  }

  prevStep(): void {
    this.closeScan();
    this.currentStep = 1;
  }

  // ── OCR public API ───────────────────────────────────────────────────────

  /** Ouvre le panneau de choix (caméra ou fichier) */
  openScanChooser(): void {
    this.scanState = 'choosing';
    this.scanError = null;
  }

  /** L'utilisateur choisit la caméra */
  async startCamera(): Promise<void> {
    // ── Vérification HTTPS ──────────────────────────────────────────────────
    // navigator.mediaDevices est undefined en HTTP (contexte non sécurisé)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.scanState = 'error';
      this.scanError = 'La caméra nécessite une connexion sécurisée (HTTPS). Utilisez "Galerie" pour importer une photo de votre CNIB.';
      this.cdr.detectChanges();
      return;
    }

    this.scanState = 'camera';
    this.scanError = null;
    this.cdr.detectChanges(); // Forcer le rendu du <video> avant d'assigner srcObject

    try {
      // Essai 1 : caméra arrière (mobile)
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch {
        // Essai 2 : n'importe quelle caméra disponible
        this.stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      // Angular a eu le temps de rendre le <video> grâce à detectChanges()
      const video = this.videoEl?.nativeElement;
      if (video) {
        video.srcObject = this.stream;
        await video.play();
      }
      this.cdr.detectChanges();
    } catch (err: unknown) {
      this.stopCamera();
      this.scanState = 'error';

      const name = (err as { name?: string })?.name ?? '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        this.scanError = 'Permission caméra refusée. Allez dans les réglages de votre navigateur et autorisez la caméra pour ce site.';
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        this.scanError = 'Aucune caméra détectée sur cet appareil. Utilisez "Galerie" pour importer une photo.';
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        this.scanError = 'La caméra est déjà utilisée par une autre application. Fermez-la et réessayez.';
      } else {
        this.scanError = `Impossible d'accéder à la caméra (${name || 'erreur inconnue'}). Essayez d'importer une photo.`;
      }
      this.cdr.detectChanges();
    }
  }

  /** Capture la frame courante de la vidéo et lance l'OCR */
  async captureAndScan(): Promise<void> {
    const video = this.videoEl?.nativeElement;
    const canvas = this.canvasEl?.nativeElement;
    if (!video || !canvas || video.readyState < 2) return;

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

    this.stopCamera();
    await this.runOcr(dataUrl);
  }

  /** L'utilisateur choisit un fichier image */
  triggerFileInput(): void {
    this.fileInput?.nativeElement.click();
  }

  async onFileSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    // Reset input immédiatement pour permettre de re-sélectionner le même fichier
    (event.target as HTMLInputElement).value = '';
    if (!file) return;

    this.scanState = 'scanning';
    this.scanProgress = 'Chargement de l\'image...';
    this.cdr.detectChanges();

    try {
      // Wrapper FileReader en Promise pour éviter les erreurs silencieuses
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result;
          if (typeof result === 'string') resolve(result);
          else reject(new Error('Lecture fichier échouée'));
        };
        reader.onerror = () => reject(new Error('Impossible de lire le fichier'));
        reader.readAsDataURL(file);
      });

      await this.runOcr(dataUrl);
    } catch {
      this.scanState = 'error';
      this.scanError = 'Impossible de lire le fichier image. Choisissez un autre fichier.';
      this.cdr.detectChanges();
    }
  }

  /** Ferme le scanner et remet à l'état idle */
  closeScan(): void {
    this.stopCamera();
    this.scanState = 'idle';
    this.scanError = null;
  }

  /** Réessaye depuis le panneau d'erreur */
  retryScan(): void {
    this.scanState = 'choosing';
    this.scanError = null;
  }

  /** Ignore le scanner — l'utilisateur saisit manuellement */
  useManualInput(): void {
    this.closeScan();
    // Focus sur le champ NIP après fermeture
    setTimeout(() => {
      document.getElementById('nip-input')?.focus();
    }, 100);
  }

  // ── Logique OCR privée ───────────────────────────────────────────────────

  private stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  }

  /**
   * Pré-traitement optimisé pour l'extraction du NIP sur une CNIB photographiée.
   *
   * Pipeline :
   *   1. Mise à l'échelle adaptative (1500–2400px)
   *   2. Niveaux de gris
   *   3. Box blur léger → débruitage sans perdre les contours
   *   4. Unsharp mask → accentuation des chiffres flous
   *   5. Seuillage adaptatif local (Sauvola simplifié) → gère l'éclairage inégal
   *
   * Avantage vs Otsu global : si la photo a un flash dans un coin ou une ombre,
   * chaque pixel est seuillé par rapport à son voisinage local, pas par rapport
   * à toute l'image → les chiffres restent lisibles partout.
   */
  private preprocessForNip(imageData: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const srcW = img.naturalWidth;
        const srcH = img.naturalHeight;

        // ── 1. Mise à l'échelle adaptative ────────────────────────────────
        // Minimum 1500px pour Tesseract ; plafond 2400px pour ne pas surcharger
        const targetW = Math.min(2400, Math.max(1500, srcW));
        const targetH = Math.round(srcH * (targetW / srcW));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetW, targetH);

        const imgData = ctx.getImageData(0, 0, targetW, targetH);
        const d = imgData.data;
        const n = targetW * targetH;

        // ── 2. Conversion niveaux de gris ─────────────────────────────────
        const gray = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          gray[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
        }

        // ── 3. Débruitage : box blur rapide (rayon 2) ─────────────────────
        // Atténue le bruit des capteurs photo sans effacer les bords des chiffres
        const blurred = this.boxBlur(gray, targetW, targetH, 2);

        // ── 4. Accentuation (unsharp mask) ───────────────────────────────
        // sharpened = gray + α*(gray - blurred)  avec α = 1.8
        // Renforce les contours des chiffres légèrement flous (photo téléphone)
        const sharpened = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          sharpened[i] = Math.max(0, Math.min(255, gray[i] + 1.8 * (gray[i] - blurred[i])));
        }

        // ── 5. Seuillage adaptatif local (Sauvola simplifié) ─────────────
        // Pour chaque pixel : threshold = moyenne_locale * (1 - k)
        // blockSize = ~1/25 de la largeur → environ 60px, adapté à la taille des chiffres
        const blockSize = Math.max(20, Math.round(targetW / 25));
        const k = 0.10;
        const integral = this.buildIntegralTable(sharpened, targetW, targetH);
        const output = new Uint8Array(n);

        for (let y = 0; y < targetH; y++) {
          for (let x = 0; x < targetW; x++) {
            const bx1 = Math.max(0, x - blockSize);
            const by1 = Math.max(0, y - blockSize);
            const bx2 = Math.min(targetW - 1, x + blockSize);
            const by2 = Math.min(targetH - 1, y + blockSize);
            const area = (bx2 - bx1 + 1) * (by2 - by1 + 1);
            const sum = this.getIntegralSum(integral, bx1, by1, bx2, by2, targetW);
            const localMean = sum / area;
            // Pixel sombre par rapport à son voisinage → texte (0), sinon fond (255)
            output[y * targetW + x] = sharpened[y * targetW + x] < localMean * (1 - k) ? 0 : 255;
          }
        }

        // ── 6. Appliquer le résultat ──────────────────────────────────────
        for (let i = 0; i < n; i++) {
          const v = output[i];
          d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);

        this.debugPreprocessedImage = canvas.toDataURL('image/png');
        this.cdr.detectChanges();
        resolve(this.debugPreprocessedImage);
      };
      img.onerror = () => resolve(imageData);
      img.src = imageData;
    });
  }

  // ── Flou de boîte séparable (O(n) — deux passes 1D) ───────────────────────
  // Équivaut à un flou gaussien approximatif, beaucoup plus rapide (pas de sin/cos)
  private boxBlur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
    const temp = new Float32Array(src.length);
    const dst = new Float32Array(src.length);
    const size = 2 * radius + 1;

    // Passe horizontale : src → temp
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        sum += src[row + Math.max(0, Math.min(w - 1, k))];
      }
      for (let x = 0; x < w; x++) {
        temp[row + x] = sum / size;
        sum += src[row + Math.min(w - 1, x + radius + 1)];
        sum -= src[row + Math.max(0, x - radius)];
      }
    }

    // Passe verticale : temp → dst
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        sum += temp[Math.max(0, Math.min(h - 1, k)) * w + x];
      }
      for (let y = 0; y < h; y++) {
        dst[y * w + x] = sum / size;
        sum += temp[Math.min(h - 1, y + radius + 1) * w + x];
        sum -= temp[Math.max(0, y - radius) * w + x];
      }
    }
    return dst;
  }

  // ── Table intégrale 2D (prefix sums) ─────────────────────────────────────
  // Permet de calculer la somme d'un rectangle quelconque en O(1)
  // → rend le seuillage adaptatif aussi rapide que le seuillage global
  private buildIntegralTable(src: Float32Array, w: number, h: number): Float64Array {
    const W = w + 1;
    const integral = new Float64Array((h + 1) * W);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        integral[(y + 1) * W + (x + 1)] =
          src[y * w + x]
          + integral[y * W + (x + 1)]
          + integral[(y + 1) * W + x]
          - integral[y * W + x];
      }
    }
    return integral;
  }

  private getIntegralSum(
    integral: Float64Array,
    x1: number, y1: number, x2: number, y2: number, w: number
  ): number {
    const W = w + 1;
    return integral[(y2 + 1) * W + (x2 + 1)]
      - integral[y1 * W + (x2 + 1)]
      - integral[(y2 + 1) * W + x1]
      + integral[y1 * W + x1];
  }

  private async runOcr(imageData: string): Promise<void> {
    this.scanState = 'scanning';
    this.scanError = null;
    this.scanProgress = 'Préparation de l\'image...';
    this.cdr.detectChanges();

    // ── Timeout de sécurité : 45s max ────────────────────────────────────
    if (this.ocrTimeoutId) clearTimeout(this.ocrTimeoutId);
    this.ocrTimeoutId = setTimeout(() => {
      if (this.scanState === 'scanning') {
        this.scanState = 'error';
        this.scanError = 'L\'analyse a pris trop de temps. Vérifiez votre connexion internet (le moteur OCR doit être téléchargé la première fois) et réessayez.';
        this.cdr.detectChanges();
      }
    }, 45000);

    try {
      // ── 1. Pré-traitement : recadrage + contraste ─────────────────────
      this.scanProgress = 'Recadrage de la zone NIP...';
      this.cdr.detectChanges();
      const processedImage = await this.preprocessForNip(imageData);

      // ── 2. Chargement moteur OCR ──────────────────────────────────────
      this.scanProgress = 'Chargement du moteur OCR (1ʳᵉ fois : ~5s)...';
      this.cdr.detectChanges();

      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1, {
        workerPath: '/assets/tesseract/worker.min.js',
        corePath: '/assets/tesseract/tesseract-core.wasm.js',
        langPath: '/assets/tessdata',
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'loading tesseract core') {
            this.scanProgress = 'Chargement moteur OCR...';
          } else if (m.status === 'loading language traineddata') {
            this.scanProgress = 'Chargement dictionnaire chiffres...';
          } else if (m.status === 'recognizing text') {
            const pct = Math.round((m.progress ?? 0) * 100);
            this.scanProgress = `Analyse en cours... ${pct}%`;
          }
          this.cdr.detectChanges();
        },
      });

      // ── 3. Paramètres OCR ─────────────────────────────────────────────
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789',
        tessedit_pageseg_mode: '11' as never, // Sparse text — idéal quand les chiffres sont mélangés avec du texte
      });

      // ── 4. Reconnaissance ─────────────────────────────────────────────
      this.scanProgress = 'Lecture du numéro NIP...';
      this.cdr.detectChanges();

      const { data: { text } } = await worker.recognize(processedImage);
      await worker.terminate();

      // Annuler le timeout car OCR terminé
      if (this.ocrTimeoutId) { clearTimeout(this.ocrTimeoutId); this.ocrTimeoutId = null; }

      // ── 5. Extraction du NIP ──────────────────────────────────────────
      // Stratégie multi-passes pour gérer les espaces/retours insérés par Tesseract

      // Passe A : séquence de 17 chiffres strictement consécutifs
      const passA = [...text.matchAll(/\d{17}/g)].map(m => m[0]);

      // Passe B : retirer tous les espaces/sauts de ligne et chercher 17 chiffres
      //           (Tesseract peut insérer des espaces entre les chiffres)
      const textNoSpace = text.replace(/[\s\n\r]/g, '');
      const passB = [...textNoSpace.matchAll(/\d{17}/g)].map(m => m[0]);

      // Passe C : chiffres séparés par 0 ou 1 espace (ex: "03010400 222056869")
      const passC = [...text.matchAll(/\d[\d ]{15,17}\d/g)]
        .map(m => m[0].replace(/\s/g, ''))
        .filter(s => s.length === 17);

      const allCandidates = [...passA, ...passB, ...passC];

      if (allCandidates.length > 0) {
        // Vote majoritaire : prendre la séquence la plus fréquente
        const freq: Record<string, number> = {};
        allCandidates.forEach(s => { freq[s] = (freq[s] ?? 0) + 1; });
        const best = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];

        this.registerForm.get('nip')?.setValue(best);
        this.registerForm.get('nip')?.markAsTouched();
        this.debugPreprocessedImage = null; // succès → on cache le debug
        this.scanState = 'idle';
      } else {
        // Passe D : fallback — la plus longue suite de chiffres dans le texte sans espace
        const allDigits = textNoSpace.replace(/\D/g, '');
        // Chercher le sous-groupe de 17 chiffres le plus probable
        // (sur la CNIB le NIP est la seule longue série de chiffres)
        const longestMatch = allDigits.match(/\d{15,}/)?.[0] ?? '';

        if (longestMatch.length >= 15) {
          this.registerForm.get('nip')?.setValue(longestMatch.slice(0, 17));
          this.registerForm.get('nip')?.markAsTouched();
          this.scanState = 'error';
          this.scanError = `Lecture partielle (${longestMatch.length}/17 chiffres) — vérifiez et complétez le numéro ci-dessous.`;
        } else {
          this.scanState = 'error';
          this.scanError = 'Numéro NIP non détecté. Vérifiez que la photo est nette et bien cadrée, puis réessayez.';
        }
      }
    } catch(err: unknown) {
      if (this.ocrTimeoutId) { clearTimeout(this.ocrTimeoutId); this.ocrTimeoutId = null; }
      this.scanState = 'error';
      console.error('[OCR Error]', err);
      const msg = err instanceof Error ? err.message : String(err);
      this.scanError = `Erreur OCR : ${msg}`;
    }
    this.cdr.detectChanges();
  }

// ── Soumission ───────────────────────────────────────────────────────────

onSubmit(): void {
  if(this.registerForm.valid) {
  this.isLoading = true;
  this.errorMessage = null;
  this.successMessage = null;

  const formData: RegisterData = {
    username: this.registerForm.value.username,
    email: this.registerForm.value.email,
    password: this.registerForm.value.password,
    confirmPassword: this.registerForm.value.confirmPassword,
    nom: this.registerForm.value.nom,
    prenom: this.registerForm.value.prenom,
    telephone: this.registerForm.value.telephone,
    nip: this.registerForm.value.nip,
    ifu: this.registerForm.value.ifu || undefined,
  };

  this.authService.register(formData).subscribe({
    next: (response) => {
      this.ngZone.run(() => {
        this.isLoading = false;
        if (response.success) {
          this.successMessage = 'Compte créé avec succès ! Redirection...';
          setTimeout(() => this.router.navigate(['/dashboard/candidat']), 2000);
        }
        this.cdr.detectChanges();
      });
    },
    error: (error) => {
      this.ngZone.run(() => {
        this.isLoading = false;
        if (error.status === 409) {
          this.errorMessage = 'Ce nom d\'utilisateur ou cet email est déjà utilisé';
          this.currentStep = 1;
        } else if (error.status === 400) {
          this.errorMessage = error.error?.message || 'Données invalides.';
        } else if (error.status === 0) {
          this.errorMessage = 'Impossible de contacter le serveur.';
        } else {
          this.errorMessage = error.error?.message || 'Une erreur est survenue.';
        }
        this.cdr.detectChanges();
      });
    },
  });
} else {
  ['prenom', 'nom', 'telephone', 'nip', 'ifu', 'acceptTerms'].forEach(f =>
    this.registerForm.get(f)?.markAsTouched()
  );
}
  }

togglePasswordVisibility(): void {
  this.showPassword = !this.showPassword;
}

toggleIfuField(): void {
  this.showIfuField = !this.showIfuField;
  if(!this.showIfuField) {
  this.registerForm.get('ifu')?.setValue('');
  this.registerForm.get('ifu')?.markAsUntouched();
}
  }
}