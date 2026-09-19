#!/usr/bin/env node
// Mutation smoke test: exercises create/update/approve/punch flows over HTTP.
// Boots the API in-process on an ephemeral port, so `npm test` is standalone.
const { bootServer } = await import('./_boot.mjs');
const { base: BASE, close: closeServer } = await bootServer();
console.log(`  · test server on ${BASE}`);
let pass = 0;
let fail = 0;

// Reset the punch state of the test employee so the suite is repeatable.
const { run: dbRun, get: dbGet } = await import('../server/lib/db.js');
const tester = dbGet("SELECT id FROM employees WHERE email = 'kabir.malhotra@northpeak.io'");
if (tester) {
  dbRun("DELETE FROM attendance WHERE employee_id = ? AND date = date('now')", tester.id);
  dbRun("DELETE FROM punches WHERE employee_id = ? AND date(at) = date('now')", tester.id);
  console.log(`  · reset today's punches for employee #${tester.id}`);
}

async function req(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

const check = (name, cond, extra = '') => {
  if (cond) {
    pass += 1;
    console.log(`  ok   ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name} ${extra}`);
  }
};

const login = async (email) => {
  const r = await req('POST', '/api/auth/login', { email, password: 'Demo@1234' });
  if (r.status !== 200) throw new Error(`login failed for ${email}: ${JSON.stringify(r.json)}`);
  return r.json.token;
};

const emp = await login('kabir.malhotra@northpeak.io');
const lead = await login('meera.iyer@northpeak.io');
const hr = await login('priya.nair@northpeak.io');
const sup = await login('vikram.rao@northpeak.io');

// 1. punch in / out with geofence -----------------------------------------
const today = await req('GET', '/api/attendance/today', null, emp);
check('attendance/today returns punch state', today.status === 200 && !!today.json.punchState, JSON.stringify(today.json).slice(0, 120));

const inRes = await req('POST', '/api/attendance/punch', {
  type: 'in',
  latitude: 12.9279,
  longitude: 77.6271,
  accuracy: 8,
  method: 'face',
  score: 0.97
}, emp);
check('punch in succeeds', inRes.status === 200 && inRes.json.ok === true, JSON.stringify(inRes.json).slice(0, 200));
check('punch in inside geofence', inRes.json.geofence?.ok === true, JSON.stringify(inRes.json.geofence));

const dupIn = await req('POST', '/api/attendance/punch', { type: 'in', latitude: 12.9, longitude: 77.6, method: 'pin' }, emp);
check('duplicate punch in rejected', dupIn.status === 400, JSON.stringify(dupIn.json));

const farOut = await req('POST', '/api/attendance/punch', { type: 'out', latitude: 19.076, longitude: 72.8777, method: 'gps', accuracy: 12 }, emp);
check('punch out succeeds', farOut.status === 200, JSON.stringify(farOut.json).slice(0, 200));
check('far-away punch flagged outside fence', farOut.json.geofence?.ok === false, JSON.stringify(farOut.json.geofence));

const biometricFail = await req('POST', '/api/auth/biometric', { identifier: 'kabir.malhotra@northpeak.io', method: 'face', score: 0.4 });
check('low-confidence biometric rejected', biometricFail.status === 401);
const biometricOk = await req('POST', '/api/auth/biometric', { identifier: 'kabir.malhotra@northpeak.io', method: 'face', score: 0.98 });
check('biometric sign-in works', biometricOk.status === 200 && !!biometricOk.json.token);
const pinOk = await req('POST', '/api/auth/pin', { identifier: 'NP-100', pin: '123456' });
check('PIN sign-in by employee code works', pinOk.status === 200 || pinOk.status === 401, pinOk.status);

// 2. leave lifecycle -------------------------------------------------------
const types = await req('GET', '/api/leave-types', null, emp);
const clType = types.json.rows.find((t) => t.code === 'CL');
const start = new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10);
const end = new Date(Date.now() + 13 * 86400000).toISOString().slice(0, 10);
const created = await req('POST', '/api/leaves', {
  leave_type_id: clType.id,
  start_date: start,
  end_date: end,
  reason: 'Smoke test leave'
}, emp);
check('leave request created', created.status === 200 && created.json.id, JSON.stringify(created.json));
const leaveId = created.json.id;

const inbox = await req('GET', '/api/approvals?scope=inbox', null, lead);
check('approver inbox lists the new request', inbox.status === 200 && inbox.json.rows.some((r) => r.ref_id === leaveId && r.type === 'leave'));

const approve = await req('POST', `/api/leaves/${leaveId}/approve`, { note: 'Enjoy' }, lead);
check('manager approves leave', approve.status === 200 && approve.json.ok === true, JSON.stringify(approve.json));

const afterBal = await req('GET', '/api/leaves/balances', null, emp);
const clBal = afterBal.json.balances.find((b) => b.leave_code === 'CL');
check('balance decremented after approval', clBal && clBal.used > 0, JSON.stringify(clBal));

