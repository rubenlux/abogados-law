/**
 * Mock Factory Fuertemente Tipado para PrismaService.
 * Especificación: SPEC-TST-001 (OBS-006, TST-HARNESS-005)
 *
 * Simula las operaciones de PrismaService de forma 100% tipada,
 * respetando las interfaces de @prisma/client sin recurrir a `as any`.
 */
import {
  User,
  UserIdentity,
  UserSession,
  OidcTransaction,
  Prisma,
} from "@prisma/client";

export type MockPrismaService = {
  user: {
    findUnique: jest.Mock<Promise<User | null>, [Prisma.UserFindUniqueArgs]>;
    findFirst: jest.Mock<Promise<User | null>, [Prisma.UserFindFirstArgs]>;
    create: jest.Mock<Promise<User>, [Prisma.UserCreateArgs]>;
    update: jest.Mock<Promise<User>, [Prisma.UserUpdateArgs]>;
  };
  userIdentity: {
    findUnique: jest.Mock<
      Promise<UserIdentity | null>,
      [Prisma.UserIdentityFindUniqueArgs]
    >;
    findFirst: jest.Mock<
      Promise<UserIdentity | null>,
      [Prisma.UserIdentityFindFirstArgs]
    >;
    create: jest.Mock<Promise<UserIdentity>, [Prisma.UserIdentityCreateArgs]>;
    update: jest.Mock<Promise<UserIdentity>, [Prisma.UserIdentityUpdateArgs]>;
  };
  userSession: {
    findUnique: jest.Mock<
      Promise<UserSession | null>,
      [Prisma.UserSessionFindUniqueArgs]
    >;
    findFirst: jest.Mock<
      Promise<UserSession | null>,
      [Prisma.UserSessionFindFirstArgs]
    >;
    create: jest.Mock<Promise<UserSession>, [Prisma.UserSessionCreateArgs]>;
    update: jest.Mock<Promise<UserSession>, [Prisma.UserSessionUpdateArgs]>;
    delete: jest.Mock<Promise<UserSession>, [Prisma.UserSessionDeleteArgs]>;
  };
  oidcTransaction: {
    findUnique: jest.Mock<
      Promise<OidcTransaction | null>,
      [Prisma.OidcTransactionFindUniqueArgs]
    >;
    findFirst: jest.Mock<
      Promise<OidcTransaction | null>,
      [Prisma.OidcTransactionFindFirstArgs]
    >;
    create: jest.Mock<
      Promise<OidcTransaction>,
      [Prisma.OidcTransactionCreateArgs]
    >;
    update: jest.Mock<
      Promise<OidcTransaction>,
      [Prisma.OidcTransactionUpdateArgs]
    >;
    delete: jest.Mock<
      Promise<OidcTransaction>,
      [Prisma.OidcTransactionDeleteArgs]
    >;
    deleteMany: jest.Mock<
      Promise<Prisma.BatchPayload>,
      [Prisma.OidcTransactionDeleteManyArgs]
    >;
  };
  $queryRaw: jest.Mock<Promise<any>, any[]>;
  $transaction: jest.Mock<Promise<any>, [any]>;
  $connect: jest.Mock<Promise<void>, []>;
  $disconnect: jest.Mock<Promise<void>, []>;
};

export const createPrismaMock = (): MockPrismaService => {
  const oidcStorage = new Map<string, OidcTransaction>();

  const mock: MockPrismaService = {
    user: {
      findUnique: jest.fn<Promise<User | null>, [Prisma.UserFindUniqueArgs]>(),
      findFirst: jest.fn<Promise<User | null>, [Prisma.UserFindFirstArgs]>(),
      create: jest.fn<Promise<User>, [Prisma.UserCreateArgs]>(),
      update: jest.fn<Promise<User>, [Prisma.UserUpdateArgs]>(),
    },
    userIdentity: {
      findUnique: jest.fn<
        Promise<UserIdentity | null>,
        [Prisma.UserIdentityFindUniqueArgs]
      >(),
      findFirst: jest.fn<
        Promise<UserIdentity | null>,
        [Prisma.UserIdentityFindFirstArgs]
      >(),
      create: jest.fn<Promise<UserIdentity>, [Prisma.UserIdentityCreateArgs]>(),
      update: jest.fn<Promise<UserIdentity>, [Prisma.UserIdentityUpdateArgs]>(),
    },
    userSession: {
      findUnique: jest.fn<
        Promise<UserSession | null>,
        [Prisma.UserSessionFindUniqueArgs]
      >(),
      findFirst: jest.fn<
        Promise<UserSession | null>,
        [Prisma.UserSessionFindFirstArgs]
      >(),
      create: jest.fn<Promise<UserSession>, [Prisma.UserSessionCreateArgs]>(),
      update: jest.fn<Promise<UserSession>, [Prisma.UserSessionUpdateArgs]>(),
      delete: jest.fn<Promise<UserSession>, [Prisma.UserSessionDeleteArgs]>(),
    },
    oidcTransaction: {
      findUnique: jest.fn(
        async (args: Prisma.OidcTransactionFindUniqueArgs) => {
          if (args.where.transactionId) {
            return oidcStorage.get(args.where.transactionId) || null;
          }
          return null;
        },
      ) as any,
      findFirst: jest.fn(async () => null) as any,
      create: jest.fn(async (args: Prisma.OidcTransactionCreateArgs) => {
        const item: OidcTransaction = {
          transactionId: args.data.transactionId,
          state: args.data.state,
          nonce: args.data.nonce,
          codeVerifier: args.data.codeVerifier,
          expiresAt: args.data.expiresAt as Date,
          createdAt: new Date(),
        };
        oidcStorage.set(item.transactionId, item);
        return item;
      }) as any,
      update: jest.fn() as any,
      delete: jest.fn(async (args: Prisma.OidcTransactionDeleteArgs) => {
        const item = oidcStorage.get(args.where.transactionId) || null;
        if (item) {
          oidcStorage.delete(args.where.transactionId);
          return item;
        }
        throw new Error("Record not found to delete");
      }) as any,
      deleteMany: jest.fn(async () => {
        const count = oidcStorage.size;
        oidcStorage.clear();
        return { count };
      }) as any,
    },
    $queryRaw: jest.fn(
      async (query: TemplateStringsArray | Prisma.Sql, ...values: any[]) => {
        const sqlText = Array.isArray(query)
          ? query.join(" ")
          : (query as any)?.strings?.join(" ") || "";
        const params = Array.isArray(query)
          ? values
          : (query as any)?.values || values;
        if (
          sqlText.includes('DELETE FROM "OidcTransaction"') &&
          typeof params[0] === "string"
        ) {
          const txId = params[0];
          const item = oidcStorage.get(txId);
          if (!item) return [];
          oidcStorage.delete(txId);
          return [item];
        }
        return [];
      },
    ),
    $transaction: jest.fn(async (cbOrArray: any) => {
      if (typeof cbOrArray === "function") {
        return cbOrArray(mock);
      }
      return Promise.all(cbOrArray);
    }),
    $connect: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    $disconnect: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
  };

  return mock;
};
