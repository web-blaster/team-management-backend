import { ZodError } from "zod";
import { logger } from "../config/logger.js";
import { AppError, uuid, verifyAccessToken } from "../utils/core.js";
import { authService } from "../modules/auth/auth.service.js";

export function requestId(req, res, next) {
  req.id = req.get("x-request-id") || uuid();
  res.setHeader("x-request-id", req.id);
  next();
}
export const validate =
  (schema, source = "body") =>
  (req, _res, next) => {
    const parsed = schema.parse(req[source]);
    // Express 5 exposes req.query as a getter, so define the validated value explicitly.
    if (source === "query")
      Object.defineProperty(req, "query", {
        value: parsed,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    else req[source] = parsed;
    next();
  };

export async function authenticate(req, _res, next) {
  try {
    const header = req.get("authorization");
    if (!header?.startsWith("Bearer "))
      throw new AppError(401, "Authentication required");
    const payload = verifyAccessToken(header.slice(7));
    req.user = await authService.resolveAuthenticatedUser(payload);
    next();
  } catch (error) {
    if (["TokenExpiredError", "JsonWebTokenError"].includes(error.name))
      return next(new AppError(401, "Invalid or expired access token"));
    next(error);
  }
}
export const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user || !roles.some((r) => req.user.roles.includes(r)))
      return next(new AppError(403, "Permission denied"));
    next();
  };
export function notFound(req, _res, next) {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}
export function errorHandler(error, req, res, _next) {
  let status = error.statusCode || 500,
    message = error.message || "Internal server error",
    details = error.details;
  if (error instanceof ZodError) {
    status = 422;
    message = "Validation failed";
    details = error.issues;
  }
  if (error.code === "ER_DUP_ENTRY") {
    status = 409;
    message = "A duplicate record already exists";
  }
  if (error.code === "ER_NO_REFERENCED_ROW_2") {
    status = 422;
    message = "Referenced record does not exist";
  }
  if (status >= 500) {
    logger.error({ err: error, requestId: req.id }, "Unhandled request error");
    message = "Internal server error";
    details = undefined;
  }
  res
    .status(status)
    .json({
      success: false,
      error: { message, ...(details ? { details } : {}), requestId: req.id },
    });
}
