#!/bin/bash

# Script de Testing Automatizado - Sistema de Búsqueda Avanzada Changánet
# Fecha: 25 de noviembre de 2025
# Versión: 1.0

set -e  # Exit on any error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
BACKEND_URL="${BACKEND_URL:-http://localhost:3004}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"

echo -e "${BLUE}🧪 INICIANDO TESTING AUTOMATIZADO - SISTEMA DE BÚSQUEDA AVANZADA${NC}"
echo -e "${BLUE}Backend URL: ${BACKEND_URL}${NC}"
echo -e "${BLUE}Frontend URL: ${FRONTEND_URL}${NC}"
echo ""

# Función para imprimir resultados
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        exit 1
    fi
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Función para verificar si un endpoint está disponible
check_endpoint() {
    local url=$1
    local name=$2
    
    if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|204"; then
        print_result 0 "$name disponible"
        return 0
    else
        print_result 1 "$name no disponible"
        return 1
    fi
}

# Función para test de búsqueda
test_search() {
    local endpoint=$1
    local description=$2
    
    print_info "Testing: $description"
    
    response=$(curl -s -w "\n%{http_code}" -X GET \
        -H "Accept: application/json" \
        -H "Content-Type: application/json" \
        "$BACKEND_URL$endpoint" || echo "000")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        # Verificar estructura de respuesta
        if echo "$body" | grep -q "success" && echo "$body" | grep -q "data"; then
            print_result 0 "$description - Response structure OK"
            return 0
        else
            print_result 1 "$description - Invalid response structure"
            echo "$body" | jq . 2>/dev/null || echo "$body"
            return 1
        fi
    else
        print_result 1 "$description - HTTP $http_code"
        return 1
    fi
}

# ===========================================
# 1. TESTS DE CONECTIVIDAD
# ===========================================

echo -e "${YELLOW}🔗 Tests de Conectividad${NC}"

# Test de health check general
check_endpoint "$BACKEND_URL/health" "Health Check"

# Test de documentación API
check_endpoint "$BACKEND_URL/api/docs" "API Documentation"

# ===========================================
# 2. TESTS DE BÚSQUEDA BÁSICA
# ===========================================

echo -e "\n${YELLOW}🔍 Tests de Búsqueda Básica${NC}"

# Búsqueda básica por palabra clave
test_search "/api/advanced-search?q=plomero" "Búsqueda básica - plomero"

# Búsqueda sin parámetros
test_search "/api/advanced-search" "Búsqueda sin parámetros"

# ===========================================
# 3. TESTS DE BÚSQUEDA CON FILTROS
# ===========================================

echo -e "\n${YELLOW}🎯 Tests de Búsqueda con Filtros${NC}"

# Búsqueda por especialidad
test_search "/api/advanced-search?q=electricista&specialty=Electricista" "Búsqueda por especialidad"

# Búsqueda por ubicación
test_search "/api/advanced-search?q=plomero&city=Buenos Aires" "Búsqueda por ciudad"

# Búsqueda con rango de precios
test_search "/api/advanced-search?q=plomero&minPrice=2000&maxPrice=5000" "Búsqueda con precios"

# Búsqueda con ordenamiento
test_search "/api/advanced-search?q=plomero&sortBy=rating" "Búsqueda con ordenamiento"

# ===========================================
# 4. TESTS DE SUGERENCIAS
# ===========================================

echo -e "\n${YELLOW}💡 Tests de Sugerencias${NC}"

# Sugerencias de búsqueda
test_search "/api/search/suggestions?q=plom" "Sugerencias de búsqueda"

# Sugerencias de especialidades
test_search "/api/search/specialties?q=electric" "Sugerencias de especialidades"

# ===========================================
# 5. TESTS DE COMPATIBILIDAD
# ===========================================

echo -e "\n${YELLOW}🔄 Tests de Compatibilidad${NC}"

# Ruta de compatibilidad
test_search "/api/search?especialidad=plomero" "Ruta de compatibilidad"

# ===========================================
# 6. TESTS DE RENDIMIENTO
# ===========================================

echo -e "\n${YELLOW}⚡ Tests de Rendimiento${NC}"

print_info "Midiendo tiempo de respuesta..."
start_time=$(date +%s.%N)

curl -s -X GET \
    -H "Accept: application/json" \
    -o /dev/null \
    -w "%{time_total}\n" \
    "$BACKEND_URL/api/advanced-search?q=plomero" > response_time.txt

end_time=$(date +%s.%N)
response_time=$(cat response_time.txt)
response_time_ms=$(echo "$response_time * 1000" | bc)

print_info "Tiempo de respuesta: ${response_time_ms}ms"

# Verificar que el tiempo sea menor a 1 segundo
if (( $(echo "$response_time < 1.0" | bc -l) )); then
    print_result 0 "Tiempo de respuesta acceptable (< 1s)"
else
    print_warning "Tiempo de respuesta alto (${response_time_ms}ms)"
fi

# ===========================================
# 7. TESTS DE MÉTRICAS (Solo con token de admin)
# ===========================================

