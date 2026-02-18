# language: es
Característica: Smoke Test General
  Como equipo de QA Performance
  Quiero validar rápidamente que todos los endpoints responden correctamente
  Para confirmar que el sistema funciona antes de ejecutar tests de carga pesados

  Esquema del escenario: Validación rápida de todos los endpoints
    Dado el usuario está autenticado
    Cuando el usuario navega productos en la página 1 con 10 resultados
    Y el usuario busca "<searchTerm>"
    Y el usuario lista los usuarios del sistema
    Y el usuario lista las órdenes
    Entonces todos los endpoints deben responder correctamente
    Y el tiempo de respuesta general debe ser menor a <threshold_general>ms

    Ejemplos: Smoke rápido
      | vus | duration | searchTerm | threshold_general |
      |   1 |      10s | Phone      |              3000 |
