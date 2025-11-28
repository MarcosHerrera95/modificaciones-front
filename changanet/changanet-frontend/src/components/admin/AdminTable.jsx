import React from 'react';
import LoadingSpinner from '../LoadingSpinner';

const AdminTable = ({
  columns = [],
  data = [],
  loading = false,
  error = null,
  pagination = null,
  onPageChange = () => {},
  onSort = () => {},
  sortField = '',
  sortDirection = 'asc',
  emptyMessage = 'No se encontraron registros',
  emptyIcon = '📋',
  className = '',
  actions = null // Custom actions column
}) => {
  // Handle sort
  const handleSort = (field) => {
    if (!field) return;

    let direction = 'asc';
    if (sortField === field && sortDirection === 'asc') {
      direction = 'desc';
    }

    onSort(field, direction);
  };

  // Render cell content
  const renderCell = (item, column) => {
    if (column.render) {
      return column.render(item[column.key], item, column);
    }

    const value = item[column.key];

    // Handle different data types
    if (value === null || value === undefined) {
      return <span className="text-gray-400">-</span>;
    }

    if (column.type === 'date') {
      return new Date(value).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }

    if (column.type === 'datetime') {
      return new Date(value).toLocaleString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    if (column.type === 'boolean') {
      return (
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
          value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {value ? 'Sí' : 'No'}
        </span>
      );
    }

    if (column.type === 'status') {
      const statusConfig = column.statusConfig || {};
      const config = statusConfig[value] || { label: value, className: 'bg-gray-100 text-gray-800' };

      return (
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${config.className}`}>
          {config.label}
        </span>
      );
    }

    if (column.type === 'currency') {
      return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'ARS'
      }).format(value);
    }

    if (column.type === 'number') {
      return new Intl.NumberFormat('es-ES').format(value);
    }

    // Default text rendering
    if (typeof value === 'string' && value.length > 50) {
      return (
        <span title={value}>
          {value.substring(0, 50)}...
        </span>
      );
    }

    return value;
  };

  // Render pagination
  const renderPagination = () => {
    if (!pagination || pagination.pages <= 1) return null;

    const { currentPage, pages, total } = pagination;
    const maxVisiblePages = 5;

    // Calculate page range to show
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(pages, startPage + maxVisiblePages - 1);

    // Adjust start page if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    const pageNumbers = [];
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return (
      <div className="flex items-center justify-between mt-6">
        <div className="text-sm text-gray-700">
          Mostrando página {currentPage} de {pages} ({total} registros)
        </div>
        <div className="flex space-x-1">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>

          {/* First page + ellipsis if needed */}
          {startPage > 1 && (
            <>
              <button
                onClick={() => onPageChange(1)}
                className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                1
              </button>
              {startPage > 2 && <span className="px-2 py-1 text-gray-500">...</span>}
            </>
          )}

          {/* Page numbers */}
          {pageNumbers.map(pageNum => (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`px-3 py-1 text-sm rounded ${
                pageNum === currentPage
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {pageNum}
            </button>
          ))}

          {/* Last page + ellipsis if needed */}
          {endPage < pages && (
            <>
              {endPage < pages - 1 && <span className="px-2 py-1 text-gray-500">...</span>}
              <button
                onClick={() => onPageChange(pages)}
                className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                {pages}
              </button>
            </>
          )}

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= pages}
            className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-12">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error al cargar datos</h3>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={column.key || index}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                  } ${column.className || ''}`}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.label}</span>
                    {column.sortable && (
                      <span className="text-gray-400">
                        {sortField === column.key ? (
                          sortDirection === 'asc' ? '↑' : '↓'
                        ) : '↕'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
              {actions && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="px-6 py-12 text-center"
                >
                  <div className="text-center">
                    <div className="text-4xl mb-4">{emptyIcon}</div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {emptyMessage}
                    </h3>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((item, rowIndex) => (
                <tr key={item.id || rowIndex} className="hover:bg-gray-50">
                  {columns.map((column, colIndex) => (
                    <td
                      key={column.key || colIndex}
                      className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${column.cellClassName || ''}`}
                    >
                      {renderCell(item, column)}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {actions(item)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {renderPagination()}
    </div>
  );
};

export default AdminTable;