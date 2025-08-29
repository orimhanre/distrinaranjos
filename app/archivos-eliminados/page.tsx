"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ArchivosEliminadosRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Redirigiendo...</h1>
        <p className="text-gray-600">Redirigiendo a la página principal.</p>
      </div>
    </div>
  );
} 