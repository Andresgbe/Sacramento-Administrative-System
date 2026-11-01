import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

/** Only the user's choice. The password itself is never stored by the app. */
const SAVE_PASSWORD_STORAGE_KEY = 'login-save-password';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly showPassword = signal(false);
  protected readonly savePassword = signal(readSavePassword());

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected toggleShowPassword(): void {
    this.showPassword.update((show) => !show);
  }

  protected setSavePassword(save: boolean): void {
    this.savePassword.set(save);
    try {
      localStorage.setItem(SAVE_PASSWORD_STORAGE_KEY, String(save));
    } catch {
      // Storage blocked: the choice just won't survive a reload.
    }
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // Back to type="password" first: a browser's password manager only
    // recognises the field as a password in that state.
    this.showPassword.set(false);
    this.submitting.set(true);
    this.errorMessage.set(null);

    const { email, password } = this.form.getRawValue();
    const { error } = await this.authService.signIn(email, password);

    this.submitting.set(false);

    if (error) {
      this.errorMessage.set('Correo o contraseña incorrectos.');
      return;
    }

    // Only after a successful login, so a mistyped password is never offered.
    if (this.savePassword()) {
      this.authService.offerToSavePassword(email, password);
    }

    this.router.navigateByUrl('/dashboard');
  }
}

function readSavePassword(): boolean {
  try {
    return localStorage.getItem(SAVE_PASSWORD_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}
