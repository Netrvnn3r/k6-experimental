# Plan de Pruebas de Rendimiento — Plataforma E-Commerce

## 1. Resumen Ejecutivo

Este plan define la estrategia, alcance y enfoque de ejecución para las pruebas de rendimiento de la API de la plataforma e-commerce en `perfappdemo.vercel.app`. El objetivo es identificar cuellos de botella, establecer líneas base de rendimiento y proporcionar recomendaciones de mejora concretas y accionables.

### Contexto del Challenge
La plataforma ha reportado **degradación en la capacidad de respuesta durante eventos de alto tráfico** (ej: campañas estacionales tipo "Cyber"). Se nos pide diseñar, ejecutar y evaluar pruebas de rendimiento para descubrir las causas raíz y proponer mejoras concretas.

---

## 2. Objetivos

| ID | Objetivo | Criterio de Aceptación |
|----|----------|----------------------|
| O1 | Establecer tiempos de respuesta base | p(95) de todos los endpoints documentado |
| O2 | Determinar concurrencia máxima sostenible | Encontrar nivel de VUs donde la tasa de error supere el 5% |
| O3 | Identificar características del cuello de botella del checkout | Cuantificar el impacto del CPU loop en la latencia |
| O4 | Evaluar costo de paginación a escala | Comparar latencia de paginación superficial vs profunda |
| O5 | Evaluar estabilidad bajo carga sostenida | Sin tendencia de degradación en 15 minutos de soak |
| O6 | Validar preparación para flash sales | Medir tiempo de recuperación después de un spike de tráfico |

## 3. Alcance

### Incluido
- Autenticación (POST/DELETE `/api/auth`)
- API de Productos (GET/POST/PATCH `/api/products`)
- API de Usuarios (GET/POST `/api/users`)
- API de Órdenes (POST/GET `/api/orders`)
- Comportamiento de paginación en números de página altos
- Procesamiento CPU-bound del checkout

### Fuera de Alcance
- Rendimiento a nivel de UI/navegador
- Monitoreo a nivel de base de datos (no tenemos acceso directo)
- Rendimiento de CDN/assets estáticos
- Pruebas de infraestructura de red

## 4. Criterios de Aceptación de Rendimiento

| Métrica | Objetivo | Umbral Crítico |
|---------|----------|---------------|
| Latencia de login p(95) | < 1,000ms | < 2,000ms |
| Listado/búsqueda de productos p(95) | < 1,500ms | < 3,000ms |
| Creación de orden (checkout) p(95) | < 3,000ms | < 5,000ms |
| Listado de usuarios p(95) | < 1,500ms | < 3,000ms |
| Tasa de error global | < 1% | < 5% |
| Throughput (estado estable) | > 10 req/s | > 5 req/s |

## 5. Escenarios de Prueba

### 5.1 Smoke Test
- **Propósito**: Validar que todos los endpoints sean funcionales
- **VUs**: 1 | **Iteraciones**: 1
- **Duración**: ~30 segundos
- **Criterio de aprobación**: Todos los endpoints retornan 200, sin errores

### 5.2 Load Test
- **Propósito**: Simular tráfico de producción normal
- **Perfil de ramp**: 0→20 VUs (2 min) → 20 VUs estables (5 min) → bajar a 0 (1 min)
- **Duración total**: 8 minutos
- **Distribución de carga**:
  - 50% navegación de productos (búsqueda + paginación)
  - 25% flujo de checkout (creación de órdenes)
  - 15% navegación de usuarios
  - 10% consulta de órdenes
- **Criterio de aprobación**: p(95) < 2s, tasa de error < 5%

### 5.3 Stress Test
- **Propósito**: Encontrar el punto de quiebre
- **Perfil de ramp**: 0→20→50→100→150 VUs (progresivo, 8 min total)
- **Observaciones clave**: ¿En qué nivel de VUs se degradan los tiempos de respuesta? ¿Cuándo disparan los errores?
- **Criterio de aprobación**: Degradación gradual (sin caídas abruptas)

### 5.4 Spike Test
- **Propósito**: Simular una flash sale / Cyber Monday
- **Perfil de ramp**: 5 VUs (base) → 100 VUs en 10s → mantener 30s → recuperar
- **Observaciones clave**: Comportamiento del sistema durante la ráfaga súbita, tiempo de recuperación
- **Criterio de aprobación**: El sistema se recupera dentro de 30s después de que termine el spike

