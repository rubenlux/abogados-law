/**
 * Validación de Mocking Tipado de PrismaService conforme al modelo User real.
 * Especificación: SPEC-TST-001 (OBS-006, TST-HARNESS-005)
 *
 * Prohibido el uso de `as any`. Utiliza tipos reales de @prisma/client.
 */
import { UserRole } from "@prisma/client";
import { createPrismaMock, MockPrismaService } from "../mocks/prisma.mock";
import { createFixtureUser } from "../fixtures/user.fixture";

describe("PrismaService Typed Mocking (TST-HARNESS-005)", () => {
  let prismaMock: MockPrismaService;

  beforeEach(() => {
    prismaMock = createPrismaMock();
  });

  it("should intercept findUnique and return strongly typed User fixture without as any", async () => {
    const fixtureUser = createFixtureUser({
      role: UserRole.ASSOCIATE,
      fullName: "Dra. María Test",
    });

    prismaMock.user.findUnique.mockResolvedValue(fixtureUser);

    const result = await prismaMock.user.findUnique({
      where: { id: fixtureUser.id },
    });

    expect(result).toBeDefined();
    expect(result?.id).toBe(fixtureUser.id);
    expect(result?.email).toBe("test.user@abogados.com");
    expect(result?.fullName).toBe("Dra. María Test");
    expect(result?.role).toBe(UserRole.ASSOCIATE);
    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(1);
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: fixtureUser.id },
    });
  });

  it("should mock database connect and disconnect cleanly in memory", async () => {
    await expect(prismaMock.$connect()).resolves.toBeUndefined();
    await expect(prismaMock.$disconnect()).resolves.toBeUndefined();
    expect(prismaMock.$connect).toHaveBeenCalledTimes(1);
    expect(prismaMock.$disconnect).toHaveBeenCalledTimes(1);
  });
});
