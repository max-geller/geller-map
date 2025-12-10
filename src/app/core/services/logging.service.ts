import { Injectable, isDevMode } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LoggingService {
  private isDev = isDevMode();

  logRead(collection: string, docId: string, duration: number): void {
    if (this.isDev) {
      console.log(`[DB READ] ${collection}/${docId} (${duration.toFixed(2)}ms)`);
    }
  }

  logQuery(collection: string, constraints: string, resultCount: number, duration: number): void {
    if (this.isDev) {
      console.log(
        `[DB QUERY] ${collection} with ${constraints} -> ${resultCount} results (${duration.toFixed(2)}ms)`
      );
    }
  }

  logWrite(collection: string, docId: string, data: unknown, duration: number): void {
    if (this.isDev) {
      console.log(`[DB WRITE] ${collection}/${docId} (${duration.toFixed(2)}ms)`, data);
    }
  }

  logUpdate(collection: string, docId: string, data: unknown, duration: number): void {
    if (this.isDev) {
      console.log(`[DB UPDATE] ${collection}/${docId} (${duration.toFixed(2)}ms)`, data);
    }
  }

  logDelete(collection: string, docId: string, duration: number): void {
    if (this.isDev) {
      console.log(`[DB DELETE] ${collection}/${docId} (${duration.toFixed(2)}ms)`);
    }
  }

  logError(operation: string, collection: string, error: unknown, docId?: string): void {
    const path = docId ? `${collection}/${docId}` : collection;
    console.error(`[DB ERROR] ${operation} on ${path}:`, error);
  }

  log(message: string, ...args: unknown[]): void {
    if (this.isDev) {
      console.log(`[APP] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(`[APP WARN] ${message}`, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(`[APP ERROR] ${message}`, ...args);
  }
}
