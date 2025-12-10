import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  DocumentData,
  QueryConstraint,
  CollectionReference,
  DocumentReference,
  Timestamp,
} from '@angular/fire/firestore';
import { LoggingService } from './logging.service';

@Injectable({
  providedIn: 'root',
})
export class DbService {
  private firestore = inject(Firestore);
  private logger = inject(LoggingService);
  private injector = inject(Injector);

  /**
   * Remove undefined values from an object (Firestore doesn't accept undefined)
   */
  private cleanData(data: unknown): unknown {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.cleanData(item)).filter((item) => item !== undefined);
    }

    if (data instanceof Date) {
      return data.toISOString();
    }

    if (typeof data !== 'object') {
      return data;
    }

    const cleaned: DocumentData = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (value !== undefined) {
        if (typeof value === 'object' && value !== null) {
          const cleanedValue = this.cleanData(value);
          if (cleanedValue !== undefined && cleanedValue !== null) {
            if (
              typeof cleanedValue === 'object' &&
              !Array.isArray(cleanedValue) &&
              !(cleanedValue instanceof Date)
            ) {
              const hasProperties = Object.keys(cleanedValue as object).length > 0;
              if (hasProperties) {
                cleaned[key] = cleanedValue;
              }
            } else {
              cleaned[key] = cleanedValue;
            }
          }
        } else {
          cleaned[key] = value;
        }
      }
    }
    return cleaned;
  }

  /**
   * Recursively convert date strings (ISO) or Timestamps to Date objects
   */
  convertDates(data: unknown): unknown {
    if (data === null || data === undefined) {
      return data;
    }

    if (data instanceof Timestamp) {
      return data.toDate();
    }

    const isoDateRegex =
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/;

    if (typeof data === 'string' && isoDateRegex.test(data)) {
      const date = new Date(data);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.convertDates(item));
    }

    if (typeof data === 'object') {
      const converted: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        converted[key] = this.convertDates(value);
      }
      return converted;
    }

    return data;
  }

  /**
   * Get a single document by ID
   */
  async getDocument<T = DocumentData>(collectionPath: string, docId: string): Promise<T | null> {
    const startTime = performance.now();
    try {
      return runInInjectionContext(this.injector, async () => {
        const docRef = doc(this.firestore, collectionPath, docId);
        const docSnap = await getDoc(docRef);
        const duration = performance.now() - startTime;

        this.logger.logRead(collectionPath, docId, duration);

        return docSnap.exists() ? (this.convertDates(docSnap.data()) as T) : null;
      });
    } catch (error) {
      this.logger.logError('GET_DOCUMENT', collectionPath, error, docId);
      throw error;
    }
  }

  /**
   * Get all documents from a collection with optional query constraints
   */
  async getDocuments<T = DocumentData>(
    collectionPath: string,
    ...queryConstraints: QueryConstraint[]
  ): Promise<T[]> {
    const startTime = performance.now();
    try {
      return runInInjectionContext(this.injector, async () => {
        const collectionRef = collection(this.firestore, collectionPath);
        const q =
          queryConstraints.length > 0
            ? query(collectionRef, ...queryConstraints)
            : query(collectionRef);

        const snapshot = await getDocs(q);
        const results = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...(this.convertDates(doc.data()) as Record<string, unknown>) }) as T
        );
        const duration = performance.now() - startTime;

        const constraintsStr =
          queryConstraints.length > 0 ? `${queryConstraints.length} constraints` : 'no constraints';
        this.logger.logQuery(collectionPath, constraintsStr, results.length, duration);

        return results;
      });
    } catch (error) {
      this.logger.logError('GET_DOCUMENTS', collectionPath, error);
      throw error;
    }
  }

  /**
   * Create or overwrite a document
   */
  async setDocument(collectionPath: string, docId: string, data: DocumentData): Promise<void> {
    const startTime = performance.now();
    try {
      return runInInjectionContext(this.injector, async () => {
        const docRef = doc(this.firestore, collectionPath, docId);
        const cleanedData = this.cleanData(data) as DocumentData;
        await setDoc(docRef, cleanedData);
        const duration = performance.now() - startTime;

        this.logger.logWrite(collectionPath, docId, cleanedData, duration);
      });
    } catch (error) {
      this.logger.logError('SET_DOCUMENT', collectionPath, error, docId);
      throw error;
    }
  }

  /**
   * Update specific fields in a document
   */
  async updateDocument(
    collectionPath: string,
    docId: string,
    data: Partial<DocumentData>
  ): Promise<void> {
    const startTime = performance.now();
    try {
      return runInInjectionContext(this.injector, async () => {
        const docRef = doc(this.firestore, collectionPath, docId);
        const cleanedData = this.cleanData(data) as DocumentData;
        await updateDoc(docRef, cleanedData);
        const duration = performance.now() - startTime;

        this.logger.logUpdate(collectionPath, docId, cleanedData, duration);
      });
    } catch (error) {
      this.logger.logError('UPDATE_DOCUMENT', collectionPath, error, docId);
      throw error;
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(collectionPath: string, docId: string): Promise<void> {
    const startTime = performance.now();
    try {
      return runInInjectionContext(this.injector, async () => {
        const docRef = doc(this.firestore, collectionPath, docId);
        await deleteDoc(docRef);
        const duration = performance.now() - startTime;

        this.logger.logDelete(collectionPath, docId, duration);
      });
    } catch (error) {
      this.logger.logError('DELETE_DOCUMENT', collectionPath, error, docId);
      throw error;
    }
  }

  /**
   * Get a document reference
   */
  getDocRef(collectionPath: string, docId: string): DocumentReference {
    return doc(this.firestore, collectionPath, docId);
  }

  /**
   * Get a collection reference
   */
  getCollectionRef(collectionPath: string): CollectionReference {
    return collection(this.firestore, collectionPath);
  }
}
