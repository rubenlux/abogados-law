# ESPECIFICACIÓN TÉCNICA: SPEC-TST-001 (VERSIÓN DEFINITIVA RECONCILIADA)
## Infraestructura de Pruebas Automatizadas y Calidad Técnica (TDS)

**Expediente:** `SPEC-TST-001-FINAL-RECONCILIATION-001`  
**Referencia:** `SPEC-TST-001-REMEDIATION-001` / `ABOGADOS-LAW-GIT-BASELINE-VERIFICATION-002`  
**Proyecto:** Abogado Virtual (`Abogados_law`)  
**Módulo Destino:** `backend/`  
**Estado:** DOCUMENTO CONSOLIDADO — LISTO PARA APROBACIÓN EXPRESA  
**Modalidad:** READ-ONLY (Documento de diseño técnico; sin implementación en esta fase)  
**Metodología:** Test-Driven Specification (TDS)  

---

## 1. OBJETIVO Y DELIMITACIÓN ESTRICTA DEL ALCANCE

El propósito de `SPEC-TST-001` es dotar al backend de NestJS de una infraestructura de pruebas automatizadas confiable, reproducible, aislada y determinista, como **condición previa obligatoria** para abordar la posterior remediación de vulnerabilidades de seguridad (`SPEC-SEC-001` a `SPEC-SEC-007`).

### 1.1. Separación Estricta de Responsabilidades (OBS-001)
`SPEC-TST-001` se limita a proveer las herramientas, helpers, configuraciones y arnés de ejecución para probar. **No anticipa ni implementa lógica de negocio ni pruebas de seguridad correspondientes a las fases SEC**:

- **Dentro del Alcance de SPEC-TST-001:**
  1. Configuración de Jest (`package.json`) y scripts npm mínimos y reproducibles.
  2. Configuración dedicada para pruebas E2E (`test/jest-e2e.json`).
  3. Carga estricta y fail-closed de variables de entorno mediante `setupFiles` (`.env.test`).
  4. Validador estructural de seguridad para base de datos (`assertSafeTestDatabaseUrl`).
  5. Política determinista ante disponibilidad de PostgreSQL (local vs CI).
  6. Factory de mocks fuertemente tipado para `PrismaService` basado en tipos reales de `@prisma/client`.
  7. Fixtures deterministas con tipos válidos del esquema Prisma sin `as any`.
  8. Prueba de integración HTTP básica con Supertest sobre endpoint de sonda local sin puerto fijo.
  9. Configuración de cobertura de código LCOV y HTML sin umbrales arbitrarios iniciales.
  10. Restauración de `.eslintrc.js` compatible con ESLint 8.57 y TypeScript 5.9.

- **Expresamente Fuera del Alcance de SPEC-TST-001 (Pertenecen a Fases SEC posteriores):**
  - Validación de tokens JWT reales, firmas criptográficas, expiración o tokens manipulados (Pertenecen a `SPEC-SEC-001` y `SPEC-SEC-005`).
  - Pruebas de autenticación y autorización real sobre controladores de negocio (Pertenecen a `SPEC-SEC-001` y `SPEC-SEC-004`).
  - Pruebas de aislamiento multi-tenant y respuestas 404/403 ante accesos cruzados (Pertenecen a `SPEC-SEC-003`).
  - Pruebas de rate limiting con `ThrottlerGuard` (Pertenecen a `SPEC-SEC-007`).
  - Modificación de esquemas de Prisma o ejecución de migraciones de base de datos.
  - Composición completa de `AppModule` con timers o background jobs activos (Diferida según OBS-002).

---

## 2. AUDITORÍA TÉCNICA DE DEPENDENCIAS INSTALADAS

La inspección física directa en `backend/node_modules/` certifica las siguientes versiones disponibles:

| Dependencia | Declarada en `package.json` | Versión Real en `node_modules` | Compatibilidad y Rol en el Arnés |
|---|---|---|---|
| `jest` | `^29.5.0` | **`29.7.0`** | Runner principal de pruebas. |
| `ts-jest` | `^29.1.0` | **`29.4.6`** | Transpilador TypeScript para Jest. |
| `@nestjs/testing` | `^10.0.0` | **`10.4.22`** | Contenedor de inyección de dependencias para tests. |
| `supertest` | `^6.3.3` | **`6.3.4`** | Cliente HTTP para pruebas de integración sobre Express. |
| `@types/jest` | `^29.5.2` | **`29.5.14`** | Definiciones de tipos TypeScript para Jest. |
| `@types/supertest` | `^2.0.12` | **`2.0.16`** | Definiciones de tipos TypeScript para Supertest. |
| `typescript` | `^5.1.3` | **`5.9.3`** | Compilador TypeScript del proyecto (`strict: false`). |
| `eslint` | `^8.42.0` | **`8.57.1`** | Linter de código estático. |
| `@typescript-eslint/parser` | `^6.0.0` | **`6.21.0`** | Parser TS para ESLint 8.x. |
| `@typescript-eslint/eslint-plugin` | `^6.0.0` | **`6.21.0`** | Plugin de reglas TS (sin reglas obsoletas). |
| `eslint-config-prettier` | `^9.0.0` | **`9.1.2`** | Desactivación de reglas en conflicto con Prettier. |
| `eslint-plugin-prettier` | `^5.0.0` | **`5.5.5`** | Integración de Prettier como regla de ESLint. |
| `prettier` | `^3.0.0` | **`3.8.1`** | Formateador de código. |

