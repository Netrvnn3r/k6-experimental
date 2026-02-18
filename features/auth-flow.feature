# language: es
Característica: Flujo de Autenticación
  Como equipo de QA Performance
  Quiero validar el flujo de login/logout bajo diferentes cargas
  Para asegurar que la autenticación es estable y rápida

  Esquema del escenario: Test de carga del login
    Dado el sistema está disponible
    Cuando <vus> usuarios realizan login durante "<duration>"
    Entonces el percentil 95 del login debe ser menor a <threshold_p95>ms
    Y la tasa de fallas debe ser menor a <failure_rate>%

    Ejemplos: Smoke Test
      | vus | duration | threshold_p95 | failure_rate |
      | 1   | 10s      | 2000          | 5            |

    Ejemplos: Load Test
      | vus | duration | threshold_p95 | failure_rate |
      | 20  | 2m       | 2000          | 5            |

    Ejemplos: Stress Test
      | vus | duration | threshold_p95 | failure_rate |
      | 100 | 3m       | 5000          | 15           |
