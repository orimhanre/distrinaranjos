export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Cargando administración...
            </h2>
            <p className="text-gray-500">
              Por favor espera mientras se cargan los datos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 