*Conclusión Técnica:* No se requiere instalar, actualizar ni descargar ningún paquete npm externo.

---

## 3. ARQUITECTURA DE INFRAESTRUCTURA Y GESTIÓN DE ENTORNO

```
backend/
├── src/
│   └── smoke.spec.ts                   <-- TST-HARNESS-001 y 002 (Runner básico)
├── test/
│   ├── jest-e2e.json                   <-- TST-HARNESS-009 (Configuración E2E)
│   ├── setup-env.ts                    <-- OBS-005 (setupFiles: carga .env.test y DB guard)
│   ├── helpers/
│   │   ├── db-guard.ts                 <-- OBS-003 (Validador fail-closed de DATABASE_URL)
│   │   └── verify-failure.js           <-- OBS-008 (Runner multiplataforma para exit code 1)
│   ├── mocks/
│   │   ├── prisma.mock.ts              <-- OBS-006 (Mock fuertemente tipado sin `as any`)
│   │   └── config.mock.ts              <-- Mock determinista de ConfigService
│   ├── fixtures/
│   │   └── user.fixture.ts             <-- OBS-006 (Fixture determinista modelo User real)
│   ├── harness/
│   │   ├── nestjs-di.spec.ts           <-- TST-HARNESS-004 (Inyección DI en módulo aislado)
│   │   ├── env-isolation.spec.ts       <-- TST-HARNESS-006 (Aislamiento de entorno)
│   │   └── prisma-mock.spec.ts         <-- TST-HARNESS-005 (Prueba de mock tipado)
│   └── e2e/
│       └── http-probe.e2e-spec.ts      <-- OBS-007 / TST-HARNESS-007 (Sonda HTTP Supertest)
├── .env.test.example                   <-- OBS-006 (Template de testing versionado)
├── .env.example                        <-- OBS-006 (Template de desarrollo versionado)
└── .eslintrc.js                        <-- OBS-009 (Configuración ESLint compatible)
```

---

## 4. SUBSANACIONES TÉCNICAS RECONCILIADAS

### 4.1. Política Unificada de Base de Datos de Testing (OBS-003)
Se unifican todos los criterios bajo una regla estricta e inviolable:
- **Base de Datos Autorizada:** Únicamente `abogados_test`. Se rechaza cualquier otro nombre (ej. `abogados_ci_test`, `abogados_db`, `abogados_dev`, `abogados_production`).
- **Hosts Autorizados:** Únicamente `localhost` y `127.0.0.1`. Se rechaza cualquier host remoto o nombre Docker externo (ej. `test-postgres`).
- **Protocolo Autorizado:** Estrictamente `postgresql:` o `postgres:`.
- **Comportamiento Fail-Closed:** La función `assertSafeTestDatabaseUrl(url)` analiza la URL mediante `new URL(url)` y lanza una excepción fatal si el protocolo, el host o el nombre de base de datos no coinciden exactamente con la allowlist.

### 4.2. Orden de Carga de Variables de Entorno (OBS-005)
Para garantizar que ninguna importación de módulos ejecute Prisma o lea `.env` de desarrollo prematuramente:
1. Se configura en Jest la directiva **`setupFiles: ["<rootDir>/../test/setup-env.ts"]`** (o ruta relativa correspondiente).
2. `test/setup-env.ts` se ejecuta antes de cargar cualquier archivo de prueba o módulo NestJS:
   - Fija `process.env.NODE_ENV = 'test'`.
   - Carga `.env.test` de forma explícita.
   - Si `.env.test` no existe, emite un error fatal y **no realiza fallback** hacia `.env`.
   - Ejecuta de inmediato `assertSafeTestDatabaseUrl(process.env.DATABASE_URL)`.

### 4.3. Política de Ausencia de PostgreSQL (OBS-004)
- **Pruebas Unitarias:** 100% en memoria con mocks tipados; nunca requieren PostgreSQL.
- **Entorno Local:** Si una prueba de integración requiere PostgreSQL y el puerto 5432 no responde (timeout 2s), la prueba se marca explícitamente con `describe.skip` y emite una advertencia clara:
  `[TEST SKIPPED]: Base de datos de prueba 'abogados_test' no disponible en localhost:5432. Pruebas de integración con DB omitidas localmente.`
- **Entorno CI:** Si `process.env.CI === 'true'`, la ausencia de PostgreSQL es un **fallo bloqueante inmediato** (código 1). Se prohíbe el skip silencioso en CI.

