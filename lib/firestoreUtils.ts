import { db } from './firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';

export async function fetchCollection(coll: string) {
  const snapshot = await getDocs(collection(db, coll));
  return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
}

export async function addToCollection(coll: string, data: any) {
  return await addDoc(collection(db, coll), { ...data, timestamp: serverTimestamp() });
}

export async function deleteFromCollection(coll: string, id: string) {
  return await deleteDoc(doc(db, coll, id));
}

export async function moveDocBetweenCollections(fromColl: string, toColl: string, id: string) {
  const fromDocRef = doc(db, fromColl, id);
  const fromDocSnap = await getDoc(fromDocRef);
  if (!fromDocSnap.exists()) throw new Error('Document does not exist');
  const data = fromDocSnap.data();
  await addToCollection(toColl, data);
  await deleteFromCollection(fromColl, id);
} 