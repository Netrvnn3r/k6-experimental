# K6 E-commerce Performance Framework (BDD Edition)

Este framework de pruebas de rendimiento está diseñado para la plataforma de E-commerce, utilizando **K6** potenciado con **Cucumber/Gherkin** para una definición de pruebas orientada al comportamiento (BDD).

## 🚀 Características Revolucionarias

- **Enfoque BDD Completo**: Define tus pruebas en lenguaje natural (Gherkin) usando archivos `.feature`.
- **Step Groups**: Cada paso Gherkin se convierte en un `group` de K6 para reportes detallados y consistentes.
- **Scenario Outlines**: Ejecuta el mismo escenario con diferentes perfiles de carga (Smoke, Load, Stress) usando tablas de `Examples`.
- **Generación Automática**: Un motor personalizado en Node.js convierte tus archivos Gherkin en scripts de rendimiento K6 optimizados.
- **Métricas Personalizadas**: Tiempos de respuesta, tasas de error y contadores de negocio (ej. `orders_created`) configurados automáticamente.
- **Reportes HTML**: Generación automática de reportes visuales detallados.

## 📂 Estructura del Proyecto

```
.
├── bdd/                  # Motor BDD (Parseador y Generador)
│   ├── parser.js         # Parsea archivos .feature
│   ├── generator.js      # Genera scripts .js de k6
│   ├── runner.js         # CLI para orquestar la ejecución
│   └── steps/            # Definiciones de pasos (Step Definitions)
├── features/             # Archivos Gherkin (.feature)
│   ├── auth-flow.feature
│   ├── product-browse.feature
│   ├── checkout-flow.feature
│   └── smoke-test.feature
├── tests/
│   └── generated/        # Scripts k6 generados automáticamente (NO EDITAR)
├── lib/                  # Librerías core de K6 (Auth, API, Helpers)
└── reports/              # Reportes HTML y JSON de las ejecuciones
```

## 🛠️ Instalación

1. Clona el repositorio.
2. Instala las dependencias (necesarias para el motor BDD):
   ```bash
   npm install
   ```
   *Nota: K6 debe estar instalado en tu sistema o disponible en el PATH.*

## 🏃 Como Ejecutar las Pruebas BDD

El framework incluye comandos npm para ejecutar los diferentes flujos de prueba definidos en los archivos `.feature`.

### Comandos Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run bdd:smoke` | Ejecuta el **Smoke Test** (validación rápida de end-to-end). |
| `npm run bdd:auth` | Ejecuta pruebas de carga sobre el **Flujo de Autenticación**. |
| `npm run bdd:products` | Ejecuta pruebas de carga sobre **Navegación y Búsqueda**. |
| `npm run bdd:checkout` | Ejecuta pruebas de carga sobre el **Checkout** (Ruta Crítica). |
| `npm run bdd:run` | Ejecuta **TODOS** los archivos `.feature` secuencialmente. |

### Herramientas de Depuración

| Comando | Descripción |
|---------|-------------|
| `npm run bdd:generate` | Solo **genera** los scripts k6 en `tests/generated/` sin ejecutarlos. |
| `npm run bdd:parse` | Solo **parsea** los archivos `.feature` y muestra la estructura JSON. |
| `npm run bdd:steps` | Lista todos los pasos Gherkin disponibles. |

## 📝 Escribiendo Nuevas Pruebas (Gherkin)

Crea un archivo `.feature` en la carpeta `features/`. Utiliza **Scenario Outlines** para definir diferentes perfiles de carga.

**Ejemplo de Feature:**

```gherkin
# language: es
Característica: Buscador de Productos

  Esquema del escenario: Búsqueda bajo carga
    Dado el usuario está autenticado
    Cuando el usuario busca "<termino>"
    Entonces el percentil 95 de búsqueda debe ser menor a <umbral>ms

    Ejemplos: Load Test
      | vus | duration | termino | umbral |
      | 20  | 5m       | Laptop  | 2000   |

    Ejemplos: Stress Test
      | vus | duration | termino | umbral |
      | 100 | 5m       | Laptop  | 5000   |
```

### Parámetros Soportados en Examples

El motor BDD reconoce automáticamente estos parámetros en la tabla de `Examples` para configurar la ejecución de K6:

- **vus**: Usuarios virtuales simultáneos (target).
- **duration**: Duración de la prueba (ej. `30s`, `5m`, `1h`).
- **iterations**: Número de iteraciones (alternativa a `duration` para smoke tests).

El motor generará automáticamente etapas de **Ramp-up** (calentamiento) y **Ramp-down** (enfriamiento) basadas en la duración total.

## 🧩 Step Definitions Disponibles

Puedes usar los siguientes pasos en tus archivos `.feature`:

**GIVEN (Precondiciones)**
- `el sistema está disponible`
- `el usuario está autenticado`
- `existe un pool de SKUs con stock`

**WHEN (Acciones)**
- `<n> usuarios realizan login durante "<tiempo>"`
- `el usuario navega productos en la página <n> con <n> resultados`
- `el usuario busca "<termino>"`
- `el usuario filtra por categoría "<categoria>"`
- `el usuario lista los usuarios del sistema`
- `el usuario realiza checkout con <n> productos`
- `el usuario realiza logout`

**THEN (Asserts / Umbrales)**
- `el percentil 95 del login debe ser menor a <n>ms`
- `la tasa de fallas debe ser menor a <n>%`
- `el percentil 95 de productos debe ser menor a <n>ms`
- `el percentil 95 del checkout debe ser menor a <n>ms`
- `la tasa de éxito del checkout debe ser mayor a <n>%`
- `todos los endpoints deben responder correctamente`

## 📊 Reportes y Análisis

Cada ejecución de una prueba BDD genera automáticamente reportes detallados para facilitar el análisis.

### 📄 Archivos Generados
Los reportes se guardan en la carpeta `reports/` con la siguiente estructura de nombres:
- **HTML Gráfico**: `bdd-<nombre-escenario>-<timestamp>.html`
- **JSON Data**: `bdd-<nombre-escenario>-<timestamp>.json`

### 🔍 Interpretación de Resultados
Gracias a la integración con **Step Groups**, el reporte HTML y la salida en consola reflejan la estructura exacta de tu archivo Gherkin:

1. **Grupos por Paso**: Verás cada paso (`Dado`, `Cuando`, `Entonces`) como un grupo colapsable.
2. **Métricas Aisladas**: Puedes ver el tiempo de respuesta y errores específicos de cada paso individual.
3. **Traza de Errores**: Si un paso falla, sabrás exactamente cuál fue (ej: fallo en "Cuando el usuario realiza login").

### 🖥️ Salida en Consola
Al finalizar la prueba, verás un resumen en la terminal (stdout) que incluye:
- Checks (validaciones) exitosos y fallidos.
- Estadísticas de tiempos de respuesta (avg, p95, max).
- Estado de los umbrales (Thresholds).