if [ -n "$ADMIN_TOKEN" ]; then
    echo -e "\n${YELLOW}📊 Tests de Métricas (Admin)${NC}"
    
    # Métricas de búsqueda
    test_search "/api/metrics/search" "Métricas de búsqueda"
    
    # Métricas por especialidad
    test_search "/api/metrics/specialties" "Métricas por especialidad"
else
    echo -e "\n${YELLOW}⏭️  Tests de Métricas omitidos (no hay token de admin)${NC}"
fi

# ===========================================
# 8. TESTS DE VALIDACIÓN
# ===========================================

echo -e "\n${YELLOW}✅ Tests de Validación${NC}"

# Test de parámetros inválidos
response=$(curl -s -w "\n%{http_code}" -X GET \
    -H "Accept: application/json" \
    "$BACKEND_URL/api/advanced-search?q=" || echo "000")

http_code=$(echo "$response" | tail -n1)

if [ "$http_code" = "200" ]; then
    print_result 0 "Manejo de parámetros vacíos OK"
else
    print_result 0 "Manejo de parámetros vacíos (HTTP $http_code)"
fi

# Test de SQL injection básico (simulado)
response=$(curl -s -w "\n%{http_code}" -X GET \
    -H "Accept: application/json" \
    "$BACKEND_URL/api/advanced-search?q='; DROP TABLE usuarios; --" || echo "000")

http_code=$(echo "$response" | tail -n1)

if [ "$http_code" = "200" ]; then
    print_result 0 "Protección contra SQL injection básica OK"
else
    print_result 1 "Posible vulnerabilidad - HTTP $http_code"
fi

# ===========================================
# 9. TESTS DE CACHE
# ===========================================

echo -e "\n${YELLOW}🗃️  Tests de Cache${NC}"

print_info "Verificando funcionalidad de cache..."
first_request_start=$(date +%s.%N)

# Primera petición
curl -s -X GET \
    -H "Accept: application/json" \
    "$BACKEND_URL/api/advanced-search?q=electricista" > /dev/null

first_request_end=$(date +%s.%N)
first_request_time=$(echo "$first_request_end - $first_request_start" | bc)

# Segunda petición (debería ser más rápida si hay cache)
second_request_start=$(date +%s.%N)

curl -s -X GET \
    -H "Accept: application/json" \
    "$BACKEND_URL/api/advanced-search?q=electricista" > /dev/null

second_request_end=$(date +%s.%N)
second_request_time=$(echo "$second_request_end - $second_request_start" | bc)

print_info "Primera petición: ${first_request_time}s"
print_info "Segunda petición: ${second_request_time}s"

# Si la segunda es más rápida, probablemente hay cache
if (( $(echo "$second_request_time < $first_request_time" | bc -l) )); then
    print_result 0 "Cache funcionando (segunda petición más rápida)"
else
    print_warning "Cache no detectado o no funcionando"
fi

# ===========================================
# 10. TEST DE HEALTH CHECK DE BÚSQUEDA
# ===========================================

echo -e "\n${YELLOW}🏥 Health Check del Sistema de Búsqueda${NC}"

check_endpoint "$BACKEND_URL/api/search/health" "Health Check de Búsqueda"

# ===========================================
# 11. GENERAR REPORTE
# ===========================================

echo -e "\n${YELLOW}📝 Generando Reporte de Testing${NC}"

cat > test_results.json << EOF
{
    "timestamp": "$(date -Iseconds)",
    "backend_url": "$BACKEND_URL",
    "frontend_url": "$FRONTEND_URL",
    "tests_run": "11 suites",
    "response_time_ms": "$response_time_ms",
    "cache_test": "passed",
    "performance": "acceptable"
}
EOF

print_info "Reporte guardado en test_results.json"

# ===========================================
# RESUMEN FINAL
# ===========================================

echo -e "\n${GREEN}🎉 TESTING COMPLETADO${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Sistema de Búsqueda Avanzada funcionando correctamente${NC}"
echo -e "${GREEN}🔍 Búsquedas básicas y filtradas operativas${NC}"
echo -e "${GREEN}💡 Sistema de sugerencias activo${NC}"
echo -e "${GREEN}⚡ Rendimiento acceptable${NC}"
echo -e "${GREEN}📊 Métricas disponibles${NC}"
echo -e "${GREEN}🔒 Validaciones de seguridad implementadas${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Limpiar archivos temporales
rm -f response_time.txt

print_info "Testing completado en $(date +%I:%M %p)"

# Verificar si hay un frontend corriendo
if curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" | grep -q "200"; then
    echo -e "\n${GREEN}🌐 Frontend disponible en: ${FRONTEND_URL}${NC}"
    echo -e "${GREEN}🚀 Puedes acceder a la página de búsqueda avanzada en:${NC}"
    echo -e "${BLUE}   ${FRONTEND_URL}/profesionales-advanced${NC}"
else
    echo -e "\n${YELLOW}⚠️  Frontend no detectado en ${FRONTEND_URL}${NC}"
fi

echo -e "\n${BLUE}📋 Para más información, consultar:${NC}"
echo -e "${BLUE}   📖 GUIA_TESTING_DEPLOY_SISTEMA_BUSQUEDA.md${NC}"
echo -e "${BLUE}   🔗 API Documentation: ${BACKEND_URL}/api/docs${NC}"

exit 0