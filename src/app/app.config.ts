import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth, browserLocalPersistence } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideNativeDateAdapter } from '@angular/material/core';

import { environment } from '../environments/environment';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(),
    provideAnimationsAsync(),
    provideNativeDateAdapter(),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => {
      const auth = getAuth();
      auth
        .setPersistence(browserLocalPersistence)
        .catch((error) => console.error('Failed to set auth persistence:', error));
      return auth;
    }),
    provideFirestore(() => getFirestore()),
  ],
};
