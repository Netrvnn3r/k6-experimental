# Reporte de Análisis de Rendimiento — Template

> Usa este template después de la ejecución de los tests para documentar hallazgos.

## 1. Resumen de la Ejecución

| Parámetro | Valor |
|-----------|-------|
| Fecha | AAAA-MM-DD |
| Tipo de Test | (Smoke / Load / Stress / Spike / Soak) |
| Duración | |
| VUs Máximos | |
| Total de Requests | |
| Tasa de Error Global | |

## 2. Métricas Clave

### Distribución de Tiempos de Respuesta

| Endpoint | min | med | avg | p(90) | p(95) | p(99) | max | ¿Aprueba? |
|----------|-----|-----|-----|-------|-------|-------|-----|-----------|
| AUTH Login | | | | | | | | |
| Products List | | | | | | | | |
| Products Search | | | | | | | | |
| Orders Create | | | | | | | | |
| Orders List | | | | | | | | |
| Users List | | | | | | | | |

### Throughput

| Métrica | Valor |
|---------|-------|
| Total de Requests | |
| Requests/seg (promedio) | |
| Requests/seg (pico) | |

### Análisis de Errores

| Tipo de Error | Cantidad | Tasa | Código HTTP |
|--------------|----------|------|------------|
| | | | |

## 3. Análisis de Cuellos de Botella

### Cuellos de Botella Identificados

#### Cuello de Botella 1: [Nombre]
- **Evidencia**: (números, tendencias, comparación)
- **Causa Probable**: (CPU, I/O, patrón de acceso a datos)
- **Impacto**: (qué flujos de usuario se ven afectados, severidad)

#### Cuello de Botella 2: [Nombre]
- **Evidencia**:
- **Causa Probable**:
- **Impacto**:

### Análisis de Costo de Paginación

| Número de Página | Tiempo de Respuesta Promedio | vs Página 1 |
|------------------|------------------------------|-------------|
| 1 | | baseline |
| 10 | | |
| 50 | | |
| 100 | | |
| 500 | | |

## 4. Propuestas de Mejora

| # | Recomendación | Impacto Esperado | Trade-offs | Prioridad |
|---|--------------|------------------|------------|-----------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

### Recomendaciones Detalladas

#### R1: [Título]
- **Problema**:
- **Solución Propuesta**:
- **Impacto Esperado**:
- **Trade-offs**:
- **Esfuerzo de Implementación**: (Bajo / Medio / Alto)

#### R2: [Título]
- **Problema**:
- **Solución Propuesta**:
- **Impacto Esperado**:
- **Trade-offs**:
- **Esfuerzo de Implementación**: (Bajo / Medio / Alto)

## 5. Comparación entre Ejecuciones

> Usa esta sección para comparar resultados entre distintas corridas del mismo test.
> Los reportes con timestamp en `reports/` permiten abrir dos HTMLs lado a lado.

| Métrica | Ejecución 1 (fecha) | Ejecución 2 (fecha) | Δ Cambio |
|---------|---------------------|---------------------|----------|
| p(95) checkout | | | |
| p(95) productos | | | |
| Tasa de error | | | |
| Throughput (req/s) | | | |

## 6. Conclusiones

(Resumen de hallazgos, riesgos clave y próximos pasos recomendados)
