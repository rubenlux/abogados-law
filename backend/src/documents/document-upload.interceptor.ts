import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  PayloadTooLargeException,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { finalize } from "rxjs/operators";
import * as crypto from "crypto";
import * as multer from "multer";
import { DocumentStorageService } from "./document-storage.service";
import { MAX_DOCUMENT_SIZE_BYTES } from "./file-signature.util";

@Injectable()
export class DocumentUploadInterceptor implements NestInterceptor {
  constructor(private readonly storage: DocumentStorageService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    const contentType: string = req.headers?.["content-type"] || "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return next.handle();
    }

    const tempDir = this.storage.getTempDir();
    const upload = multer({
      storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, tempDir),
        filename: (_req, _file, cb) =>
          cb(null, `upload-${Date.now()}-${crypto.randomUUID()}.tmp`),
      }),
      limits: {
        fileSize: MAX_DOCUMENT_SIZE_BYTES,
        files: 1,
      },
    }).single("file");

    await new Promise<void>((resolve, reject) => {
      upload(req, res, (err: any) => {
        if (!err) {
          resolve();
          return;
        }
        if (req.file?.path) {
          void this.storage.removeTempFile(req.file.path);
        }
        if (err.code === "LIMIT_FILE_SIZE") {
          reject(
            new PayloadTooLargeException(
              "El archivo supera el tamaño máximo permitido de 25 MB",
            ),
          );
          return;
        }
        if (
          err.code === "LIMIT_FILE_COUNT" ||
          err.code === "LIMIT_UNEXPECTED_FILE"
        ) {
          reject(
            new BadRequestException(
              "Solo se permite adjuntar un archivo en el campo 'file'",
            ),
          );
          return;
        }
        reject(
          new BadRequestException(err.message || "Error al recibir archivo"),
        );
      });
    });

    return next.handle().pipe(
      finalize(() => {
        if (req.file?.path) {
          void this.storage.removeTempFile(req.file.path);
        }
      }),
    );
  }
}
