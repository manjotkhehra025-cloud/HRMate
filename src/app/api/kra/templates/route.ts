import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const department = searchParams.get("department");

    let query = `SELECT * FROM kra_templates WHERE 1=1`;
    const params: any[] = [];

    if (department && department !== "all") {
      query += ` AND department = ?`;
      params.push(department);
    }

    query += ` ORDER BY department ASC, weightage DESC`;

    const templates = db.prepare(query).all(...params) as any[];

    return NextResponse.json({ ok: true, templates });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
