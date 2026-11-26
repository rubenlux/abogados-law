/**
 * Runner de Validación Multiplataforma para Aserción Fallida.
 * Especificación: SPEC-TST-001 (OBS-008, TST-HARNESS-003)
 *
 * Crea un archivo de prueba temporal en src/, invoca Jest, verifica que
 * retorne código distinto de cero (1) y elimina el fixture en finally.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const tempSpec = path.resolve(__dirname, '../../src/__temp_fail__.spec.ts');

try {
  // 1. Crear fixture con aserción intencionalmente rota
  fs.writeFileSync(
    tempSpec,
    "describe('Intentional Fail Probe', () => {\n" +
      "  it('should intentionally fail to prove runner failure detection', () => {\n" +
      '    expect(1).toBe(2);\n' +
      '  });\n' +
      '});\n'
  );

  // 2. Invocar Jest exclusivamente sobre el fixture efímero
  const res = spawnSync('npx', ['jest', 'src/__temp_fail__.spec.ts', '--no-cache'], {
    shell: true,
    stdio: 'pipe',
    cwd: path.resolve(__dirname, '../..'),
    encoding: 'utf-8',
  });

  // 3. Comprobar que Jest haya fallado (código no-cero)
  if (res.status === 0) {
    console.error('FATAL [VERIFY-FAIL]: Jest retornó 0 ante una aserción rota. Falso positivo detectado!');
    process.exit(1);
  }

  console.log(`PASS [VERIFY-FAIL]: Jest retornó correctamente código de salida no-cero: ${res.status}`);
} finally {
  // 4. Limpieza obligatoria garantizada
  if (fs.existsSync(tempSpec)) {
    fs.unlinkSync(tempSpec);
  }
}

