import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { randomId } from "@/lib/crypto";
import { notifyUser } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = user.role === "super_admin" || user.role === "admin";

    let query = `
      SELECT sw.*,
             req.name as requester_name, req.department as requester_dept,
             tar.name as target_name, tar.department as target_dept,
             s1.name as req_shift_name, s2.name as target_shift_name
      FROM shift_swap_requests sw
      JOIN users req ON sw.requester_id = req.id
      JOIN users tar ON sw.target_user_id = tar.id
      JOIN shifts s1 ON sw.requester_shift_id = s1.id
      JOIN shifts s2 ON sw.target_shift_id = s2.id
    `;

    const params: any[] = [];
    if (!isAdmin) {
      query += ` WHERE sw.requester_id = ? OR sw.target_user_id = ?`;
      params.push(user.id, user.id);
    }
    query += ` ORDER BY sw.created_at DESC`;

    const swaps = db.prepare(query).all(...params) as any[];

    return NextResponse.json({ ok: true, swaps });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { targetUserId, requesterDate, requesterShiftId, targetDate, targetShiftId, reason } = body;

    if (!targetUserId || !requesterDate || !requesterShiftId || !targetDate || !targetShiftId || !reason) {
      return NextResponse.json({ ok: false, error: "All fields are required" }, { status: 400 });
    }

    const id = randomId("swp_");
    const now = Date.now();

    db.prepare(
      `INSERT INTO shift_swap_requests 
       (id, requester_id, target_user_id, requester_date, requester_shift_id, target_date, target_shift_id, reason, peer_status, manager_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?)`
    ).run(
      id,
      user.id,
      targetUserId,
      requesterDate,
      requesterShiftId,
      targetDate,
      targetShiftId,
      reason.trim(),
      now
    );

    // Notify peer coworker
    notifyUser(
      targetUserId,
      "🔄 Shift Swap Request",
      `${user.name} wants to swap shift with you for ${requesterDate}. Tap to review and accept.`,
      { type: "swap", link: "/roster" }
    );

    return NextResponse.json({ ok: true, id });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, action } = body; // action: 'peer_accept' | 'peer_decline' | 'manager_approve' | 'manager_reject'

    const swap = db.prepare(`SELECT * FROM shift_swap_requests WHERE id = ?`).get(id) as any;
    if (!swap) return NextResponse.json({ ok: false, error: "Swap request not found" }, { status: 404 });

    const isAdmin = user.role === "super_admin" || user.role === "admin";
    const now = Date.now();

    if (action === "peer_accept" && swap.target_user_id === user.id) {
      db.prepare(`UPDATE shift_swap_requests SET peer_status = 'accepted' WHERE id = ?`).run(id);
      return NextResponse.json({ ok: true, peer_status: "accepted" });
    }

    if (action === "peer_decline" && swap.target_user_id === user.id) {
      db.prepare(`UPDATE shift_swap_requests SET peer_status = 'declined' WHERE id = ?`).run(id);
      return NextResponse.json({ ok: true, peer_status: "declined" });
    }

    if ((action === "manager_approve" || action === "manager_reject") && isAdmin) {
      const status = action === "manager_approve" ? "approved" : "rejected";
      db.prepare(
        `UPDATE shift_swap_requests 
         SET manager_status = ?, reviewed_by = ?, reviewed_at = ?
         WHERE id = ?`
      ).run(status, user.id, now, id);

      // If approved, update shift_rosters table for both users
      if (status === "approved") {
        const upsertRoster = db.prepare(
          `INSERT INTO shift_rosters (id, user_id, shift_id, date, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, date) DO UPDATE SET shift_id = excluded.shift_id`
        );
        upsertRoster.run(randomId("rst_"), swap.requester_id, swap.target_shift_id, swap.target_date, user.id, now);
        upsertRoster.run(randomId("rst_"), swap.target_user_id, swap.requester_shift_id, swap.requester_date, user.id, now);
      }

      notifyUser(
        swap.requester_id,
        `Shift Swap ${status.toUpperCase()}`,
        `Your shift swap request for ${swap.requester_date} was ${status}.`,
        { type: "swap", link: "/roster" }
      );

      return NextResponse.json({ ok: true, manager_status: status });
    }

    return NextResponse.json({ ok: false, error: "Invalid action or permission" }, { status: 403 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
