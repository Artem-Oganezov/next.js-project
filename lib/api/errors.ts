import { NextResponse } from "next/server";

export type ApiErrorBody = {
  message: string;
};

export function jsonError(message: string, status: number): NextResponse<ApiErrorBody> {
  return NextResponse.json({ message }, { status });
}

export function badRequest(message: string): NextResponse<ApiErrorBody> {
  return jsonError(message, 400);
}

export function unauthorized(message = "Unauthorized"): NextResponse<ApiErrorBody> {
  return jsonError(message, 401);
}

export function forbidden(message: string): NextResponse<ApiErrorBody> {
  return jsonError(message, 403);
}

export function notFound(message: string): NextResponse<ApiErrorBody> {
  return jsonError(message, 404);
}

export function conflict(message: string): NextResponse<ApiErrorBody> {
  return jsonError(message, 409);
}

export function internalError(
  message = "Internal server error",
): NextResponse<ApiErrorBody> {
  return jsonError(message, 500);
}
