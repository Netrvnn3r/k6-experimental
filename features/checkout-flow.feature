# language: es
Característica: Flujo de Checkout
  Como equipo de QA Performance
  Quiero validar el flujo completo de checkout bajo diferentes cargas
  Para identificar cuellos de botella en la ruta crítica (CPU busy-loop conocido)

  Esquema del escenario: Test de carga del checkout E2E
    Dado existe un pool de SKUs con stock
    Cuando el usuario realiza checkout con <quantity> productos
    Entonces el percentil 95 del checkout debe ser menor a <threshold_p95>ms
    Y la tasa de éxito del checkout debe ser mayor a <success_rate>%
    Y la tasa de fallas debe ser menor a <failure_rate>%

    Ejemplos: Smoke Test
      | vus | duration | quantity | threshold_p95 | success_rate | failure_rate |
      |   1 |      10s |        1 |          5000 |           50 |           20 |

    Ejemplos: Load Test
      | vus | duration | quantity | threshold_p95 | success_rate | failure_rate |
      |  10 |       2m |        1 |          5000 |           60 |           15 |

    Ejemplos: Stress Test
      | vus | duration | quantity | threshold_p95 | success_rate | failure_rate |
      |  30 |       3m |        2 |          8000 |           50 |           25 |