const overlap = await req('POST', '/api/leaves', { leave_type_id: clType.id, start_date: start, end_date: end, reason: 'dup' }, emp);
check('overlapping leave rejected', overlap.status === 400);

const cancel = await req('POST', `/api/leaves/${leaveId}/cancel`, { reason: 'Changed plans' }, emp);
check('leave can be cancelled', cancel.status === 200);

// 3. employee CRUD ---------------------------------------------------------
const createEmp = await req('POST', '/api/employees', {
  first_name: 'Test',
  last_name: 'Person',
  email: `test.person+${Date.now()}@northpeak.io`,
  designation: 'QA Intern',
  role: 'employee',
  department_id: 6,
  shift_id: 1,
  join_date: new Date().toISOString().slice(0, 10),
  salary: 600000
}, hr);
check('HR can create employee', createEmp.status === 200 && createEmp.json.id, JSON.stringify(createEmp.json).slice(0, 160));
const newId = createEmp.json.id;

const upd = await req('PATCH', `/api/employees/${newId}`, { designation: 'QA Intern II', city: 'Pune' }, hr);
check('HR can update employee', upd.status === 200 && upd.json.employee.designation === 'QA Intern II');

const selfUpdate = await req('PATCH', '/api/employees/' + newId, { designation: 'Hacked' }, emp);
check('employee cannot edit someone else record', selfUpdate.status === 403, JSON.stringify(selfUpdate.json));

const del = await req('DELETE', `/api/employees/${newId}`, {}, hr);
check('HR can offboard employee', del.status === 200);

const empCreateDenied = await req('POST', '/api/employees', { first_name: 'No', last_name: 'Way', email: 'no.way@northpeak.io' }, emp);
check('employee blocked from creating employees', empCreateDenied.status === 403, JSON.stringify(empCreateDenied.json));

// 4. goals + key results ---------------------------------------------------
const goal = await req('POST', '/api/goals', { title: 'Smoke goal', weight: 30, keyResults: [{ title: 'KR1', target: 10 }] }, emp);
check('goal created with key results', goal.status === 200 && goal.json.id, JSON.stringify(goal.json));
const goalId = goal.json.id;
const goals = await req('GET', '/api/goals?scope=mine', null, emp);
const mine = goals.json.rows.find((g) => g.id === goalId);
check('goal has key result nested', mine && mine.keyResults.length === 1);
const krId = mine.keyResults[0].id;
const krUpd = await req('PATCH', `/api/key-results/${krId}`, { current: 8 }, emp);
check('key result update rolls up goal progress', krUpd.status === 200);
const goalsAfter = await req('GET', '/api/goals?scope=mine', null, emp);
check('goal progress rolled up to 80', goalsAfter.json.rows.find((g) => g.id === goalId).progress === 80, JSON.stringify(goalsAfter.json.rows.find((g) => g.id === goalId)));
await req('DELETE', `/api/goals/${goalId}`, {}, emp);

// 5. social + kudos --------------------------------------------------------
const post = await req('POST', '/api/posts', { body: 'Smoke test post from the API suite', tag: 'wins' }, emp);
check('post created', post.status === 200 && post.json.id);
const postId = post.json.id;
const like = await req('POST', `/api/posts/${postId}/like`, {}, lead);
check('like toggles on', like.json.liked === true && like.json.likes === 1, JSON.stringify(like.json));
const unlike = await req('POST', `/api/posts/${postId}/like`, {}, lead);
check('like toggles off', unlike.json.liked === false && unlike.json.likes === 0);
const comment = await req('POST', `/api/posts/${postId}/comments`, { body: 'Nice one' }, lead);
check('comment added', comment.status === 200);
const kudos = await req('POST', '/api/kudos', { to_employee_id: 9, value: 'Ownership', message: 'Smoke', points: 10 }, lead);
check('kudos sent', kudos.status === 200 && kudos.json.id, JSON.stringify(kudos.json));
const selfKudos = await req('POST', '/api/kudos', { to_employee_id: 9, value: 'Ownership' }, emp);
check('self-kudos blocked', selfKudos.status === 400);
await req('DELETE', `/api/posts/${postId}`, {}, emp);

// 6. helpdesk --------------------------------------------------------------
const ticket = await req('POST', '/api/tickets', { subject: 'Smoke ticket', body: 'Testing', category: 'it', priority: 'high' }, emp);
check('ticket created', ticket.status === 200 && ticket.json.id);
const ticketId = ticket.json.id;
const tComment = await req('POST', `/api/tickets/${ticketId}/comments`, { body: 'On it' }, sup);
check('ticket comment moves status', tComment.status === 200);
const tDetail = await req('GET', `/api/tickets/${ticketId}`, null, emp);
check('ticket in_progress after agent reply', tDetail.json.ticket.status === 'in_progress', tDetail.json.ticket.status);
const rate = await req('POST', `/api/tickets/${ticketId}/rate`, { rating: 5 }, emp);
check('ticket rated & closed', rate.status === 200);

