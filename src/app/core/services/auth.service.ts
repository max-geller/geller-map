import { Injectable, inject, signal, computed, Injector, runInInjectionContext } from '@angular/core';
import {
  Auth,
  User,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { AppUser } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private injector = inject(Injector);

  private _currentUser = signal<AppUser | null>(null);
  private _authInitialized = signal<boolean>(false);

  currentUser = this._currentUser.asReadonly();
  authInitialized = this._authInitialized.asReadonly();
  isAuthenticated = computed(() => this._currentUser() !== null);

  constructor() {
    onAuthStateChanged(this.auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        try {
          await firebaseUser.getIdToken(true);
          const userDoc = await this.getDocWithRetry(`users/${firebaseUser.uid}`, 3);

          if (userDoc.exists()) {
            this._currentUser.set(userDoc.data() as AppUser);
          } else {
            const newUser: AppUser = {
              uid: firebaseUser.uid,
              email: firebaseUser.email!,
              displayName: firebaseUser.displayName || undefined,
              photoURL: firebaseUser.photoURL || undefined,
              preferences: {
                theme: 'system',
              },
            };

            await this.setDocWithRetry(`users/${firebaseUser.uid}`, newUser, 3);
            this._currentUser.set(newUser);
          }
        } catch (error) {
          console.error('Failed to load user data after retries:', error);
          this._currentUser.set(null);
        }
      } else {
        this._currentUser.set(null);
      }

      this._authInitialized.set(true);
    });
  }

  private async getDocWithRetry(path: string, maxRetries: number): Promise<any> {
    let lastError: unknown;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await runInInjectionContext(this.injector, async () => {
          const docRef = doc(this.firestore, path);
          return await getDoc(docRef);
        });
      } catch (error: any) {
        lastError = error;

        if (error?.code === 'permission-denied' && attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 250;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  }

  private async setDocWithRetry(path: string, data: unknown, maxRetries: number): Promise<void> {
    let lastError: unknown;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await runInInjectionContext(this.injector, async () => {
          const docRef = doc(this.firestore, path);
          await setDoc(docRef, data);
        });
        return;
      } catch (error: any) {
        lastError = error;

        if (error?.code === 'permission-denied' && attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 250;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  }

  async signInWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();

    console.log('Opening Google sign-in popup...');
    await signInWithPopup(this.auth, provider);
    console.log('Sign-in completed');

    // Wait for auth state to be fully initialized
    await new Promise<void>((resolve) => {
      const checkAuth = () => {
        if (this._currentUser() !== null) {
          resolve();
        } else {
          setTimeout(checkAuth, 100);
        }
      };
      checkAuth();
    });

    await this.router.navigate(['/']);
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
    await this.router.navigate(['/login']);
  }
}
