'use client';
    
import { useState, useEffect, useMemo } from 'react';
import {
  DocumentData,
  FirestoreError,
  doc,
  getDoc,
} from 'firebase/firestore';
import { useFirestore } from '../provider';

/** Utility type to add an 'id' field to a given type T. */
type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useDocs hook.
 * @template T Type of the document data.
 */
export interface UseDocsResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: Error | null;
}


/**
 * React hook to fetch multiple documents from an array of paths.
 * This is a one-time fetch, not real-time.
 *
 * @template T Type of the document data.
 * @param {string[]} paths - An array of full document paths to fetch.
 * @returns {UseDocsResult<T>} Object with data array, isLoading, and error.
 */
export function useDocs<T = any>(
  paths: string[]
): UseDocsResult<T> {
  const [data, setData] = useState<WithId<T>[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const firestore = useFirestore();

  // Serialize and memoize the paths array to prevent unnecessary refetches
  const serializedPaths = useMemo(() => paths.sort().join(','), [paths]);

  useEffect(() => {
    if (!firestore || paths.length === 0) {
      setData([]);
      setIsLoading(false);
      return;
    }

    const fetchDocs = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Create an array of document references
        const docRefs = paths.map(path => doc(firestore, path));
        
        // Fetch all documents in parallel
        const docSnapshots = await Promise.all(docRefs.map(ref => getDoc(ref)));
        
        // Filter out documents that don't exist and map to data
        const fetchedData = docSnapshots
          .filter(snapshot => snapshot.exists())
          .map(snapshot => ({ ...(snapshot.data() as T), id: snapshot.id }));
        
        setData(fetchedData);
      } catch (e: any) {
        console.error("Error fetching multiple documents:", e);
        setError(e);
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocs();
  }, [firestore, serializedPaths]); // Re-run effect only when firestore instance or paths change

  return { data, isLoading, error };
}