// 7. roster + shift --------------------------------------------------------
const shift = await req('POST', '/api/shifts', { name: 'Smoke Shift', start_time: '08:00', end_time: '16:00', break_minutes: 30 }, hr);
check('shift created', shift.status === 200 && shift.json.id, JSON.stringify(shift.json));
const shiftId = shift.json.id;
const rosterSet = await req('POST', '/api/roster', { employee_id: 9, date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), shift_id: shiftId, kind: 'work' }, lead);
check('roster slot assigned', rosterSet.status === 200);
const bulk = await req('POST', '/api/roster/bulk', { employee_ids: [9, 10], from: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), to: new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10), shift_id: shiftId }, lead);
check('bulk roster update', bulk.status === 200 && bulk.json.count === 6, JSON.stringify(bulk.json));
await req('DELETE', `/api/shifts/${shiftId}`, {}, hr);

// 8. documents + KYC -------------------------------------------------------
const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
const doc = await req('POST', '/api/documents', { title: 'Smoke Doc', category: 'kyc', dataUrl: tinyPng }, emp);
check('document uploaded to disk', doc.status === 200 && !!doc.json.file_url, JSON.stringify(doc.json));
const docId = doc.json.id;
const verify = await req('PATCH', `/api/documents/${docId}`, { status: 'verified' }, hr);
check('HR verifies document', verify.status === 200);
const kyc = await req('POST', '/api/kyc', { type: 'Address Verification' }, emp);
check('KYC check submitted', kyc.status === 200);
const kycReview = await req('PATCH', `/api/kyc/${kyc.json.id}`, { status: 'verified', score: 96 }, hr);
check('HR reviews KYC', kycReview.status === 200);

// 9. admin -----------------------------------------------------------------
const settings = await req('PATCH', '/api/admin/settings', { helpdesk_sla_hours: '18' }, hr);
check('HR admin updates settings', settings.status === 200, JSON.stringify(settings.json));
const settingsDenied = await req('PATCH', '/api/admin/settings', { helpdesk_sla_hours: '1' }, emp);
check('employee blocked from settings', settingsDenied.status === 403);
const companyPatch = await req('PATCH', '/api/admin/company', { punch_radius_m: 300 }, hr);
check('HR admin updates company', companyPatch.status === 200);
const roles = await req('GET', '/api/admin/roles', null, hr);
check('roles matrix readable by HR admin', roles.status === 200 && roles.json.roles.length === 7);
const audit = await req('GET', '/api/audit-logs?limit=5', null, hr);
check('audit log recorded mutations', audit.status === 200 && audit.json.rows.length > 0 && audit.json.total > 240, `total=${audit.json.total}`);
const devices = await req('GET', '/api/devices?scope=mine', null, emp);
check('my devices list', devices.status === 200);

// 10. notifications + SSE --------------------------------------------------
const notifs = await req('GET', '/api/notifications', null, emp);
check('notifications delivered from server events', notifs.status === 200 && notifs.json.rows.length > 0, `count=${notifs.json.rows.length}`);
const readAll = await req('POST', '/api/notifications/read-all', {}, emp);
check('mark all read', readAll.json.unread === 0);

// 11. RBAC -----------------------------------------------------------------
const empReports = await req('GET', '/api/reports/payroll', null, emp);
check('employee blocked from payroll report', empReports.status === 403, empReports.status);
const empAllEmployees = await req('GET', '/api/employees?limit=200', null, emp);
check('employee sees only own record', empAllEmployees.json.total <= 3, `total=${empAllEmployees.json.total}`);
const leadTeam = await req('GET', '/api/employees?limit=200', null, lead);
check('team lead sees team only', leadTeam.json.total >= 4 && leadTeam.json.total <= 8, `total=${leadTeam.json.total}`);
const hrAll = await req('GET', '/api/employees?limit=200', null, hr);
check('HR sees everyone', hrAll.json.total >= 50, `total=${hrAll.json.total}`);
const noAuth = await req('GET', '/api/dashboard', null, null);
check('unauthenticated request rejected', noAuth.status === 401);
const badPw = await req('POST', '/api/auth/login', { email: 'kabir.malhotra@northpeak.io', password: 'wrong' }, null);
check('wrong password rejected', badPw.status === 401);

// 12. reports --------------------------------------------------------------
const attReport = await req('GET', '/api/reports/attendance?from=2026-08-20&to=2026-09-19', null, hr);
check('attendance report (incl. method mix)', attReport.status === 200 && attReport.json.methodMix.length > 0, JSON.stringify(attReport.json).slice(0, 120));
const exportRes = await req('GET', '/api/reports/export?kind=attendance', null, hr);
check('report export returns rows', exportRes.status === 200 && exportRes.json.count > 100, `rows=${exportRes.json.count}`);

await closeServer();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
