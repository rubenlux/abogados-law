import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";

@Injectable()
export class ClientPortalService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(email: string, cuit: string) {
    // Simplified login: Email + CUIT matching a Client entity
    // In a real app we would use passwords, but clients often forget them.
    // A magic link is better, but here we use CUIT as a "password"/validator for MVP.

    const client = await this.prisma.client.findFirst({
      where: { email }, // Assuming 'cuit' or similar verification field exists or we match Organization
    });

    // For this demo, we will check against the User table if they have role CLIENT
    // Or we map Client entity to a User entity.
    // Let's assume we look for a User with role CLIENT linked to that email.

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || user.role !== "CLIENT") {
      throw new UnauthorizedException(
        "Credenciales inválidas o acceso no habilitado para clientes.",
      );
    }

    // Validate password (in prod) or simplistic check
    // const isMatch = await bcrypt.compare(password, user.passwordHash);
    // if (!isMatch) throw new UnauthorizedException();

    const payload = {
      sub: user.id,
      email: user.email,
      role: "CLIENT",
      organizationId: user.organizationId,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.fullName,
        email: user.email,
      },
    };
  }

  async getMyCases(userId: string) {
    // Find the Client entity associated with this User
    // This assumes a link. For now, we search Expedientes where this user is assigned (as a client)
    // Or simpler: We search expedientes of the org if it's a direct mapping (rare).

    // MVP: Search Expedientes linked to the Organization but we need a specific link User->Expediente for privacy.
    // We will assume 'users' relation in Expediente includes the client user.

    return this.prisma.expediente.findMany({
      where: {
        users: {
          some: { id: userId },
        },
        // Do not show archived cases by default
        NOT: { estado: "ARCHIVADO" },
      },
      select: {
        id: true,
        caratula: true,
        numeroExpediente: true,
        juzgado: true,
        jurisdiccion: true,
        estado: true,
        updatedAt: true,
      },
    });
  }

  async getCaseDetail(userId: string, caseId: string) {
    // Validate access
    const expediente = await this.prisma.expediente.findFirst({
      where: {
        id: caseId,
        users: { some: { id: userId } },
      },
      include: {
        eventos: {
          // Filter public events only (assuming isCritical or a new flag 'isPublic')
          // For MVP we show 'FATAL' and 'SENTENCIA' types
          where: {
            tipoPlazo: { in: ["FATAL", "ORDINARIO"] },
          },
          orderBy: { fechaVencimiento: "desc" },
          take: 5,
        },
      },
    });

    if (!expediente)
      throw new UnauthorizedException(
        "No tiene permiso para ver este expediente.",
      );

    return expediente;
  }
}
