/**
 * Validación de Integración HTTP Local con Supertest.
 * Especificación: SPEC-TST-001 (OBS-007, TST-HARNESS-007, TST-HARNESS-009)
 *
 * Utiliza un controlador de sonda efímero montado localmente sin puerto público fijo.
 * Cierra limpiamente los recursos con app.close() garantizando cero open handles.
 */
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, Controller, Get } from "@nestjs/common";
import * as request from "supertest";

@Controller("harness-probe")
class HarnessProbeController {
  @Get("ping")
  ping() {
    return { status: "ok", timestamp: Date.now() };
  }
}

describe("Supertest Local HTTP Probe Harness (TST-HARNESS-007)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [HarnessProbeController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it("GET /harness-probe/ping should return 200 with JSON payload and clean connection", async () => {
    const response = await request(app.getHttpServer())
      .get("/harness-probe/ping")
      .expect(200);

    expect(response.body).toBeDefined();
    expect(response.body.status).toBe("ok");
    expect(typeof response.body.timestamp).toBe("number");
  });
});
