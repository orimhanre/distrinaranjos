import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Página no encontrada
            </h2>
            <p className="text-gray-600 mb-6">
              La página de administración que buscas no existe.
            </p>
            <Link
              href="/admin"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              Volver al panel de administración
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 