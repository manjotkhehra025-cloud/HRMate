import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { notifyUser } from "@/lib/notify";

// Helper to find tailored KRA templates based on designation & department
function getMatchingTemplates(department: string, designation?: string) {
  const dept = department || "Production";
  const desig = (designation || "").trim().toLowerCase();

  // 1. Universal Attendance KRA for Official Staff
  const universalAtt = db.prepare(`SELECT * FROM kra_templates WHERE id = 'kt_official_att'`).get() as any;

  // 2. Try finding templates matching department and designation
  let roleTemplates: any[] = [];
  if (desig) {
    roleTemplates = db
      .prepare(
        `SELECT * FROM kra_templates 
         WHERE department = ? AND LOWER(designation) LIKE ?
         ORDER BY weightage DESC LIMIT 3`
      )
      .all(dept, `%${desig}%`) as any[];
  }

  if (roleTemplates.length === 0) {
    roleTemplates = db
      .prepare(
        `SELECT * FROM kra_templates 
         WHERE department = ?
         ORDER BY weightage DESC LIMIT 3`
      )
      .all(dept) as any[];
  }

  const result = universalAtt ? [universalAtt, ...roleTemplates.slice(0, 3)] : roleTemplates;
  return result;
}

// Calculate Auto Attendance Score (1 to 5 Stars) from live punch-in records
function calculateAttendanceScore(userId: string) {
  try {
    const records = db
      .prepare(
        `SELECT COUNT(*) as total_punches,
                SUM(CASE WHEN punch_in_geofence = 1 THEN 1 ELSE 0 END) as verified_punches
         FROM attendance 
         WHERE user_id = ?`
      )
      .get(userId) as any;

    const total = records?.total_punches || 0;
    if (total === 0) return { attendancePct: 100, score: 5.0, count: 0 };

    const verified = records?.verified_punches || 0;
    const pct = Math.round((verified / total) * 100);

    let score = 5.0;
    if (pct < 75) score = 3.0;
    else if (pct < 85) score = 3.5;
    else if (pct < 90) score = 4.0;
    else if (pct < 95) score = 4.5;
    else score = 5.0;

    return { attendancePct: pct, score, count: total };
  } catch {
    return { attendancePct: 100, score: 5.0, count: 0 };
  }
}

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId") || user.id;
    const period = searchParams.get("period") || "2026-Q1";
    const isSuperAdmin = user.role === "super_admin";
    const isAdmin = isSuperAdmin || user.role === "admin";

    const targetUser = db.prepare(`SELECT * FROM users WHERE id = ?`).get(targetUserId) as any;
    if (!targetUser) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    const isYellowCard = targetUser.staff_type === "yellow_card";

    // 1. Fetch KRAs assigned to target user
    let userKras = db
      .prepare(
        `SELECT uk.*, u.name as user_name, u.department as user_dept, u.designation as user_desig, u.color as user_color
         FROM user_kras uk
         JOIN users u ON uk.user_id = u.id
         WHERE uk.user_id = ? AND uk.period = ?
         ORDER BY uk.created_at ASC`
      )
      .all(targetUserId, period) as any[];

    // Auto-populate tailored KRAs for Official Staff ONLY (if none exist yet)
    if (userKras.length === 0 && !isYellowCard) {
      const templates = getMatchingTemplates(targetUser.department, targetUser.designation);

      if (templates.length > 0) {
        const now = Date.now();
        const attCalc = calculateAttendanceScore(targetUserId);

        const insertKra = db.prepare(
          `INSERT OR IGNORE INTO user_kras 
           (id, user_id, assigned_by, period, title, description, weightage, target_metric, self_score, self_remarks, manager_score, manager_remarks, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );

        for (const t of templates) {
          const newId = randomId("kra_");
          const isAtt = t.id === "kt_official_att" || t.title.toLowerCase().includes("attendance");
          insertKra.run(
            newId,
            targetUserId,
            user.id,
            period,
            t.title,
            t.description,
            t.weightage,
            t.target_metric,
            isAtt ? attCalc.score : null,
            isAtt ? `Auto-Synced: ${attCalc.attendancePct}% biometric on-time rate (${attCalc.count} shifts)` : "",
            isAtt ? attCalc.score : null,
            isAtt ? `Auto-verified via factory biometric GPS logs` : "",
            isAtt ? "approved" : "draft",
            now,
            now
          );
        }

        userKras = db
          .prepare(
            `SELECT uk.*, u.name as user_name, u.department as user_dept, u.designation as user_desig, u.color as user_color
             FROM user_kras uk
             JOIN users u ON uk.user_id = u.id
             WHERE uk.user_id = ? AND uk.period = ?
             ORDER BY uk.created_at ASC`
          )
          .all(targetUserId, period) as any[];
      }
    }

    // 2. If Admin, list all Official Staff members (excluding Yellow Card workers)
    let staffOverview: any[] = [];
    if (isAdmin) {
      staffOverview = db
        .prepare(
          `SELECT u.id, u.name, u.email, u.department, u.designation, u.color, u.avatar, u.staff_type,
                  COUNT(uk.id) as total_kras,
                  SUM(CASE WHEN uk.status = 'approved' THEN 1 ELSE 0 END) as approved_kras,
                  SUM(CASE WHEN uk.status = 'submitted' THEN 1 ELSE 0 END) as submitted_kras,
                  AVG(uk.self_score) as avg_self_score,
                  AVG(uk.manager_score) as avg_manager_score
           FROM users u
           LEFT JOIN user_kras uk ON u.id = uk.user_id AND uk.period = ?
           WHERE u.active = 1 AND u.staff_type = 'official'
           GROUP BY u.id
           ORDER BY u.name ASC`
        )
        .all(period) as any[];
    }

    const attScore = calculateAttendanceScore(targetUserId);

    return NextResponse.json({
      ok: true,
      kras: userKras,
      staffOverview,
      currentPeriod: period,
      isSuperAdmin,
      isAdmin,
      isYellowCard,
      targetUser: {
        id: targetUser.id,
        name: targetUser.name,
        department: targetUser.department,
        designation: targetUser.designation,
        staffType: targetUser.staff_type,
      },
      liveAttendanceStats: attScore,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== "super_admin" && user.role !== "admin")) {
      return NextResponse.json({ ok: false, error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const body = await req.json();
    const { action, userIds, department, period, title, description, weightage, target_metric } = body;
    const kraPeriod = period || "2026-Q1";
    const now = Date.now();

    // 1. Bulk Auto-Generate Action for Official Staff ONLY
    if (action === "bulk_auto_generate") {
      let targetUsers: any[] = [];
      if (department && department !== "all") {
        targetUsers = db
          .prepare(`SELECT * FROM users WHERE active = 1 AND staff_type = 'official' AND department = ?`)
          .all(department) as any[];
      } else {
        targetUsers = db
          .prepare(`SELECT * FROM users WHERE active = 1 AND staff_type = 'official'`)
          .all() as any[];
      }

      const insertKra = db.prepare(
        `INSERT INTO user_kras 
         (id, user_id, assigned_by, period, title, description, weightage, target_metric, self_score, self_remarks, manager_score, manager_remarks, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      let createdCount = 0;
      for (const u of targetUsers) {
        const templates = getMatchingTemplates(u.department, u.designation);
        const attCalc = calculateAttendanceScore(u.id);

        for (const t of templates) {
          const newId = randomId("kra_");
          const isAtt = t.id === "kt_official_att" || t.title.toLowerCase().includes("attendance");

          insertKra.run(
            newId,
            u.id,
            user.id,
            kraPeriod,
            t.title,
            t.description,
            t.weightage,
            t.target_metric,
            isAtt ? attCalc.score : null,
            isAtt ? `Auto-Synced: ${attCalc.attendancePct}% biometric on-time rate (${attCalc.count} shifts)` : "",
            isAtt ? attCalc.score : null,
            isAtt ? `Auto-verified via factory biometric GPS logs` : "",
            isAtt ? "approved" : "draft",
            now,
            now
          );
          createdCount++;
        }

        notifyUser(
          u.id,
          "🎯 Official Staff KRAs Assigned (" + kraPeriod + ")",
          `Your Key Result Areas have been set up based on your role (${u.designation || u.department}) with live attendance scoring. Please review and fill your self-assessment.`,
          { type: "kra", link: "/kra" }
        );
      }

      return NextResponse.json({ ok: true, count: createdCount, usersCount: targetUsers.length });
    }

    // 2. Custom KRA Assignment by Super Admin (Official Staff)
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0 || !title || !target_metric) {
      return NextResponse.json({ ok: false, error: "Missing required KRA parameters" }, { status: 400 });
    }

    const insertKra = db.prepare(
      `INSERT INTO user_kras 
       (id, user_id, assigned_by, period, title, description, weightage, target_metric, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`
    );

    for (const uid of userIds) {
      // Check if user is official staff
      const target = db.prepare(`SELECT staff_type, name FROM users WHERE id = ?`).get(uid) as any;
      if (target?.staff_type === "yellow_card") {
        continue; // Skip yellow card staff
      }

      const id = randomId("kra_");
      insertKra.run(
        id,
        uid,
        user.id,
        kraPeriod,
        title,
        description || "",
        weightage || 25,
        target_metric,
        now,
        now
      );

      notifyUser(
        uid,
        "🎯 New KRA Assigned: " + title,
        `A new Key Result Area (${title}) was assigned by HR Admin for period ${kraPeriod}.`,
        { type: "kra", link: "/kra" }
      );
    }

    return NextResponse.json({ ok: true, count: userIds.length });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, action, self_score, self_remarks, manager_score, manager_remarks } = body;

    const kra = db.prepare(`SELECT * FROM user_kras WHERE id = ?`).get(id) as any;
    if (!kra) {
      return NextResponse.json({ ok: false, error: "KRA not found" }, { status: 404 });
    }

    const isSuperAdmin = user.role === "super_admin";
    const isAdmin = isSuperAdmin || user.role === "admin";
    const now = Date.now();

    if (action === "self_assess") {
      if (kra.user_id !== user.id && !isAdmin) {
        return NextResponse.json({ ok: false, error: "Can only self-assess your own KRAs" }, { status: 403 });
      }

      db.prepare(
        `UPDATE user_kras 
         SET self_score = ?, self_remarks = ?, status = 'submitted', updated_at = ?
         WHERE id = ?`
      ).run(self_score, self_remarks || "", now, id);

      return NextResponse.json({ ok: true, message: "Self assessment submitted successfully" });
    }

    if (action === "manager_review") {
      if (!isAdmin) {
        return NextResponse.json({ ok: false, error: "Only admins/managers can review KRAs" }, { status: 403 });
      }

      db.prepare(
        `UPDATE user_kras 
         SET manager_score = ?, manager_remarks = ?, status = 'approved', updated_at = ?
         WHERE id = ?`
      ).run(manager_score, manager_remarks || "", now, id);

      notifyUser(
        kra.user_id,
        "⭐ KRA Assessment Evaluated",
        `Your manager has reviewed and scored your KRA "${kra.title}" (${manager_score}/5.0).`,
        { type: "kra", link: "/kra" }
      );

      return NextResponse.json({ ok: true, message: "Manager assessment approved" });
    }

    return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "super_admin") {
      return NextResponse.json({ ok: false, error: "Only Super Admin can delete KRAs" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "ID is required" }, { status: 400 });
    }

    db.prepare(`DELETE FROM user_kras WHERE id = ?`).run(id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
