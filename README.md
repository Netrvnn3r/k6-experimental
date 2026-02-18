# Framework de Performance Testing con K6 — E-Commerce

Un framework profesional de **testing de rendimiento con K6** diseñado para evaluar la capacidad de respuesta y escalabilidad de la API de una plataforma e-commerce.

---

## 📋 Tabla de Contenidos

1. [Requisitos Previos](#-requisitos-previos)
2. [Instalación Paso a Paso](#-instalación-paso-a-paso)
3. [Arquitectura del Proyecto](#-arquitectura-del-proyecto)
4. [Cómo Ejecutar los Tests](#-cómo-ejecutar-los-tests)
5. [Curvas de Carga: Dónde y Cómo se Configuran](#-curvas-de-carga-dónde-y-cómo-se-configuran)
6. [Tipos de Test Explicados](#-tipos-de-test-explicados)
7. [Escenarios Enfocados](#-escenarios-enfocados)
8. [Métricas Personalizadas](#-métricas-personalizadas)
9. [Reportes: Cómo Verlos y Compararlos](#-reportes-cómo-verlos-y-compararlos)
10. [Umbrales de Aceptación](#-umbrales-de-aceptación)
11. [Buenas Prácticas de Performance Testing](#-buenas-prácticas-de-performance-testing)
12. [Cómo se Relaciona con los Criterios del Challenge](#-cómo-se-relaciona-con-los-criterios-del-challenge)
13. [Configuración Avanzada](#-configuración-avanzada)
14. [Plataforma Objetivo](#-plataforma-objetivo)

---

## 📋 Requisitos Previos

### 1. Instalar K6 (obligatorio)

K6 es la herramienta de testing de carga. Se instala como un ejecutable de línea de comando:

```bash
# Windows (winget) — RECOMENDADO
winget install k6 --source winget

# Windows (Chocolatey)
choco install k6

# macOS (Homebrew)
brew install k6

# Linux (apt)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

Verifica la instalación:
```bash
k6 version
# Debería mostrar algo como: k6 v1.6.1 (go1.23.6, windows/amd64)
```

### 2. Node.js (opcional)

Solo es necesario si quieres usar los scripts de NPM (`npm run test:smoke`, etc.). Si prefieres ejecutar `k6 run ...` directamente, no necesitas Node.js.

---

## ⚡ Instalación Paso a Paso

```bash
# 1. Clona o navega al proyecto
cd K6-experimental

# 2. (Opcional) Instala dependencias de npm si quieres usar npm scripts
npm install

# 3. Ejecuta el smoke test para verificar que todo funciona
k6 run -e BASE_URL=https://perfappdemo.vercel.app -e USERNAME=ghauyon -e PASSWORD=user4Test tests/smoke-test.js

# 4. Si ves "checks: 100.00%" en la consola, ¡todo está funcionando!

# 5. Abre el reporte HTML generado en tu navegador
# El archivo estará en: reports/smoke-test_YYYYMMDD-HHmmss.html
```

**¿Qué deberías ver si funciona?**
```
✓ auth: status is 200
✓ GET Products: status is 200        (12,226 items)
✓ GET Users: status is 200           (77,117 users)
✓ POST Order: status is 200          (orden creada)
✓ GET Orders: status is 200

checks: 100.00%  ✓ 12  ✗ 0
http_req_failed: 0.00%
```

---

## 🏗️ Arquitectura del Proyecto

```
K6-experimental/
│
├── .env                              ← Credenciales (BASE_URL, USERNAME, PASSWORD)
├── package.json                      ← Scripts NPM para ejecutar tests fácilmente
│
├── config/
│   └── options.js                    ← ⭐ CURVAS DE CARGA Y UMBRALES (archivo clave)
│
├── lib/                              ← Módulos reutilizables del framework
│   ├── config.js                     ← Carga variables de entorno
│   ├── auth.js                       ← Autenticación JWT (login/logout/headers)
│   ├── endpoints.js                  ← Wrappers de API (productos, usuarios, órdenes)
│   └── helpers.js                    ← Utilidades (datos random, validaciones, timestamps)
│
├── data/                             ← Datos parametrizados para los tests
│   ├── search-terms.json             ← Términos de búsqueda de productos
│   └── categories.json               ← Categorías de productos
│
├── tests/                            ← Scripts de test K6
│   ├── smoke-test.js                 ← Verificación rápida (1 VU, 1 iteración)
│   ├── load-test.js                  ← Carga normal (ramp up → steady → down)
│   ├── stress-test.js                ← Estrés progresivo (hasta 150 VUs)
│   ├── spike-test.js                 ← Pico repentino de tráfico
│   ├── soak-test.js                  ← Carga sostenida (15 min)
│   └── scenarios/                    ← Escenarios enfocados
│       ├── auth-flow.js              ← Ciclos de login/logout
│       ├── product-browse.js         ← Búsqueda y paginación profunda
│       ├── checkout-flow.js          ← Checkout E2E (cuello de botella CPU)
│       └── user-management.js        ← CRUD de usuarios y paginación pesada
│
├── reports/                          ← ⭐ REPORTES GENERADOS AQUÍ (HTML + JSON)
│   └── (se crean automáticamente con timestamp)
│
└── docs/
    ├── TEST_PLAN.md                  ← Plan de pruebas formal
    └── ANALYSIS_TEMPLATE.md          ← Template para documentar hallazgos
```

---

## 🚀 Cómo Ejecutar los Tests

### Usando Scripts de NPM (más fácil)

```bash
# Tests principales
npm run test:smoke          # Verificación rápida (~30 seg)
npm run test:load           # Carga estándar (~8 min)
npm run test:stress         # Estrés hasta el límite (~8 min)
npm run test:spike          # Simulación de flash sale (~2 min)
npm run test:soak           # Carga sostenida (~17 min)

# Escenarios enfocados
npm run test:auth           # Flujo de autenticación
npm run test:products       # Navegación de productos
npm run test:checkout       # Flujo de checkout (cuello de botella CPU)
npm run test:users          # Gestión de usuarios

# Todos los escenarios secuencialmente
npm run test:all-scenarios
```

### Usando K6 Directamente

```bash
# Ejecución básica
k6 run -e BASE_URL=https://perfappdemo.vercel.app -e USERNAME=ghauyon -e PASSWORD=user4Test tests/smoke-test.js

# Con salida JSON adicional para análisis externo
k6 run --out json=reports/results.json -e BASE_URL=https://perfappdemo.vercel.app -e USERNAME=ghauyon -e PASSWORD=user4Test tests/load-test.js

# Con salida CSV
k6 run --out csv=reports/results.csv -e BASE_URL=https://perfappdemo.vercel.app -e USERNAME=ghauyon -e PASSWORD=user4Test tests/load-test.js
```

> **Nota:** K6 no lee archivos `.env` nativamente. Las variables de entorno se pasan con `-e VARIABLE=valor` o se configuran en los scripts NPM de `package.json`.

---

## 📐 Curvas de Carga: Dónde y Cómo se Configuran

### ¿Dónde está la configuración?

**Archivo principal:** `config/options.js`

Este es el **panel de control** de todo el framework. Aquí se definen las curvas de carga (cuántos usuarios virtuales y por cuánto tiempo) y los umbrales de aceptación.

### ¿Cómo funciona el array `stages`?

Cada perfil de test define su curva de VU (Usuarios Virtuales) a través de un array de **stages** (etapas). Cada etapa tiene dos propiedades:

```javascript
{ duration: '2m', target: 20 }
//            ↑            ↑
//    cuánto dura       cuántos VUs tener
//    esta fase         AL FINAL de esta fase
```

K6 hace un **ramp lineal** desde la cantidad actual de VUs hasta el `target` durante la `duration`. Así se dibuja la forma de la curva.

### Curvas Visuales de Cada Tipo de Test

#### LOAD TEST — Forma trapezoidal clásica

```
VUs
 20 │         ┌──────────────────────┐
    │        /                        \
    │       /                          \
  0 │──────/                            \──
    └──────┤────────────┤───────────────┤──→ tiempo
          0min        2min             7min  8min
           ramp up     estado estable    ramp down
```

```javascript
// Archivo: config/options.js — LOAD_OPTIONS
stages: [
    { duration: '2m',  target: 20 },  // Subir a 20 VUs
    { duration: '5m',  target: 20 },  // Mantener 20 VUs (medición real)
    { duration: '1m',  target: 0  },  // Bajar a 0
],
```

> **Importante:** La fase de "estado estable" es donde se obtienen las métricas reales. El ramp up y ramp down generan datos sesgados porque la cantidad de VUs está cambiando.

#### STRESS TEST — Escalera progresiva

```
VUs
150 │                              ┌────────┐
    │                    ┌─────────┘        │
100 │                    │                  │
    │          ┌─────────┘                  │
 50 │          │                            │
    │   ┌──────┘                            │
 20 │   │                                    \
    │  /                                      \
  0 │─/                                        \──
    └──┤──────┤──────────┤──────────┤──────────┤──→ tiempo
      0     1min       3min       5min       7min  8min
```

```javascript
// Archivo: config/options.js — STRESS_OPTIONS
stages: [
    { duration: '1m',  target: 20  },  // Calentamiento
    { duration: '2m',  target: 50  },  // Carga moderada
    { duration: '2m',  target: 100 },  // Carga pesada
    { duration: '2m',  target: 150 },  // Punto de quiebre
    { duration: '1m',  target: 0   },  // Recuperación
],
```

> **Objetivo:** Encontrar **dónde se rompe** — ¿en qué nivel de VUs explotan los tiempos de respuesta o los errores?

#### SPIKE TEST — Pico abrupto

```
VUs
100 │           ┌──────────────────┐
    │          /│                  │\
    │         / │                  │ \
  5 │────────/  │                  │  \────────
  0 │        │  │                  │  │
    └────────┤──┤──────────────────┤──┤────────→ tiempo
            30s 40s              70s 80s    110s
         baseline  ¡SPIKE!  mantener  recuperar  observar
```

```javascript
// Archivo: config/options.js — SPIKE_OPTIONS
stages: [
    { duration: '30s', target: 5   },  // Línea base
    { duration: '10s', target: 100 },  // ¡Spike! x20 tráfico
    { duration: '30s', target: 100 },  // Mantener el pico
    { duration: '10s', target: 5   },  // Volver a la normalidad
    { duration: '30s', target: 5   },  // Observar recuperación
],
```

> **Pregunta clave:** ¿Puede el sistema sobrevivir un aumento repentino de 20x en tráfico? ¿Cuánto tarda en recuperarse?

#### SOAK TEST — Línea plana sostenida

```
VUs
 15 │    ┌────────────────────────────────────┐
    │   /                                      \
  0 │──/                                        \──
    └──┤──────────────────────────────────────┤──→ tiempo
      0                 15min                17min
```

```javascript
// Archivo: config/options.js — SOAK_OPTIONS
stages: [
    { duration: '1m',   target: 15 },  // Subir
    { duration: '15m',  target: 15 },  // Carga sostenida
    { duration: '1m',   target: 0  },  // Bajar
],
```

> **Objetivo:** Detectar **degradación gradual** — memory leaks, agotamiento de pools de conexiones, o latencia que crece con el tiempo.

### ¿Cómo modificar las curvas?

1. Abrir `config/options.js`
2. Encontrar el perfil que quieres modificar (ej: `LOAD_OPTIONS`)
3. Cambiar los valores de `duration` y `target` en el array `stages`
4. Guardar y ejecutar el test

**Ejemplo — Duplicar la carga del Load Test:**
```javascript
// Antes
{ duration: '5m', target: 20 },

// Después (el doble de VUs)
{ duration: '5m', target: 40 },
```

---

## 📊 Tipos de Test Explicados

### Orden Recomendado de Ejecución

**Nunca saltes directamente al stress test.** La progresión importa:

| Orden | Test | Comando | Duración | Por qué |
|-------|------|---------|----------|---------|
| 1° | **Smoke** | `npm run test:smoke` | ~30s | Verifica que los endpoints funcionan |
| 2° | **Escenarios** | `npm run test:auth`, etc. | 4-5 min c/u | Aísla cada área de la API individualmente |
| 3° | **Load** | `npm run test:load` | 8 min | Establece línea base bajo condiciones normales |
| 4° | **Stress** | `npm run test:stress` | 8 min | Encuentra dónde se rompe vs. esa línea base |
| 5° | **Spike** | `npm run test:spike` | 2 min | Prueba resiliencia ante ráfagas repentinas |
| 6° | **Soak** | `npm run test:soak` | 17 min | Detecta problemas invisibles en tests cortos |

### Detalle de Cada Test

| Test | VUs | Forma de Curva | ¿Qué mide? |
|------|-----|----------------|------------|
| **Smoke** | 1 | Plano | ¿Funcionan todos los endpoints? |
| **Load** | 0→20 (estable) | Trapecio | Rendimiento bajo tráfico normal |
| **Stress** | 0→20→50→100→150 | Escalera | ¿Dónde está el punto de quiebre? |
| **Spike** | 5→100 (repentino) | Pico | ¿Sobrevive un aumento de 20x? |
| **Soak** | 15 sostenido | Línea plana | ¿Se degrada con el tiempo? |

---

## 🎯 Escenarios Enfocados

Estos scripts prueban áreas específicas de la API en profundidad. La idea es aislar el comportamiento de cada componente antes de mezclarlos en el Load Test.

| Escenario | Archivo | Qué prueba | Métricas clave |
|-----------|---------|------------|----------------|
| **Auth Flow** | `tests/scenarios/auth-flow.js` | Ciclos de login/logout | `login_duration`, `auth_failure_rate` |
| **Product Browse** | `tests/scenarios/product-browse.js` | Búsqueda + paginación profunda | `product_search_duration`, `deep_pagination_duration` |
| **Checkout Flow** | `tests/scenarios/checkout-flow.js` | Creación de órdenes (CPU bottleneck) | `checkout_duration`, `checkout_success_rate`, `stock_conflicts_409` |
| **User Management** | `tests/scenarios/user-management.js` | CRUD de usuarios + paginación pesada (77K) | `user_list_duration`, `deep_user_pagination` |

### Carga de Trabajo del Load Test

El **Load Test** simula tráfico realista distribuyendo los VUs en diferentes flujos:

```
50% → Navegación de productos (búsqueda + paginación)
25% → Checkout (creación de órdenes)
15% → Navegación de usuarios
10% → Consulta de órdenes
```

Esta distribución se puede modificar en `tests/load-test.js` en la función `default()`:
```javascript
if (journey < 0.50) browseProducts(token);       // 50%
else if (journey < 0.75) checkoutFlow(token, skus); // 25%
else if (journey < 0.90) browseUsers(token);      // 15%
else viewOrders(token);                            // 10%
```

---

## 📈 Métricas Personalizadas

El framework mide métricas más allá de las que K6 entrega por defecto. Estas métricas son la **evidencia** que necesitas para identificar y justificar cuellos de botella.

| Métrica | Tipo | Descripción | Dónde se define |
|---------|------|-------------|-----------------|
| `checkout_duration` | Trend | Latencia de creación de orden (endpoint con CPU loop) | Varios scripts |
| `checkout_success_rate` | Rate | Ratio de órdenes creadas exitosamente | `checkout-flow.js` |
| `product_search_duration` | Trend | Tiempo de respuesta de búsqueda | `load-test.js`, `product-browse.js` |
| `deep_pagination_duration` | Trend | Latencia en páginas altas (MongoDB skip/limit) | `product-browse.js`, `stress-test.js` |
| `login_duration` | Trend | Latencia del endpoint de autenticación | `auth-flow.js` |
| `stock_conflicts_409` | Counter | Respuestas 409 por stock insuficiente | Varios scripts |
| `e2e_checkout_duration` | Trend | Flujo completo: buscar→seleccionar→comprar→verificar | `checkout-flow.js` |

---

## 📄 Reportes: Cómo Verlos y Compararlos

### Generación de Reportes

Cada ejecución de test genera automáticamente:

| Archivo | Descripción |
|---------|-------------|
| `reports/<test>_YYYYMMDD-HHmmss.html` | Reporte visual HTML interactivo |
| `reports/<test>_YYYYMMDD-HHmmss.json` | Datos crudos en JSON |
| Terminal (stdout) | Resumen con colores en la consola |

### ⭐ Los Reportes NUNCA se Sobreescriben

Cada reporte incluye un **timestamp** en su nombre de archivo. Esto significa que cada ejecución crea un archivo nuevo, sin borrar los anteriores:

```
reports/
├── smoke-test_20260218-224500.html     ← Primera ejecución
├── smoke-test_20260218-231200.html     ← Segunda ejecución
├── load-test_20260219-100000.html      ← Load test del día siguiente
├── load-test_20260219-100000.json      ← JSON correspondiente
├── load-test_20260219-143000.html      ← Otra corrida del load test
├── load-test_20260219-143000.json      ← JSON correspondiente
├── stress-test_20260219-150000.html    ← Stress test
└── ...
```

**¿Por qué es importante?** Como QA, necesitas poder **comparar métricas entre ejecuciones**:
- ¿Mejoró la latencia después de un cambio?
- ¿Empeoró la tasa de errores con más VUs?
- ¿El p(95) del checkout se mantiene estable a lo largo del día?

Solo abre los dos archivos HTML en pestañas diferentes de tu navegador y compara los números lado a lado.

### Cómo Ver un Reporte

1. Después de ejecutar un test, busca lo último que K6 imprime en la consola. Dirá algo como:
   ```
   [k6-reporter v3.0.3] Generating HTML summary report, with theme: default
   ```

2. Ve a la carpeta `reports/` y busca el archivo más reciente:
   ```bash
   # Windows PowerShell
   ls reports/ | Sort-Object LastWriteTime -Descending | Select-Object -First 5

   # O simplemente ordena por fecha en el explorador de archivos
   ```

3. Abre el archivo `.html` en tu navegador (doble clic o arrastrar al navegador).

4. El reporte HTML muestra:
   - **Checks** — Cuántas validaciones pasaron/fallaron
   - **HTTP Metrics** — Latencia (min, med, avg, p90, p95, p99, max)
   - **Throughput** — Requests por segundo
   - **Error Rate** — Porcentaje de fallos
   - **Custom Metrics** — Todas las métricas personalizadas definidas en el script

### Cómo Funciona Internamente (para personalizarlo)

La lógica de reportes vive en la función `handleSummary()` de cada script de test. Por ejemplo:

```javascript
// En cualquier archivo de tests/
export function handleSummary(data) {
    const ts = getTimestamp();  // Genera: "20260218-224500"
    return {
        [`reports/load-test_${ts}.html`]: htmlReport(data),  // Reporte HTML
        [`reports/load-test_${ts}.json`]: JSON.stringify(data, null, 2),  // Datos JSON
        stdout: textSummary(data, { indent: ' ', enableColors: true }),   // Consola
    };
}
```

La función `getTimestamp()` está definida en `lib/helpers.js` y genera el formato `YYYYMMDD-HHmmss`.

---

## 🎯 Umbrales de Aceptación

Los umbrales definen cuándo un test **pasa** (✓) o **falla** (✗). Se configuran en `config/options.js`:

### Umbrales Globales (compartidos)

```javascript
// Archivo: config/options.js — BASE_THRESHOLDS
'http_req_duration':  ['p(95)<2000', 'p(99)<5000'],  // 95% de requests < 2s
'http_req_failed':    ['rate<0.05'],                  // Menos de 5% de errores
'http_reqs':          ['rate>5'],                     // Al menos 5 req/s
```

### Umbrales Por Endpoint

```javascript
// Archivo: config/options.js — BASE_THRESHOLDS
'http_req_duration{name:AUTH_Login}':    ['p(95)<1000'],   // Auth < 1s
'http_req_duration{name:PRODUCTS_List}': ['p(95)<1500'],   // Productos < 1.5s
'http_req_duration{name:ORDERS_Create}': ['p(95)<3000'],   // Checkout < 3s (CPU loop)
'http_req_duration{name:USERS_List}':    ['p(95)<1500'],   // Usuarios < 1.5s
```

> **Nota:** El endpoint de checkout tiene un umbral más alto (3s) porque tiene un **CPU busy-loop conocido** que incrementa su latencia.

### Umbrales Relajados para Stress/Spike

Bajo condiciones extremas, los umbrales son más permisivos:
- **Stress:** `p(95)<5000`, `rate<0.15` (15% errores permitidos)
- **Spike:** `p(95)<5000`, `rate<0.20` (20% errores permitidos)

Esto se puede ajustar en `config/options.js` dentro de cada perfil (`STRESS_OPTIONS`, `SPIKE_OPTIONS`).

---

## ✅ Buenas Prácticas de Performance Testing

### 1. La Fase de "Estado Estable" es donde están los datos reales

```javascript
{ duration: '2m', target: 20 },  // ← Ramp up (IGNORAR estos datos)
{ duration: '5m', target: 20 },  // ← Estado estable (ACÁ están las métricas)
{ duration: '1m', target: 0  },  // ← Ramp down (IGNORAR estos datos)
```

El ramp up y ramp down producen métricas sesgadas porque la cantidad de VUs está cambiando. Las **métricas reales** vienen de la meseta estable.

### 2. Distribución de Carga Realista > Máximos VUs

Tener 100 VUs todos atacando el checkout no es realista. Los usuarios reales navegan más de lo que compran. Nuestro Load Test refleja esto con la distribución 50/25/15/10.

### 3. Think Time entre Requests

Los usuarios reales **no disparan requests en un loop cerrado**. La función `randomThinkTime(1, 3)` en `lib/helpers.js` agrega pausas de 1-3 segundos entre acciones. Sin esto, estás midiendo "cuánto resiste un DDoS" en vez de "cómo rinde bajo carga realista".

### 4. Métricas Personalizadas son tu Arma Secreta

Las métricas genéricas de K6 no aíslan el cuello de botella del checkout. Nuestra métrica `checkout_duration` mide **solo** la latencia del POST /api/orders, permitiendo decir:

> *"Con 20 usuarios concurrentes, la latencia del checkout es 600ms (p95). Con 100 usuarios, se degrada a 3,200ms (p95). Esto es consistente con una operación CPU-bound síncrona que no paraleliza bien bajo concurrencia."*

Ese es el tipo de evidencia que el challenge pide.

### 5. Preservar los Reportes

El challenge dice: *"Preserve raw or exported results artifacts."* Cada test genera reportes con timestamp que **nunca se sobreescriben**. Estos son tu evidencia para el reporte final.

---

## 📑 Cómo se Relaciona con los Criterios del Challenge

Basado en el documento del challenge (`ecommerceChallenge.txt`):

| Tarea del Challenge | Cómo el Framework la Satisface | Dónde Mirar |
|--------------------|---------------------------------|-------------|
| **Diseño del Plan de Test** — objetivos, umbrales, ramp profiles | Umbrales en `BASE_THRESHOLDS`, curvas en `stages`, distribución de carga en `load-test.js` | `config/options.js`, `docs/TEST_PLAN.md` |
| **Implementación de Scripts** — parametrizar datos, externalizar config | Datos en `data/*.json`, SKUs dinámicos en `setup()`, config en `config/options.js` | `data/`, `config/`, `lib/config.js` |
| **Ejecución y Métricas** — latencia, throughput, error rates | K6 captura automáticamente + métricas custom como `checkout_duration` | Reportes HTML en `reports/` |
| **Análisis y Cuellos de Botella** — CPU checkout, I/O, patrones de datos | `checkout-flow.js` aísla el CPU loop. `product-browse.js` mide paginación profunda vs superficial | `tests/scenarios/`, `docs/ANALYSIS_TEMPLATE.md` |
| **Propuestas de Mejora** — recomendaciones con impacto y trade-offs | Template estructurado con columnas de Impacto + Trade-offs | `docs/ANALYSIS_TEMPLATE.md` |
| **Ensamblado del Reporte** — metodología, métricas, hallazgos | Reportes HTML + JSON preservados, template de análisis | `reports/`, `docs/` |

---

## 🔧 Configuración Avanzada

### Variables de Entorno

| Variable | Valor por Defecto | Descripción | Dónde Cambiar |
|----------|-------------------|-------------|---------------|
| `BASE_URL` | `https://perfappdemo.vercel.app` | URL base de la API | `.env` o flag `-e` |
| `USERNAME` | `ghauyon` | Usuario de autenticación | `.env` o flag `-e` |
| `PASSWORD` | `user4Test` | Contraseña | `.env` o flag `-e` |

### Datos de Test

| Archivo | Contenido | Para Qué |
|---------|-----------|----------|
| `data/search-terms.json` | 20 términos de búsqueda | Parametrizar búsquedas de productos |
| `data/categories.json` | 12 categorías de productos | Filtros de categoría |

### Archivos Clave para Personalizar

| Qué quieres cambiar | Archivo | Qué modificar |
|---------------------|---------|---------------|
| Curvas de carga (VUs, duración) | `config/options.js` | Arrays `stages` en cada perfil |
| Umbrales de aceptación | `config/options.js` | Objetos `thresholds` |
| Distribución de carga | `tests/load-test.js` | Probabilidades en `default()` |
| Credenciales | `.env` o `package.json` | Variables de entorno |
| Términos de búsqueda | `data/search-terms.json` | Agregar/quitar términos |
| Think time entre requests | `lib/helpers.js` | Función `randomThinkTime()` |

---

## 🧪 Plataforma Objetivo

| Atributo | Detalle |
|----------|---------|
| Stack | Next.js 15 + TypeScript + MongoDB |
| Productos | ~12,000 (globales, compartidos) |
| Usuarios | ~77,000 (globales, compartidos) |
| Órdenes | Aisladas por candidato (candidate-scoped) |
| Cuello de Botella Conocido | CPU busy-loop en checkout |
| Paginación | Skip/limit; páginas altas agregan costo |
| Autenticación | JWT, ~8h de vida del token |
| Stock | Se decrementa atómicamente; stock insuficiente → HTTP 409 |
