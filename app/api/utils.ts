import { NextResponse } from "next/server";

type ErrorResponse = {
  error: string;
  details?: string;
};

const ERROR_MESSAGES = {
  TIMEOUT: "Request timed out",
  PARSE_ERROR: "Invalid response from AI service",
} as const;

const ERROR_STATUS_CODES = {
  TIMEOUT: 408,
  SERVER_ERROR: 500,
  BAD_REQUEST: 400,
} as const;

export function handleApiError(error: unknown, defaultMessage: string): NextResponse<ErrorResponse> {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return NextResponse.json(
        { error: ERROR_MESSAGES.TIMEOUT }, 
        { status: ERROR_STATUS_CODES.TIMEOUT }
      );
    }
    
    if (error.message.includes("parse")) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.PARSE_ERROR },
        { status: ERROR_STATUS_CODES.SERVER_ERROR }
      );
    }
    
    return NextResponse.json(
      { 
        error: defaultMessage,
        details: process.env.NODE_ENV === "development" ? error.message : undefined
      },
      { status: ERROR_STATUS_CODES.SERVER_ERROR }
    );
  }
  
  return NextResponse.json(
    { error: defaultMessage }, 
    { status: ERROR_STATUS_CODES.SERVER_ERROR }
  );
}

// Supabase (PostgREST) failures are thrown as plain objects, not Error
// instances -- String() them and you get "[object Object]". Dig the message
// out of whatever shape arrives.
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const maybe = error as { message?: unknown; details?: unknown; code?: unknown };
    if (maybe.message) {
      return [maybe.message, maybe.details, maybe.code && `(${maybe.code})`]
        .filter(Boolean)
        .join(" ");
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

export function validateRequest<T extends Record<string, unknown>>(
  data: unknown,
  requiredFields: (keyof T)[]
): data is T {
  if (!data || typeof data !== "object") return false;
  
  const obj = data as Record<string, unknown>;
  return requiredFields.every(field => {
    const key = field as string;
    return key in obj && obj[key] != null;
  });
}