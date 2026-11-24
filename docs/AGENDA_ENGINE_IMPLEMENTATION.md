# Motor de Agenda Judicial

Este documento describe la implementación del motor de plazos y agenda judicial.

## Componentes

### 1. Modelo de Datos (`EventoAgenda`)

- Almacena eventos asociados a expedientes.
- Atributos clave: `fechaVencimiento`, `tipoPlazo` (ORDINARIO, FATAL), `estado`, `isCritical`.

### 2. DeadlineCalculatorService

Calculadora de vencimientos que considera:
- **Días Hábiles vs Corridos**: Configurable por parámetro.
- **Fines de Semana**: Excluye sábados y domingos automáticamente si es plazo hábil.
- **Feriados Judiciales**: Consulta la tabla `CalendarioJudicial` para excluir fechas específicas (feriados, ferias, asuetos) según `jurisdiccion`.

#### Interfaz
```typescript
calculateDeadline(startDate, days, jurisdiccion, type) -> { deadline: Date, holidays: [] }
```

### 3. Simulador de Vencimientos

Endpoint `POST /agenda/simular-vencimiento` permite previsualizar cuándo caería un vencimiento dado una fecha de inicio (ej. cédula recibida) y unos días de plazo, útil para verificar cálculos antes de guardar.

### 4. Scheduler (Cron)

Tarea programada (`@Cron`) que corre diariamente (9 AM):
- Busca eventos `PENDIENTE` que vencen en los próximos 3 días.
- (Futuro) Genera alertas/notificaciones (Email, Push).
- Actualmente registra warnings en el log del sistema.

## Flujo de Uso

1. Usuario recibe cédula.
2. Sube cédula -> Sistema extrae fecha notificación (IA).
3. Sistema (o Usuario) invoca "Simular Vencimiento" con fecha de notificación + días del plazo legal.
4. Backend retorna la fecha fatal exacta considerando feriados.
5. Usuario confirma y se crea `EventoAgenda`.
6. Cron monitorea y avisa proximidad.
