# language: es
Característica: Navegación y Búsqueda de Productos
  Como equipo de QA Performance
  Quiero validar la navegación, búsqueda y filtrado de productos bajo carga
  Para asegurar que el catálogo responde rápidamente

  Esquema del escenario: Test de carga de navegación de productos
    Dado el usuario está autenticado
    Cuando el usuario navega productos en la página <page> con <pageSize> resultados
    Y el usuario busca "<searchTerm>"
    Y el usuario filtra por categoría "<category>"
    Entonces el percentil 95 de productos debe ser menor a <threshold_p95>ms
    Y el percentil 95 de búsqueda debe ser menor a <threshold_search>ms
    Y la tasa de fallas debe ser menor a <failure_rate>%

    Ejemplos: Smoke Test
      | vus | duration | page | pageSize | searchTerm | category    | threshold_p95 | threshold_search | failure_rate |
      |   1 |      10s |    1 |       10 | Phone      | Electronics |          3000 |             3000 |           10 |

    Ejemplos: Load Test
      | vus | duration | page | pageSize | searchTerm | category  | threshold_p95 | threshold_search | failure_rate |
      |  15 |       2m |    1 |       20 | Laptop     | Computers |          2000 |             2000 |            5 |

    Ejemplos: Stress Test
      | vus | duration | page | pageSize | searchTerm | category | threshold_p95 | threshold_search | failure_rate |
      |  50 |       3m |    1 |       50 | Premium    | Garden   |          5000 |             5000 |           15 |
