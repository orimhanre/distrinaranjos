import { useEffect } from "react";
import { auth } from "./firebase";
import { setPersistence, browserLocalPersistence } from "firebase/auth";

export function useFirebaseAuthPersistence() {
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.error("Failed to set Firebase Auth persistence:", err);
    });
  }, []);
} 