### 5.5 Soak Test
- **Propósito**: Detectar memory leaks, agotamiento de pool de conexiones, degradación gradual
- **Perfil**: 15 VUs sostenidos durante 15 minutos
- **Observaciones clave**: Tendencia de latencia en el tiempo — debería mantenerse estable
- **Criterio de aprobación**: Sin tendencia ascendente en la latencia p(95)

### 5.6 Escenarios Enfocados

| Escenario | Área de Enfoque | Pregunta Clave |
|-----------|----------------|----------------|
| Auth Flow | Ciclos de login/logout | ¿Escala la autenticación bajo logins concurrentes? |
| Product Browse | Búsqueda + paginación profunda | ¿Cómo crece el costo de paginación con el número de página? |
| Checkout Flow | Creación de órdenes | ¿Cómo impacta el CPU busy-loop en órdenes concurrentes? |
| User Management | CRUD de usuarios + paginación | ¿El dataset de 77K usuarios causa ralentizaciones en queries? |

## 6. Estrategia de Datos de Prueba

- **Términos de búsqueda**: 20 términos parametrizados (externalizados en `data/search-terms.json`)
- **Categorías**: 12 categorías de productos obtenidas de datos reales
- **SKUs**: Cargados dinámicamente en el `setup()` del test desde la API en vivo
- **Emails**: Generados aleatoriamente por iteración para evitar conflictos
- **Paginación**: Los tests cubren páginas 1-10 (normal) y 50-500+ (profunda)

## 7. Entorno y Herramientas

| Componente | Detalle |
|-----------|---------|
| Herramienta | K6 (Grafana) |
| Objetivo | `https://perfappdemo.vercel.app` |
| Autenticación | JWT (usuario/contraseña → Bearer token, ~8h de vida) |
| Formato de Reporte | HTML (k6-reporter) + JSON + Consola |
| Ejecución | Máquina local |

## 8. Métricas Recolectadas

### Métricas Estándar de K6
- `http_req_duration` — Distribución de tiempos de respuesta (min, med, avg, p90, p95, p99, max)
- `http_req_failed` — Tasa de error
- `http_reqs` — Total de requests y throughput (req/s)
- `http_req_waiting` — Tiempo de procesamiento del servidor (TTFB)
- `iteration_duration` — Duración del ciclo completo de iteración

### Métricas Personalizadas
- `checkout_duration` — Aísla la latencia de creación de orden (cuello de botella CPU)
- `checkout_success_rate` — Ratio de éxito en creación de órdenes
- `product_search_duration` — Tiempo de respuesta de queries de búsqueda
- `deep_pagination_duration` — Latencia en números de página altos
- `login_duration` — Latencia del endpoint de autenticación
- `stock_conflicts_409` — Intentos de orden con stock insuficiente
- `e2e_checkout_duration` — Tiempo completo del flujo de checkout

## 9. Riesgos y Supuestos

### Supuestos
1. La API se comporta de manera consistente para todos los candidatos autenticados
2. El CPU busy-loop del checkout es determinístico y no se ve afectado por la carga del servidor
3. El costo de paginación skip/limit de MongoDB escala linealmente con el offset
4. La vida del token (~8h) es suficiente para todas las duraciones de test
5. La infraestructura compartida significa que los resultados pueden variar según la actividad de otros candidatos

### Riesgos

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Agotamiento de stock | Los errores 409 aumentan durante el test | Usar pool de SKUs, aceptar 409 como no-falla |
| Rate limiting | Lecturas falsas de fallo | Monitorear códigos de estado 429 |
| Entorno compartido | Varianza en resultados | Ejecutar tests en horarios consistentes, múltiples iteraciones |
| Expiración de token durante soak | Fallas de auth a mitad del test | Re-autenticar en setup, monitorear edad del token |

## 10. Calendario de Ejecución

| Orden | Test | Duración | Propósito |
|-------|------|----------|-----------|
| 1 | Smoke Test | 30s | Validar el setup |
| 2 | Auth Flow | 4 min | Línea base de rendimiento de auth |
| 3 | Product Browse | 5 min | Línea base de búsqueda y paginación |
| 4 | User Management | 4 min | Línea base de API de usuarios |
| 5 | Checkout Flow | 5 min | Análisis del cuello de botella de checkout |
| 6 | Load Test | 8 min | Línea base con carga mixta |
| 7 | Stress Test | 8 min | Encontrar punto de quiebre |
| 8 | Spike Test | 2 min | Simulación de flash sale |
| 9 | Soak Test | 17 min | Verificación de estabilidad |
