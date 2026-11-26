import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

/**
 * Interfaz preparada para futura integración de escaneo antivirus (ej. ClamAV).
 * En AUTH-08 se utiliza la implementación No-Op documentada.
 */
export interface DocumentMalwareScanner {
  scanFile(filePath: string): Promise<{ clean: boolean; reason?: string }>;
}

@Injectable()
export class NoOpDocumentMalwareScanner implements DocumentMalwareScanner {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async scanFile(
    _filePath: string,
  ): Promise<{ clean: boolean; reason?: string }> {
    return { clean: true };
  }
}

@Injectable()
export class DocumentStorageService {
  private readonly logger = new Logger(DocumentStorageService.name);
  private readonly storageRoot: string;
  private readonly tempRoot: string;

  constructor(private readonly configService: ConfigService) {
    const configured =
      this.configService.get<string>("DOCUMENT_STORAGE_ROOT")?.trim() ||
      path.resolve(process.cwd(), ".private-storage/documents");

    this.storageRoot = this.validateAndEnsureRoot(configured);
    this.tempRoot = path.join(this.storageRoot, ".tmp");
    fs.mkdirSync(this.tempRoot, { recursive: true, mode: 0o700 });
  }

  private validateAndEnsureRoot(candidate: string): string {
    const resolved = path.resolve(candidate);
    const normalizedLower = resolved.replace(/\\/g, "/").toLowerCase();

    // Prohibir explícitamente almacenamiento en carpetas públicas o de frontend
    const forbiddenSegments = [
      "/frontend/public",
      "/frontend/dist",
      "/public/",
    ];
    if (
      forbiddenSegments.some((seg) => normalizedLower.includes(seg)) ||
      normalizedLower.endsWith("/public")
    ) {
      throw new InternalServerErrorException(
        "DOCUMENT_STORAGE_ROOT no puede ubicarse dentro de un directorio público",
      );
    }

    fs.mkdirSync(resolved, { recursive: true, mode: 0o700 });
    return fs.realpathSync(resolved);
  }

  getStorageRoot(): string {
    return this.storageRoot;
  }

  getTempDir(): string {
    fs.mkdirSync(this.tempRoot, { recursive: true, mode: 0o700 });
    return this.tempRoot;
  }

  /**
   * Genera una clave de almacenamiento opaca, aleatoria e impredecible.
   * Nunca incluye el nombre original del archivo.
   */
  buildStorageKey(
    organizationId: string,
    documentId: string,
    versionNumber: number,
  ): string {
    const randomId = crypto.randomUUID();
    return `tenants/${organizationId}/docs/${documentId}/v${versionNumber}/${randomId}.bin`;
  }

  /**
   * Resuelve una storageKey garantizando contención estricta dentro de DOCUMENT_STORAGE_ROOT
   * y protegiendo contra traversal y symlinks.
   */
  resolveSafePath(storageKey: string): string {
    if (
      !storageKey ||
      typeof storageKey !== "string" ||
      storageKey.includes("..") ||
      storageKey.includes("\0") ||
      storageKey.startsWith("/") ||
      storageKey.startsWith("\\") ||
      /^[a-zA-Z]:/.test(storageKey)
    ) {
      throw new BadRequestException("storageKey inválida");
    }

    const resolved = path.resolve(this.storageRoot, storageKey);
    const rootWithSep = this.storageRoot.endsWith(path.sep)
      ? this.storageRoot
      : `${this.storageRoot}${path.sep}`;

    if (!resolved.startsWith(rootWithSep)) {
      throw new BadRequestException(
        "Intento de acceso fuera de DOCUMENT_STORAGE_ROOT bloqueado",
      );
    }

    return resolved;
  }

  async computeFileSha256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash("sha256");
      const stream = fs.createReadStream(filePath);
      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolve(hash.digest("hex")));
    });
  }

  /**
   * Promueve un archivo temporal a su ubicación definitiva usando apertura exclusiva ('wx'),
   * impidiendo sobrescrituras y symlinks.
   */
  async promoteTempFile(tempPath: string, storageKey: string): Promise<void> {
    const destPath = this.resolveSafePath(storageKey);
    const destDir = path.dirname(destPath);
    await fs.promises.mkdir(destDir, { recursive: true, mode: 0o700 });

    // Verificar que el directorio padre no es un symlink que escape del root
    const realDestDir = await fs.promises.realpath(destDir);
    const rootWithSep = this.storageRoot.endsWith(path.sep)
      ? this.storageRoot
      : `${this.storageRoot}${path.sep}`;
    if (
      realDestDir !== this.storageRoot &&
      !realDestDir.startsWith(rootWithSep)
    ) {
      throw new BadRequestException("Destino de almacenamiento no permitido");
    }

    let handle: fs.promises.FileHandle | null = null;
    try {
      // 'wx' falla con EEXIST si el objeto ya existe (prohíbe sobrescritura)
      handle = await fs.promises.open(destPath, "wx", 0o600);
      await new Promise<void>((resolve, reject) => {
        const readStream = fs.createReadStream(tempPath);
        const writeStream = handle!.createWriteStream();
        readStream.on("error", reject);
        writeStream.on("error", reject);
        writeStream.on("finish", resolve);
        readStream.pipe(writeStream);
      });
    } catch (err: any) {
      if (handle) {
        await handle.close().catch(() => undefined);
        handle = null;
      }
      if (err?.code === "EEXIST") {
        throw new ConflictException(
          "El objeto de almacenamiento destino ya existe (sobrescritura prohibida)",
        );
      }
      await fs.promises.unlink(destPath).catch(() => undefined);
      throw err;
    } finally {
      if (handle) {
        await handle.close().catch(() => undefined);
      }
    }
  }

  async removeTempFile(tempPath?: string): Promise<void> {
    if (!tempPath) return;
    try {
      await fs.promises.unlink(tempPath);
    } catch {
      // Ignorar si ya fue removido
    }
  }

  async deletePromotedObject(storageKey: string): Promise<void> {
    try {
      const target = this.resolveSafePath(storageKey);
      await fs.promises.unlink(target);
    } catch (err) {
      this.logger.warn(
        `No se pudo eliminar objeto durante compensación: ${storageKey}`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  /**
   * Verifica existencia, ausencia de symlinks e integridad SHA-256 en disco
   * antes de abrir el stream de descarga.
   */
  async verifyAndOpenReadStream(
    storageKey: string,
    expectedSha256: string,
  ): Promise<fs.ReadStream> {
    const resolved = this.resolveSafePath(storageKey);

    let stat: fs.Stats;
    try {
      stat = await fs.promises.lstat(resolved);
    } catch {
      throw new InternalServerErrorException(
        "Archivo físico no encontrado en almacenamiento privado",
      );
    }

    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new BadRequestException("Objeto de almacenamiento inválido");
    }

    const actualSha256 = await this.computeFileSha256(resolved);
    const actualBuf = Buffer.from(actualSha256, "utf8");
    const expectedBuf = Buffer.from(expectedSha256, "utf8");
    if (
      actualBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(actualBuf, expectedBuf)
    ) {
      throw new ConflictException(
        "Falla de integridad documental: el hash SHA-256 del archivo en disco no coincide",
      );
    }

    return fs.createReadStream(resolved);
  }
}
