# Motor de Calendario Judicial y Cálculo de Plazos

## 1. Visión General
El motor determina la fecha exacta de vencimiento de un plazo procesal basándose en reglas complejas de "Días Hábiles", "Feriados Móviles" y "Suspensión de Términos".

## 2. Entidad `CalendarioJudicial`
Base de conocimientos de días inhábiles.

### Estructura de Datos (Prisma)
```prisma
model CalendarioJudicial {
  jurisdiccion     String   // "NACION", "PBA", "CABA_PENAL"
  fecha            DateTime // YYYY-MM-DD
  descripcion      String   // ej. "Feria Judicial Invernal"
  esFeriado        Boolean  // Feriado Nacional (inamovible o trasladable)
  esInhabil        Boolean  // Asueto judicial (ej. Dia del Judicial)
  suspendePlazos   Boolean  // True = No cuenta para el plazo
  nota             String?  // Link a la Acordada
}
```

### Fuentes de Datos
1.  **Feriados Nacionales**: API del Ministerio del Interior.
2.  **Acordadas CSJN / SCBA**: Scraping periódico de sitios oficiales para detectar "Suspensión de Términos" por fuerza mayor (ej. caída de sistema, pandemia).

## 3. Algoritmo de Cálculo (Pseudocódigo Avanzado)

```typescript
interface DeadlineRequest {
  fechaNotificacion: Date;
  tipoProceso: 'ORDINARIO' | 'SUMARISIMO' | 'EJECUTIVO';
  jurisdiccion: 'NACION' | 'PBA';
  tipoPlazo: 'DIAS_HABILES' | 'DIAS_CORRIDOS';
  cantidadDias: number;
}

function calcularVencimiento(req: DeadlineRequest): Date {
  let contador = 0;
  let cursor = req.fechaNotificacion; 
  
  // Regla 0: El plazo comienza a correr el día siguiente a la NOTA (en Nación)
  // En PBA a veces es diferente con notificaciones electrónicas (martes/viernes).
  cursor = getNextDay(cursor); 

  while (contador < req.cantidadDias) {
    const esFinde = isWeekend(cursor);
    const esFeriado = checkCalendario(req.jurisdiccion, cursor);
    
    if (req.tipoPlazo === 'DIAS_HABILES') {
      if (!esFinde && !esFeriado.suspendePlazos) {
        contador++;
      }
    } else {
      // DÍAS CORRIDOS (Civil CCyC)
      // Cuentan todos, SALVO que el vto caiga en inhábil
      contador++;
    }
    
    // Avanzar si no se cumplió
    if (contador < req.cantidadDias) {
      cursor = getNextDay(cursor);
    }
  }
  
  // Regla final: Si el vencimiento (cursor) cae en inhábil, se prorroga al primer hábil siguiente
  while (isWeekend(cursor) || checkCalendario(req.jurisdiccion, cursor).esInhabil) {
     cursor = getNextDay(cursor);
  }

  // Cargo de Hora (Grace Period)
  // Retornar fecha + 2hs del día siguiente hábil (si aplica)
  return applyGracePeriod(cursor); 
}
```

## 4. Reglas por Tipo de Proceso (Configurables)
*   **Ordinario (Nación)**: 15 días hábiles.
*   **Sumarísimo**: 5 días hábiles (plazos breves).
*   **Amparo**: 48hs (horas, no días). Requiere lógica de horas hábiles.
*   **Penal**: Días corridos (generalmente), salvo actos procesales específicos.

## 5. Manejo de Feriados Móviles
El sistema debe permitir "Proyecciones". Si se calcula un plazo a 60 días y hay un feriado puente "potencial", el sistema debe alertar: *"Atención: Posible feriado puente en fecha X, el vencimiento podría desplazarse."*
