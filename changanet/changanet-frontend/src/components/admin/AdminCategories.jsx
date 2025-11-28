import React, { useState, useEffect } from 'react';
import { useAdmin } from '../../context/AdminContext';
import { adminCategoriesAPI } from '../../services/adminApiService';
import LoadingSpinner from '../LoadingSpinner';
import ErrorAlert from '../ErrorAlert';

const AdminCategories = () => {
  const { isAdmin, error: adminError } = useAdmin();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    icono: '',
    color: '#3B82F6',
    activa: true
  });

  // Load categories
  const loadCategories = async () => {
    if (!isAdmin) return;

    try {
      setLoading(true);
      setError(null);

      const response = await adminCategoriesAPI.getAll();
      setCategories(response.data || []);
    } catch (err) {
      console.error('Error loading categories:', err);
      setError(err.message || 'Error al cargar categorías');
    } finally {
      setLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nombre.trim()) {
      alert('El nombre de la categoría es obligatorio');
      return;
    }

    try {
      setActionLoading('form');

      if (editingCategory) {
        // Update category
        await adminCategoriesAPI.updateCategory(editingCategory.id, formData);
        alert('Categoría actualizada exitosamente');
      } else {
        // Create category
        await adminCategoriesAPI.createCategory(formData);
        alert('Categoría creada exitosamente');
      }

      // Reset form and reload
      resetForm();
      await loadCategories();
    } catch (err) {
      console.error('Error saving category:', err);
      alert(`Error al ${editingCategory ? 'actualizar' : 'crear'} categoría: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle edit
  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      nombre: category.nombre || '',
      descripcion: category.descripcion || '',
      icono: category.icono || '',
      color: category.color || '#3B82F6',
      activa: category.activa !== false
    });
    setShowCreateForm(true);
  };

  // Handle delete
  const handleDelete = async (categoryId, categoryName) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar la categoría "${categoryName}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      setActionLoading(categoryId);
      await adminCategoriesAPI.deleteCategory(categoryId);
      alert('Categoría eliminada exitosamente');
      await loadCategories();
    } catch (err) {
      console.error('Error deleting category:', err);
      alert(`Error al eliminar categoría: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle reorder
  const handleReorder = async (categoryId, direction) => {
    const currentIndex = categories.findIndex(cat => cat.id === categoryId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= categories.length) return;

    try {
      setActionLoading(categoryId);

      // Create new order array
      const newCategories = [...categories];
      const [movedCategory] = newCategories.splice(currentIndex, 1);
      newCategories.splice(newIndex, 0, movedCategory);

      const newOrder = newCategories.map(cat => cat.id);

      await adminCategoriesAPI.reorderCategories(newOrder);
      setCategories(newCategories);
    } catch (err) {
      console.error('Error reordering categories:', err);
      alert(`Error al reordenar categorías: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      nombre: '',
      descripcion: '',
      icono: '',
      color: '#3B82F6',
      activa: true
    });
    setEditingCategory(null);
    setShowCreateForm(false);
  };

  // Handle form input changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  useEffect(() => {
    loadCategories();
  }, [isAdmin]);

  // Redirect if not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Denegado</h2>
          <p className="text-gray-600">{adminError || 'No tienes permisos para acceder a esta sección'}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Gestión de Categorías</h2>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            {showCreateForm ? 'Cancelar' : 'Nueva Categoría'}
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && <ErrorAlert message={error} onClose={() => setError(null)} />}

      {/* Create/Edit Form */}
      {showCreateForm && (
        <div className="mb-6 bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">
            {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => handleInputChange('nombre', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Plomería, Electricidad..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Icono (emoji)
                </label>
                <input
                  type="text"
                  value={formData.icono}
                  onChange={(e) => handleInputChange('icono', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="🔧, ⚡, 🛠️..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción
              </label>
              <textarea
                value={formData.descripcion}
                onChange={(e) => handleInputChange('descripcion', e.target.value)}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Descripción de la categoría..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Color
                </label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => handleInputChange('color', e.target.value)}
                  className="w-full h-10 border border-gray-300 rounded-md cursor-pointer"
                />
              </div>

              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.activa}
                    onChange={(e) => handleInputChange('activa', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-700">Categoría activa</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={actionLoading === 'form'}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 'form' ? 'Guardando...' : (editingCategory ? 'Actualizar' : 'Crear')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Categories List */}
      <div className="space-y-4">
        {categories.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay categorías</h3>
            <p className="text-gray-600 mb-4">Crea tu primera categoría para organizar los servicios</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Crear Primera Categoría
            </button>
          </div>
        ) : (
          categories.map((category, index) => (
            <div
              key={category.id}
              className={`border border-gray-200 rounded-lg p-4 ${
                !category.activa ? 'bg-gray-50 opacity-75' : 'bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {/* Reorder buttons */}
                  <div className="flex flex-col space-y-1">
                    <button
                      onClick={() => handleReorder(category.id, 'up')}
                      disabled={index === 0 || actionLoading === category.id}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleReorder(category.id, 'down')}
                      disabled={index === categories.length - 1 || actionLoading === category.id}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ▼
                    </button>
                  </div>

                  {/* Category info */}
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg"
                      style={{ backgroundColor: category.color || '#3B82F6' }}
                    >
                      {category.icono || '📋'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {category.nombre}
                        {!category.activa && (
                          <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                            Inactiva
                          </span>
                        )}
                      </h3>
                      {category.descripcion && (
                        <p className="text-sm text-gray-600">{category.descripcion}</p>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        Servicios: {category._count?.servicios || 0} |
                        Creado: {new Date(category.creado_en).toLocaleDateString('es-ES')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(category)}
                    disabled={actionLoading === category.id}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === category.id ? '...' : 'Editar'}
                  </button>
                  <button
                    onClick={() => handleDelete(category.id, category.nombre)}
                    disabled={actionLoading === category.id}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === category.id ? '...' : 'Eliminar'}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminCategories;