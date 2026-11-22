import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { OrderError } from "../orders/orders.service";

function errorCode(error: unknown) {
  return error instanceof Error && "code" in error ? error.code : undefined;
}

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  catch(error: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const reply = http.getResponse<FastifyReply>();
    if (reply.sent) return;

    const send = (
      status: number,
      code: string,
      message: string,
      details?: unknown,
    ) => reply.code(status).send({ error: { code, message, details } });

    if (error instanceof ZodError) {
      return send(
        400,
        "INVALID_INPUT",
        "Check the submitted values.",
        error.issues,
      );
    }

    if (error instanceof OrderError) {
      const status =
        error.code === "ORDER_NOT_FOUND"
          ? 404
          : error.code === "UNKNOWN_PRODUCT"
            ? 400
            : 409;
      return send(status, error.code, error.message, error.details);
    }

    const code = errorCode(
      error instanceof Error ? (error.cause ?? error) : error,
    );
    const status =
      error instanceof HttpException ? error.getStatus() : undefined;
    if (
      code === "FST_ERR_CTP_INVALID_JSON_BODY" ||
      code === "FST_ERR_CTP_EMPTY_JSON_BODY"
    ) {
      return send(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
    if (status === 413) {
      return send(413, "REQUEST_TOO_LARGE", "The request body is too large.");
    }
    if (status === 415) {
      return send(
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "Send the request body as JSON.",
      );
    }
    if (status === 404) {
      return send(404, "NOT_FOUND", "API endpoint was not found.");
    }
    if (status === 400) {
      return send(400, "INVALID_INPUT", "Check the submitted values.");
    }

    if (code === "40001" || code === "40P01" || code === "55P03") {
      return send(
        503,
        "DATABASE_BUSY",
        "The console is busy. Try again in a moment.",
      );
    }

    const request = http.getRequest<FastifyRequest>();
    this.logger.error(`Request ${request.id} failed`, error);
    return send(500, "INTERNAL_ERROR", "An unexpected error occurred.");
  }
}
