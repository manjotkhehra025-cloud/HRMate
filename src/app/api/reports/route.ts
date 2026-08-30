import { NextRequest } from "next/server";
import { requireUser, unauthorized, error, json } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { monthReport } from "@/lib/reports";
import { istParts } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireUser();
  if (!user) return unauthorized();
  if (!hasPermission(user.id, "reports.view")) {
    return error("You don't have permission to view reports", 403);
  }
  const month = new URL(req.url).searchParams.get("month") || istParts().monthKey;
  return json(monthReport(month));
}
