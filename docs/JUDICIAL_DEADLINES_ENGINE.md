# Motor de Agenda Judicial y Plazos (Core Business)

El módulo más crítico del sistema. Un error aquí significa pérdida de derechos para el abogado (mala praxis).

## 1. Arquitectura del Motor de Plazos

### Entidades
*   **DeadlineRule**: Regla abstracta (ej. "Contestación Demanda Ordinario").
*   **CourtHoliday**: Feriados y asuetos.
*   **CaseDeadline**: Instancia concreta de un plazo en un expediente.

### Algoritmo de Cálculo (Ejemplo Simplificado)
```typescript
function calcularVencimiento(fechaNotificacion: Date, regla: DeadlineRule, feriados: Date[]): Date {
  let diasRestantes = regla.dias;
  let cursorFecha = fechaNotificacion;
  
  // Regla general: El plazo corre desde el día siguiente hábil a la nota
  cursorFecha = nextBusinessDay(cursorFecha);

  while (diasRestantes > 0) {
    cursorFecha = addDays(cursorFecha, 1);
    if (isBusinessDay(cursorFecha, feriados)) {
      if (regla.tipo_dias === 'HABILES') {
        diasRestantes--;
      } else {
        // CORRIDOS (salvo que caiga en inhábil el vto)
        diasRestantes--; 
      }
    }
  }
  
  // Si cae en inhábil y son días corridos, se pasa al siguiente hábil
  if (regla.tipo_dias === 'CORRIDOS') {
     cursorFecha = nextBusinessDay(cursorFecha);
  }

  // Cargo de hora (Dos primeras horas del día siguiente)
  if (regla.admite_cargo_hora) {
     return setTime(nextBusinessDay(cursorFecha), "09:30"); // Configurable
  }
  
  return setTime(cursorFecha, "23:59");
}
```

## 2. Sistema de Alertas Escalonadas

El sistema no solo guarda la fecha, sino que activa un workflow de notificaciones agresivo.

| T-Time | Acción | Canal | Destinatario |
| :--- | :--- | :--- | :--- |
| **T-7 días** | Aviso Informativo | Email | Abogado Jr, Resp. Expediente |
| **T-3 días** | Aviso Precaución | Email + Push App | Abogado Sr, Socio |
| **T-24 hs** | ALERTA CRÍTICA | Email + WhatsApp + SMS | Socio, Admin, Abogado |
| ** T-0 (Día Vto)** | **MODO PÁNICO** | Llamada Auto / Alerta Roja en Dashboard | TODOS |
| **Expira 09:30** | VENCIDO | Email Reporte | Auditoría |

### Confirmación de Lectura (Audit Trail)
Cada alerta enviada tiene un tracking pixel o botón de "Enterado".
Si una alerta crítica (T-24hs) no es confirmada en 4 horas, el sistema escala al siguiente nivel jerárquico (Escalation Policy).

## 3. Modos Especiales

### Modo "Plazo Crítico"
Visualización en el Dashboard que bloquea otras distracciones.
*   Banner rojo superior fijo.
*   Contador regresivo en tiempo real (HH:MM:SS) hasta el cargo de hora.
*   Botón de acción inmediata: "Subir Escrito" o "Marcar Cumplido".

### Configuración por Jurisdicción
El motor permite configurar sets de reglas:
*   `CABA_CIVIL`: Días hábiles judiciales CSJN.
*   `PBA_CIVIL`: Días hábiles SCBA (difiere feriados locales).
*   `FEDERAL`: Días hábiles CN.

## 4. Integración con Calendarios
*   Sync bidireccional con Google Calendar / Outlook.
*   Las alertas críticas bloquean slots en la agenda para "Redacción Escrito".
