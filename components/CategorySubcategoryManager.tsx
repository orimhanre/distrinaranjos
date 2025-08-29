'use client';

import React, { useState, useEffect } from 'react';

interface CategorySubcategoryRelation {
  id: string;
  category: string;
  subcategory: string;
  isActive: boolean;
}

interface CategorySubcategoryManagerProps {
  className?: string;
}

export default function CategorySubcategoryManager({ className = '' }: CategorySubcategoryManagerProps) {
  const [relations, setRelations] = useState<CategorySubcategoryRelation[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Form states for adding new relations
  const [newCategory, setNewCategory] = useState('');
  const [newSubcategory, setNewSubcategory] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Custom confirmation dialog states
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMessage, setConfirmMessage] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  // Listen for sync completion events
  useEffect(() => {
    const handleSyncComplete = () => {
      console.log('🔄 CategorySubcategoryManager: Sync completed, refreshing data...');
      loadData();
    };

    // Listen for custom sync events
    window.addEventListener('virtual-sync-complete', handleSyncComplete);

    return () => {
      window.removeEventListener('virtual-sync-complete', handleSyncComplete);
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load existing relations
      const relationsResponse = await fetch('/api/database/virtual-category-relations');
      if (relationsResponse.ok) {
        const relationsData = await relationsResponse.json();
        console.log('Relations API Response:', relationsData);
        
        if (relationsData.success) {
          setRelations(relationsData.relations || []);
        } else {
          console.error('Relations API error:', relationsData.error);
          setRelations([]);
        }
      } else {
        console.error('Relations API HTTP error:', relationsResponse.status);
        setRelations([]);
      }

      // Load all categories and subcategories from products
      try {
        const productsResponse = await fetch('/api/database/virtual-products');
        if (productsResponse.ok) {
          const productsData = await productsResponse.json();
          const allCategories = new Set<string>();
          const allSubcategories = new Set<string>();

          productsData.products.forEach((product: any) => {
            if (product.category) {
              if (Array.isArray(product.category)) {
                product.category.forEach((cat: string) => allCategories.add(cat));
              } else {
                allCategories.add(product.category);
              }
            }
            if (product.subCategory) {
              if (Array.isArray(product.subCategory)) {
                product.subCategory.forEach((subcat: string) => allSubcategories.add(subcat));
              } else {
                allSubcategories.add(product.subCategory);
              }
            }
          });

          setCategories(Array.from(allCategories).sort());
          setSubcategories(Array.from(allSubcategories).sort());
        } else {
          setCategories([]);
          setSubcategories([]);
        }
      } catch (error) {
        console.error('Error loading products:', error);
        setCategories([]);
        setSubcategories([]);
      }
    } catch (error) {
      console.error('Error loading category-subcategory data:', error);
      setMessage({ type: 'error', text: 'Error al cargar datos' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddRelation = async () => {
    if (!newCategory || !newSubcategory) {
      setMessage({ type: 'error', text: 'Por favor selecciona tanto la categoría como la subcategoría' });
      return;
    }

    // Check if relation already exists
    const exists = relations.some(rel => 
      rel.category === newCategory && rel.subcategory === newSubcategory
    );

    if (exists) {
      setMessage({ type: 'error', text: 'Esta relación ya existe' });
      return;
    }

    try {
      setSaving(true);
      
      const response = await fetch('/api/database/virtual-category-relations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: newCategory,
          subcategory: newSubcategory,
          isActive: true
        })
      });

      if (response.ok) {
        const newRelation = await response.json();
        console.log('API Response:', newRelation);
        
        if (newRelation.success && newRelation.relation) {
          setRelations([...relations, newRelation.relation]);
          setNewCategory('');
          setNewSubcategory('');
          setShowAddForm(false);
          setMessage({ type: 'success', text: 'Relación agregada exitosamente' });
        } else {
          throw new Error('Invalid response format');
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error adding relation:', error);
      setMessage({ type: 'error', text: 'Error al agregar relación' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRelation = async (relationId: string) => {
    try {
      setSaving(true);
      
      const response = await fetch(`/api/database/virtual-category-relations/${relationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toggle: true })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Toggle Response:', result);
        
        if (result.success && result.relation) {
          setRelations(relations.map(rel => 
            rel.id === relationId ? result.relation : rel
          ));
          setMessage({ type: 'success', text: 'Relación actualizada exitosamente' });
        } else {
          throw new Error('Invalid response format');
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error updating relation:', error);
      setMessage({ type: 'error', text: 'Error al actualizar relación' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRelation = async (relationId: string) => {
    setConfirmMessage('¿Estás seguro de que quieres eliminar esta relación?');
    setConfirmAction(() => async () => {
      try {
        setSaving(true);
        
        const response = await fetch(`/api/database/virtual-category-relations/${relationId}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          const result = await response.json();
          console.log('Delete Response:', result);
          
          if (result.success) {
            setRelations(relations.filter(rel => rel.id !== relationId));
            setMessage({ type: 'success', text: 'Relación eliminada exitosamente' });
          } else {
            throw new Error('Invalid response format');
          }
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        console.error('Error deleting relation:', error);
        setMessage({ type: 'error', text: 'Error al eliminar relación' });
      } finally {
        setSaving(false);
      }
    });
    setShowConfirmDialog(true);
  };

  const activeRelations = relations.filter(rel => rel.isActive);
  const inactiveRelations = relations.filter(rel => !rel.isActive);

  if (loading) {
    return <div className={`p-4 ${className}`}>Cargando gestor de relaciones categoría-subcategoría...</div>;
  }

  return (
    <div className={`p-3 sm:p-6 bg-white rounded-lg shadow-md ${className}`}>
      <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-gray-900">Relaciones Categoría-Subcategoría</h2>
      
      {/* Instructions */}
      <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="text-base sm:text-lg font-semibold mb-2 text-yellow-800">Cómo Crear Relaciones</h3>
        <div className="text-xs sm:text-sm text-yellow-700 space-y-2">
          <div className="flex items-start space-x-2">
            <span className="text-yellow-600 mt-1">1.</span>
            <span>Haz clic en el botón "Add New Relation" de abajo</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-yellow-600 mt-1">2.</span>
            <span>Selecciona una categoría del menú desplegable (ej., "Electronics")</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-yellow-600 mt-1">3.</span>
            <span>Selecciona una subcategoría del menú desplegable (ej., "Smartphones")</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-yellow-600 mt-1">4.</span>
            <span>Haz clic en "Add Relation" para crear la relación</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-yellow-600 mt-1">•</span>
            <span>Las categorías y subcategorías disponibles se muestran en la parte inferior</span>
          </div>
        </div>
      </div>
      
      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-md ${
          message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Summary */}
      <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-50 rounded-lg">
        <h3 className="text-base sm:text-lg font-semibold mb-2 text-gray-900">Resumen</h3>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
          <div>
            <span className="font-medium text-gray-700">Total Categorías:</span>
            <span className="ml-2 text-blue-600 font-semibold">{categories.length}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Total Subcategorías:</span>
            <span className="ml-2 text-blue-600 font-semibold">{subcategories.length}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Relaciones Activas:</span>
            <span className="ml-2 text-green-600 font-semibold">{activeRelations.length}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Relaciones Inactivas:</span>
            <span className="ml-2 text-gray-600 font-semibold">{inactiveRelations.length}</span>
          </div>
        </div>
      </div>

      {/* Add New Relation */}
      <div className="mb-6">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          disabled={categories.length === 0 || subcategories.length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {showAddForm ? 'Cancelar' : 'Agregar Nueva Relación'}
        </button>

        {categories.length === 0 || subcategories.length === 0 ? (
          <div className="mt-4 p-4 border rounded-lg bg-yellow-50 border-yellow-200">
            <h4 className="font-semibold mb-2 text-yellow-800">No Hay Datos Disponibles</h4>
            <div className="text-sm text-yellow-700 space-y-1">
              {categories.length === 0 && (
                <div>• No se encontraron categorías en tu base de datos de productos</div>
              )}
              {subcategories.length === 0 && (
                <div>• No se encontraron subcategorías en tu base de datos de productos</div>
              )}
              <div className="mt-2">
                Agrega categorías y subcategorías a tus productos primero, luego podrás crear relaciones entre ellas.
              </div>
            </div>
          </div>
        ) : showAddForm && (
          <div className="mt-4 p-4 border rounded-lg bg-gray-50">
            <h4 className="font-semibold mb-3 text-gray-900">Agregar Nueva Relación Categoría-Subcategoría</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoría
                  </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                >
                  <option value="" className="text-gray-900">Selecciona una categoría...</option>
                  {categories.map(category => (
                    <option key={category} value={category} className="text-gray-900">
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subcategoría
                  </label>
                <select
                  value={newSubcategory}
                  onChange={(e) => setNewSubcategory(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                >
                  <option value="" className="text-gray-900">Selecciona una subcategoría...</option>
                  {subcategories.map(subcategory => (
                    <option key={subcategory} value={subcategory} className="text-gray-900">
                      {subcategory}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 flex space-x-2">
              <button
                onClick={handleAddRelation}
                disabled={saving || !newCategory || !newSubcategory}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Agregando...' : 'Agregar Relación'}
              </button>
              <button
                onClick={() => {
                  setNewCategory('');
                  setNewSubcategory('');
                  setShowAddForm(false);
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Active Relations */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3 text-green-700">
          Relaciones Activas ({activeRelations.length})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
          {activeRelations.map(relation => (
            <div key={relation.id} className="border rounded-lg p-3 bg-green-50 border-green-200 hover:shadow-md transition-shadow duration-200">
              <div className="mb-2">
                <div className="font-semibold text-green-800 text-sm mb-1">{relation.category}</div>
                <div className="text-xs text-gray-700">→ {relation.subcategory}</div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleToggleRelation(relation.id)}
                  disabled={saving}
                  className="px-1 py-0.5 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50 flex-1 transition-colors duration-200"
                  title="Deactivate"
                >
                  Desact.
                </button>
                <button
                  onClick={() => handleDeleteRelation(relation.id)}
                  disabled={saving}
                  className="px-1 py-0.5 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 flex-1 transition-colors duration-200"
                  title="Eliminar"
                >
                  Elim.
                </button>
              </div>
            </div>
          ))}
        </div>
        {activeRelations.length === 0 && (
          <div className="text-gray-600 text-center py-4 font-medium">No hay relaciones activas</div>
        )}
      </div>

      {/* Inactive Relations */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3 text-gray-700">
          Relaciones Inactivas ({inactiveRelations.length})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
          {inactiveRelations.map(relation => (
            <div key={relation.id} className="border rounded-lg p-3 bg-gray-50 border-gray-200 hover:shadow-md transition-shadow duration-200">
              <div className="mb-2">
                <div className="font-semibold text-gray-800 text-sm mb-1">{relation.category}</div>
                <div className="text-xs text-gray-700">→ {relation.subcategory}</div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleToggleRelation(relation.id)}
                  disabled={saving}
                  className="px-1 py-0.5 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 flex-1 transition-colors duration-200"
                  title="Activate"
                >
                  Activar
                </button>
                <button
                  onClick={() => handleDeleteRelation(relation.id)}
                  disabled={saving}
                  className="px-1 py-0.5 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 flex-1 transition-colors duration-200"
                  title="Eliminar"
                >
                  Elim.
                </button>
              </div>
            </div>
          ))}
        </div>
        {inactiveRelations.length === 0 && (
          <div className="text-gray-600 text-center py-4 font-medium">No hay relaciones inactivas</div>
        )}
      </div>

      {/* Available Categories and Subcategories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold mb-3 text-gray-900">Categorías Disponibles</h3>
          <div className="max-h-40 overflow-y-auto border rounded-lg p-3 bg-gray-50">
            {categories.length > 0 ? (
              categories.map(category => (
                <div key={category} className="text-sm py-1 text-gray-800">
                  • {category}
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500 italic">No se encontraron categorías en la base de datos</div>
            )}
          </div>
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-3 text-gray-900">Subcategorías Disponibles</h3>
          <div className="max-h-40 overflow-y-auto border rounded-lg p-3 bg-gray-50">
            {subcategories.length > 0 ? (
              subcategories.map(subcategory => (
                <div key={subcategory} className="text-sm py-1 text-gray-800">
                  • {subcategory}
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500 italic">No se encontraron subcategorías en la base de datos</div>
            )}
          </div>
        </div>
      </div>

      {/* Custom Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirmar Acción</h3>
            <p className="text-gray-700 mb-6">{confirmMessage}</p>
            <div className="flex space-x-3 justify-end">
              <button
                onClick={() => {
                  setShowConfirmDialog(false);
                  setConfirmAction(null);
                  setConfirmMessage('');
                }}
                className="px-4 py-2 text-gray-600 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (confirmAction) {
                    confirmAction();
                  }
                  setShowConfirmDialog(false);
                  setConfirmAction(null);
                  setConfirmMessage('');
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 