### 4.4. Tipado Estricto de Mocks de Prisma (OBS-006)
Basado exclusivamente en el `backend/prisma/schema.prisma` real:
- Modelo `User`: `id`, `email`, `passwordHash`, `fullName`, `role` (`UserRole`), `permissions`, `refreshTokenHash`, `organizationId`, `createdAt`, `updatedAt`.
- Enum `UserRole`: `ADMIN`, `PARTNER`, `ASSOCIATE`, `PARALEGAL`, `CLIENT`.
- Se erradica por completo `as any` de los fixtures y mocks.
- `mockPrisma` se limita a los métodos utilizados (`findUnique`, `findFirst`, `create`, `update`, `$connect`, `$disconnect`).

### 4.5. Supertest y Pruebas HTTP (OBS-007)
- Supertest despacha peticiones HTTP contra el servidor Node.js subyacente de NestJS utilizando puertos efímeros locales o piping en memoria. No expone puertos públicos ni fijos (como 3000).
- La prueba `TST-HARNESS-007` utiliza un controlador de sonda efímero (`HarnessProbeController`) con ruta `@Get('ping')` retornando `{ status: 'ok' }`.
- Cierre estricto mediante `await app.close()` en `afterAll` garantizando cero handles abiertos.
- Cero pruebas de vulnerabilidades de seguridad en este nivel.

### 4.6. Procedimiento Multiplataforma para Aserción Fallida (OBS-008)
- Script en Node.js (`test/helpers/verify-fail.js`) ejecutable de forma idéntica en Windows PowerShell y Linux:
  1. Escribe un archivo temporal `src/__temp_fail__.spec.ts` dentro de `rootDir: src` conteniendo `expect(1).toBe(2)`.
  2. Ejecuta `npx jest src/__temp_fail__.spec.ts --no-cache` mediante `child_process.spawnSync`.
  3. Comprueba que el código de salida devuelto sea distinto de 0 (específicamente 1).
  4. En bloque `finally`, elimina `src/__temp_fail__.spec.ts` de forma obligatoria.
  5. Si el archivo temporal quedó fuera o la aserción pasó indebidamente, el script falla.

### 4.7. Configuración ESLint Compatible y Pragmática (OBS-009)
- Se restaura `backend/.eslintrc.js` para ESLint 8.57 y TypeScript 5.9.
- **Se elimina `parserOptions.project`** de la configuración general para evitar errores de proyecto (`file not found in provided project`) al analizar archivos en `test/` o scripts auxiliares.
- Se eliminan reglas obsoletas (`@typescript-eslint/interface-name-prefix`).
- Su único objetivo en esta fase es permitir que `npm run lint` analice el código sin errores fatales de configuración.

### 4.8. Cobertura de Código Desacoplada (OBS-010)
- Configuración en Jest: formatos LCOV, consola (text summary) y HTML en `coverage/`.
- Exclusiones estrictas: archivos de test (`*.spec.ts`, `*.e2e-spec.ts`), `main.ts`, módulos y DTOs.
- **No se impone porcentaje mínimo global bloqueante** en la primera implementación.

---

## 5. SCRIPTS NPM PROPUESTOS

Se incorporan en `backend/package.json` los 5 scripts esenciales:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.json --runInBand",
    "test:ci": "jest --runInBand --coverage --detectOpenHandles"
  }
}
```

*Regla Innegociable:* Se prohíbe el uso de `--forceExit` (enmascara handles abiertos) y `--passWithNoTests` (oculta ausencia de pruebas).

---

## 6. CONFIGURACIÓN JEST DEFINITIVA

En `backend/package.json`:
```json
{
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": [
      "**/*.(t|j)s",
      "!main.ts",
      "!**/*.module.ts",
      "!**/*.dto.ts",
      "!**/*.interface.ts",
      "!**/*.entity.ts"
    ],
    "coverageDirectory": "../coverage",
    "coverageReporters": ["text", "lcov", "html"],
    "testEnvironment": "node",
    "setupFiles": ["<rootDir>/../test/setup-env.ts"]
  }
}
```

En `backend/test/jest-e2e.json`:
```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "setupFiles": ["<rootDir>/setup-env.ts"]
}
```

---

## 7. CRITERIOS DE ACEPTACIÓN DE LA PRIMERA IMPLEMENTACIÓN

1. **`npm test`:** Descubre y ejecuta las pruebas unitarias básicas en `src/` en menos de 5 segundos con código de salida `0`.
2. **Inmunidad a Falsos Positivos:** `node test/helpers/verify-fail.js` confirma que una aserción rota produce exit code `1`.
3. **Aislamiento de BD:** Si `.env.test` falta o `DATABASE_URL` no apunta a `localhost:5432/abogados_test`, el guard aborta de inmediato.
4. **Mocking Tipado:** Las llamadas a `prismaMock.user.findUnique` compilan y ejecutan sin `as any` usando tipos reales de Prisma.
5. **Prueba HTTP:** `npm run test:e2e` ejecuta la sonda HTTP local y cierra limpiamente sin open handles.
6. **Cobertura:** `npm run test:cov` genera `coverage/lcov.info` e informe HTML sin errores de mapeo.
7. **Linter:** `npm run lint` analiza `src/smoke.spec.ts` sin error fatal de configuración.
