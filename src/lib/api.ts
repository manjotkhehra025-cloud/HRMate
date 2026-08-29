import { NextResponse } from "next/server";
import { getSessionUser } from "./auth";
import { istParts } from "./utils";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function unauthorized(message = "Not authenticated") {
  return error(message, 401);
}

export function requireUser() {
  return getSessionUser();
}

export function dateKey(d = new Date()): string {
  return istParts(d).dateKey;
}
