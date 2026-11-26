/**
 * Validación de Inyección de Dependencias en Módulo de Pruebas NestJS.
 * Especificación: SPEC-TST-001 (TST-HARNESS-004)
 */
import { Test, TestingModule } from "@nestjs/testing";
import { Injectable } from "@nestjs/common";

@Injectable()
class ProbeService {
  ping(): string {
    return "pong";
  }
}

describe("NestJS Testing Module Dependency Injection (TST-HARNESS-004)", () => {
  let moduleRef: TestingModule;
  let service: ProbeService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [ProbeService],
    }).compile();

    service = moduleRef.get<ProbeService>(ProbeService);
  });

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  it("should compile testing module in memory and inject ProbeService correctly", () => {
    expect(moduleRef).toBeDefined();
    expect(service).toBeDefined();
    expect(service.ping()).toBe("pong");
  });
});
