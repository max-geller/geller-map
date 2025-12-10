export interface AppUser {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  preferences?: {
    theme: 'light' | 'dark' | 'system';
  };
}
