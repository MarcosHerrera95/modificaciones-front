/**
 * @component UrgentPricingConfig - Configuración de precios urgentes
 * @descripción Panel de administración para configurar reglas de precios dinámicos
 * @sprint Sprint 4 – Servicios Urgentes
 * @tarjeta Implementación completa de Sección 10 del PRD
 * @impacto Económico: Control administrativo de precios dinámicos
 */

import { useState, useEffect } from 'react';
import { useNotificationContext } from '../context/NotificationContext';

const UrgentPricingConfig = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newRule, setNewRule] = useState({
    service_category: '',
    base_multiplier: 1.5,
    min_price: 0
  });
  const notificationContext = useNotificationContext();

  // Cargar reglas existentes
  const loadPricingRules = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/urgent/pricing`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRules(data);
      } else {
        throw new Error('Error al cargar reglas de precios');
      }
    } catch (err) {
      console.error('Error loading pricing rules:', err);
      if (notificationContext?.addNotification) {
        notificationContext.addNotification({
          type: 'error',
          title: 'Error',
          message: 'No se pudieron cargar las reglas de precios.',
          duration: 4000
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Guardar reglas
  const savePricingRules = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/urgent/pricing/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('changanet_token')}`
        },
        body: JSON.stringify({ rules })
      });

      if (response.ok) {
        if (notificationContext?.addNotification) {
          notificationContext.addNotification({
            type: 'success',
            title: 'Reglas Actualizadas',
            message: 'Las reglas de precios urgentes han sido actualizadas exitosamente.',
            duration: 4000
          });
        }
        await loadPricingRules(); // Recargar para confirmar cambios
      } else {
        throw new Error('Error al guardar reglas');
      }
    } catch (err) {
      console.error('Error saving pricing rules:', err);
      if (notificationContext?.addNotification) {
        notificationContext.addNotification({
          type: 'error',
          title: 'Error',
          message: 'No se pudieron guardar las reglas de precios.',
          duration: 4000
        });
      }
    } finally {
      setSaving(false);
    }
  };

  // Agregar nueva regla
  const addNewRule = () => {
    if (!newRule.service_category.trim()) {
      if (notificationContext?.addNotification) {
        notificationContext.addNotification({
          type: 'warning',
          title: 'Campo requerido',
          message: 'Debes especificar la categoría del servicio.',
          duration: 3000
        });
      }
      return;
    }

    // Verificar que no exista ya
    if (rules.some(rule => rule.service_category === newRule.service_category)) {
      if (notificationContext?.addNotification) {
        notificationContext.addNotification({
          type: 'warning',
          title: 'Categoría duplicada',
          message: 'Ya existe una regla para esta categoría.',
          duration: 3000
        });
      }
      return;
    }

    setRules(prev => [...prev, { ...newRule }]);
    setNewRule({
      service_category: '',
      base_multiplier: 1.5,
      min_price: 0
    });
  };

  // Actualizar regla existente
  const updateRule = (index, field, value) => {
    setRules(prev => prev.map((rule, i) =>
      i === index ? { ...rule, [field]: value } : rule
    ));
  };

  // Eliminar regla
  const deleteRule = (index) => {
    setRules(prev => prev.filter((_, i) => i !== index));
  };

  // Calcular precio de ejemplo
  const calculateExamplePrice = (rule) => {
    const basePrice = 1000; // Precio base de ejemplo
    return Math.max(basePrice * rule.base_multiplier, rule.min_price);
  };

  useEffect(() => {
    loadPricingRules();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
          <span className="text-gray-600">Cargando configuración de precios...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">
              Configuración de Precios Urgentes
            </h2>
            <p className="text-blue-100 text-sm">
              Gestiona las reglas de precios dinámicos para servicios urgentes
            </p>
          </div>
          <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Información explicativa */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <div>
              <h4 className="text-blue-900 font-medium">¿Cómo funcionan los precios urgentes?</h4>
              <p className="text-blue-800 text-sm mt-1">
                El precio final se calcula como: <code className="bg-blue-100 px-1 rounded">MAX(precio_base × multiplicador, precio_mínimo)</code>.
                Los servicios urgentes siempre tienen un recargo para compensar la atención prioritaria.
              </p>
            </div>
          </div>
        </div>

        {/* Reglas existentes */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Reglas de Precios Actuales ({rules.length})
          </h3>

          {rules.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p>No hay reglas de precios configuradas.</p>
              <p className="text-sm">Los servicios urgentes usarán valores por defecto.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Categoría
                      </label>
                      <input
                        type="text"
                        value={rule.service_category}
                        onChange={(e) => updateRule(index, 'service_category', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Ej: Plomería"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Multiplicador
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="1.0"
                        value={rule.base_multiplier}
                        onChange={(e) => updateRule(index, 'base_multiplier', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Precio Mínimo
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={rule.min_price}
                        onChange={(e) => updateRule(index, 'min_price', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>

                    <div className="flex space-x-2">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Ejemplo
                        </label>
                        <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-green-800 font-semibold text-sm">
                            ${calculateExamplePrice(rule).toLocaleString('es-AR')}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteRule(index)}
                        className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar regla"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Agregar nueva regla */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Agregar Nueva Regla
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoría del Servicio
              </label>
              <input
                type="text"
                value={newRule.service_category}
                onChange={(e) => setNewRule(prev => ({ ...prev, service_category: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="Ej: Electricidad"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Multiplicador Base
              </label>
              <input
                type="number"
                step="0.1"
                min="1.0"
                value={newRule.base_multiplier}
                onChange={(e) => setNewRule(prev => ({ ...prev, base_multiplier: parseFloat(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Precio Mínimo
              </label>
              <input
                type="number"
                min="0"
                value={newRule.min_price}
                onChange={(e) => setNewRule(prev => ({ ...prev, min_price: parseFloat(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            <button
              onClick={addNewRule}
              className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors font-medium text-sm flex items-center justify-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Agregar</span>
            </button>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex justify-end space-x-4 mt-6 pt-6 border-t">
          <button
            onClick={loadPricingRules}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Cancelar Cambios
          </button>
          <button
            onClick={savePricingRules}
            disabled={saving}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-all duration-300 font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Guardar Cambios</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UrgentPricingConfig;