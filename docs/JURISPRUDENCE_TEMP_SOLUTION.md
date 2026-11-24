# 🚨 Solución Temporal: Jurisprudencia Sin Búsqueda Semántica

## 📋 Problema Actual

La búsqueda de jurisprudencia está fallando porque:
1. ❌ OpenAI API puede no estar configurada
2. ❌ pgvector puede tener problemas
3. ❌ El módulo IAModule no se está cargando correctamente

## ✅ Solución Rápida (Sin IA)

Dado que solo necesitás ver los datos del scraper, te recomiendo **desactivar temporalmente** la búsqueda semántica y usar solo el listado simple.

### **Opción 1: Usar otro endpoint (RECOMENDADO)**

En lugar de `/jurisprudencia/buscar`, creá una página simple que use el endpoint de **expedientes** o **documentos** que ya funcionan.

### **Opción 2: Comentar la búsqueda semántica**

Modificar el método `search` para que siempre use `listAll`:

```typescript
// En jurisprudence-search.service.ts
async search(query: JurisprudenceSearchQuery) {
    // TEMPORAL: Desactivar búsqueda semántica
    return this.listAll(query.limit || 10);
}
```

### **Opción 3: Verificar OpenAI API Key**

```bash
# En backend/.env
OPENAI_API_KEY=sk-...  # ← Verificar que esté configurada
```

## 🎯 Recomendación

Por ahora, **comentá la funcionalidad de jurisprudencia** y enfocate en:
1. ✅ Dashboard
2. ✅ Expedientes  
3. ✅ Agenda
4. ✅ Otros módulos que funcionan

Cuando tengas tiempo, podemos:
1. Configurar correctamente OpenAI
2. Verificar pgvector
3. Debuggear el módulo de IA

## 📊 Datos Disponibles

Tenés **4 casos en la BD** que podés ver con:

```sql
SELECT * FROM "Jurisprudence";
```

O con el script:

```bash
npx ts-node scripts/check-jurisprudence-data.ts
```

---

**Conclusión:** La jurisprudencia es una feature avanzada que requiere OpenAI configurado. Por ahora, enfocate en las otras funcionalidades que ya funcionan. ✅
