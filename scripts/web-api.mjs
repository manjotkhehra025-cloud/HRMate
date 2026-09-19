#!/usr/bin/env node
// Web-facing API contract suite: asserts the exact endpoints, query params and
// response shapes every page in web/src/pages consumes. Boots its own server.
import { bootServer, call, harness, login } from './_boot.mjs';

const { base: BASE, close: closeServer } = await bootServer();
console.log(`  · test server on ${BASE}`);
const { check: assert, summary } = harness();

const hr = await login(BASE, 'priya.nair@northpeak.io');
const emp = await login(BASE, 'kabir.malhotra@northpeak.io');
const lead = await login(BASE, 'meera.iyer@northpeak.io');

// ---- Documents page -------------------------------------------------------
let r = await call(BASE, hr.token, 'GET', '/api/documents?scope=mine');
assert(r.status === 200 && Array.isArray(r.j.rows) && r.j.totals, 'Documents: scope=mine rows+totals', `${r.j.rows?.length} rows`);
r = await call(BASE, hr.token, 'GET', '/api/documents?scope=all&category=kyc&status=pending&search=a');
assert(r.status === 200 && Array.isArray(r.j.rows), 'Documents: scope=all + category/status/search filter', `${r.j.rows?.length} rows`);
r = await call(BASE, emp.token, 'POST', '/api/documents', { title: 'Smoke test PAN card', category: 'kyc', doc_type: 'pdf', file_name: 'pan.pdf' });
const docId = r.j?.id;
assert(r.status === 200 && docId, 'Documents: upload creates row', `id=${docId}`);
r = await call(BASE, hr.token, 'PATCH', `/api/documents/${docId}`, { status: 'verified', verification_note: 'matches HR record' });
assert(r.status === 200 && r.j.ok, 'Documents: HR verifies document');
r = await call(BASE, hr.token, 'GET', '/api/documents?scope=all&status=verified&search=Smoke%20test');
assert(r.status === 200 && r.j.rows.some((d) => d.id === docId && d.status === 'verified' && d.verification_note), 'Documents: verified + note persisted');
r = await call(BASE, hr.token, 'DELETE', `/api/documents/${docId}`, {});
assert(r.status === 200 && r.j.ok, 'Documents: delete');

// ---- KYC page -------------------------------------------------------------
r = await call(BASE, emp.token, 'GET', '/api/kyc?scope=mine');
assert(r.status === 200 && Array.isArray(r.j.rows) && 'coverage' in r.j.totals, 'KYC: scope=mine rows+coverage', () => `status=${r.status} ${JSON.stringify(r.j).slice(0,200)}`);
r = await call(BASE, hr.token, 'GET', '/api/kyc?scope=all');
assert(r.status === 200 && r.j.rows.every((k) => k.full_name !== undefined), 'KYC: scope=all rows carry full_name', `${r.j.rows.length} rows`);
r = await call(BASE, emp.token, 'POST', '/api/kyc', { type: 'Smoke Aadhaar Verification', note: 'smoke' });
const kycId = r.j?.id;
assert(r.status === 200 && kycId, 'KYC: submit check', `id=${kycId}`);
r = await call(BASE, hr.token, 'PATCH', `/api/kyc/${kycId}`, { status: 'verified', score: 96, note: 'verified by HR' });
assert(r.status === 200 && r.j.ok, 'KYC: HR review');
r = await call(BASE, emp.token, 'GET', '/api/kyc?scope=mine');
assert(r.j.rows.some((k) => k.id === kycId && k.status === 'verified' && k.score === 96), 'KYC: reviewed state visible to employee');
r = await call(BASE, emp.token, 'PATCH', `/api/kyc/${kycId}`, { status: 'flagged' });
assert(r.status === 403, 'KYC: employee cannot review (403)', `status=${r.status}`);

// ---- Id card page ---------------------------------------------------------
r = await call(BASE, emp.token, 'GET', `/api/employees/${emp.me.id}`);
const e = r.j?.employee;
assert(r.status === 200 && e.emp_code && e.designation && e.role_label && e.full_name, 'IdCard: employee payload has card fields', () => `status=${r.status} ${e?.emp_code}/${e?.designation}`);
r = await call(BASE, hr.token, 'GET', '/api/directory?search=aar');
assert(r.status === 200 && r.j.people[0]?.designation !== undefined && r.j.people[0]?.emp_code, 'IdCard: HR directory search returns designation', () => `${r.j.people.length} hits, first=${r.j.people[0]?.full_name}`);
r = await call(BASE, emp.token, 'GET', '/api/directory');
const scoped = r.j.people;
assert(r.status === 200 && scoped.length > 40, 'IdCard: employee sees the company contact directory', () => `${scoped.length} people visible`);
assert(scoped[0] && scoped[0].salary === undefined && scoped[0].date_of_birth === undefined && scoped[0].bank_account === undefined, 'IdCard: directory cards expose no sensitive fields');
r = await call(BASE, emp.token, 'GET', '/api/directory?search=aar');
assert(r.status === 200 && r.j.people.length > 0, 'IdCard: employee can search the whole directory', () => `${r.j.people.length} hits`);
r = await call(BASE, lead.token, 'GET', '/api/employees');
assert(r.status === 200 && r.j.rows.length < scoped.length, 'IdCard: HR employee list stays scope-limited', () => `team lead sees ${r.j.rows.length} of ${scoped.length}`);

// ---- Social wall ----------------------------------------------------------
r = await call(BASE, lead.token, 'GET', '/api/posts?limit=30');
const p0 = r.j.rows[0];
assert(r.status === 200 && 'total' in r.j && Array.isArray(r.j.tags) && p0 && p0.body !== undefined && p0.author && Array.isArray(p0.comments) && typeof p0.liked === 'boolean', 'Social: posts payload shape', `${r.j.rows.length} posts, ${r.j.tags.length} tags`);
r = await call(BASE, lead.token, 'POST', '/api/posts', { body: 'Smoke test wall post 🎉', tag: 'win', image_url: null });
const postId = r.j?.id;
assert(r.status === 200 && postId, 'Social: create post', `id=${postId}`);
r = await call(BASE, hr.token, 'POST', `/api/posts/${postId}/like`, {});
assert(r.status === 200 && r.j.liked === true && r.j.likes === 1, 'Social: like toggles on', `likes=${r.j.likes}`);
r = await call(BASE, hr.token, 'POST', `/api/posts/${postId}/like`, {});
assert(r.status === 200 && r.j.liked === false && r.j.likes === 0, 'Social: like toggles off');
r = await call(BASE, hr.token, 'POST', `/api/posts/${postId}/comments`, { body: 'Nice work!' });
assert(r.status === 200 && r.j.id, 'Social: comment added', `id=${r.j.id}`);
r = await call(BASE, lead.token, 'GET', `/api/posts?limit=30&tag=win`);
const created = r.j.rows.find((x) => x.id === postId);
assert(r.status === 200 && created && created.comments_count === 1 && created.comments[0].body === 'Nice work!', 'Social: tag filter + comment count');
r = await call(BASE, lead.token, 'DELETE', `/api/posts/${postId}`, {});
assert(r.status === 200 && r.j.ok, 'Social: author deletes own post');
r = await call(BASE, emp.token, 'POST', '/api/posts', { body: 'Employee wall post (base role has post.create)' });
const empPost = r.j?.id;
assert(r.status === 200 && empPost, 'Social: employee can post (base role grant)', () => `status=${r.status} id=${empPost}`);
r = await call(BASE, emp.token, 'DELETE', `/api/posts/${empPost}`, {});
assert(r.status === 200 && r.j.ok, 'Social: employee deletes own post');
r = await call(BASE, hr.token, 'POST', `/api/posts/${empPost}/comments`, { body: 'orphan' });
assert(r.status === 404, 'Social: comment on missing post is 404', () => `status=${r.status}`);

// ---- Star workers ---------------------------------------------------------
r = await call(BASE, hr.token, 'GET', '/api/star-workers?period=30');
assert(r.status === 200 && Array.isArray(r.j.leaderboard) && Array.isArray(r.j.badges) && Array.isArray(r.j.departments) && 'myRank' in r.j, 'StarWorkers: payload shape', `${r.j.leaderboard.length} ranked, myRank=${JSON.stringify(r.j.myRank)}`);
r = await call(BASE, hr.token, 'GET', '/api/star-workers?period=365');
assert(r.status === 200 && r.j.leaderboard[0]?.full_name && r.j.leaderboard[0]?.rank === 1, 'StarWorkers: leaderboard ranked', `top=${r.j.leaderboard[0]?.full_name} ${r.j.leaderboard[0]?.points}pts`);
r = await call(BASE, lead.token, 'POST', '/api/kudos', { to_employee_id: emp.me.id, value: 'Teamwork', message: 'Smoke kudos', points: 10, badge: '🏅 Team Player' });
assert(r.status === 200 && r.j.id, 'StarWorkers: kudos sent from modal payload');
r = await call(BASE, lead.token, 'POST', '/api/kudos', { to_employee_id: lead.me.id, value: 'Teamwork', message: 'self' });
assert(r.status === 400, 'StarWorkers: self-kudos rejected (400)', `status=${r.status}`);

// ---- Notifications page ---------------------------------------------------
r = await call(BASE, hr.token, 'GET', '/api/notifications?limit=120');
assert(r.status === 200 && Array.isArray(r.j.rows) && typeof r.j.unread === 'number' && r.j.rows[0].type && 'read' in r.j.rows[0], 'Notifications: payload shape', `${r.j.rows.length} rows, ${r.j.unread} unread`);
r = await call(BASE, hr.token, 'GET', '/api/notifications?limit=120&unread=1');
assert(r.status === 200 && r.j.rows.every((n) => n.read === 0), 'Notifications: unread=1 filter');
const noteId = r.j.rows[0]?.id;
r = await call(BASE, hr.token, 'POST', '/api/notifications/read', { id: noteId });
assert(r.status === 200 && typeof r.j.unread === 'number', 'Notifications: mark one read', `unread=${r.j.unread}`);
r = await call(BASE, hr.token, 'GET', '/api/notifications/settings');
assert(r.status === 200 && typeof r.j.pushEnabled === 'boolean' && Array.isArray(r.j.channels), 'Notifications: settings payload', `${r.j.channels.length} channels`);
r = await call(BASE, hr.token, 'PATCH', '/api/auth/preferences', { push_enabled: true });
assert(r.status === 200 && r.j.ok, 'Notifications: push_enabled preference saved');
r = await call(BASE, hr.token, 'GET', '/api/notifications/settings');
assert(r.j.pushEnabled === true, 'Notifications: pushEnabled reflects preference');
r = await call(BASE, hr.token, 'PATCH', '/api/auth/preferences', { push_enabled: false });
assert(r.status === 200, 'Notifications: push disabled again');
r = await call(BASE, hr.token, 'DELETE', `/api/notifications/${noteId}`, {});
assert(r.status === 200 && r.j.ok, 'Notifications: dismiss');

// ---- Goals page -----------------------------------------------------------
r = await call(BASE, emp.token, 'GET', '/api/goals?scope=mine');
assert(r.status === 200 && Array.isArray(r.j.rows) && r.j.totals && Array.isArray(r.j.rows[0]?.keyResults), 'Goals: mine payload shape', () => `${r.j.rows.length} goals, avg ${r.j.totals.avgProgress}%`);
r = await call(BASE, hr.token, 'GET', '/api/goals?scope=team&category=people&status=at_risk');
assert(r.status === 200 && r.j.rows.every((g) => g.category === 'people' && g.status === 'at_risk'), 'Goals: category+status filters', () => `${r.j.rows.length} rows`);
r = await call(BASE, emp.token, 'POST', '/api/goals', { title: 'Smoke objective', description: 'd', category: 'business', weight: 30, keyResults: [{ title: 'Smoke KR', target: 10, unit: 'count', metric: 'count' }] });
const goalId = r.j?.id;
assert(r.status === 200 && goalId, 'Goals: create with nested key results', () => `id=${goalId}`);
r = await call(BASE, emp.token, 'GET', '/api/goals?scope=mine');
const smokeGoal = r.j.rows.find((g) => g.id === goalId);
assert(smokeGoal && smokeGoal.keyResults.length === 1 && smokeGoal.progress === 0, 'Goals: key result attached');
const krId = smokeGoal.keyResults[0].id;
r = await call(BASE, emp.token, 'PATCH', `/api/key-results/${krId}`, { current: 8 });
assert(r.status === 200 && r.j.ok, 'Goals: key result progress updated');
r = await call(BASE, emp.token, 'GET', '/api/goals?scope=mine');
const rolled = r.j.rows.find((g) => g.id === goalId);
assert(rolled.progress === 80 && rolled.status === 'ahead', 'Goals: progress rolls up from key results', () => `${rolled.progress}% ${rolled.status}`);
r = await call(BASE, emp.token, 'DELETE', `/api/key-results/${krId}`, {});
assert(r.status === 200, 'Goals: key result removed');
r = await call(BASE, emp.token, 'DELETE', `/api/goals/${goalId}`, {});
assert(r.status === 200 && r.j.ok, 'Goals: goal deleted');
r = await call(BASE, emp.token, 'POST', '/api/goals', { title: 'Should be blocked', employee_id: hr.me.id });
assert(r.status === 403, 'Goals: employee cannot assign to someone else (403)', () => `status=${r.status}`);

// ---- Performance page -----------------------------------------------------
r = await call(BASE, emp.token, 'GET', '/api/reviews?scope=mine');
assert(r.status === 200 && Array.isArray(r.j.rows) && Array.isArray(r.j.distribution) && r.j.totals, 'Performance: mine payload shape', () => `${r.j.rows.length} reviews, avg ${r.j.totals.avgRating}`);
assert(r.j.rows.every((x) => Array.isArray(x.strengths) && Array.isArray(x.improvements)), 'Performance: strengths/improvements parsed to arrays');
r = await call(BASE, emp.token, 'GET', '/api/review-cycles');
assert(r.status === 200 && Array.isArray(r.j.rows) && 'avgRating' in r.j.rows[0], 'Performance: cycles payload', () => `${r.j.rows.length} cycles`);
r = await call(BASE, hr.token, 'POST', '/api/reviews', {
  employee_id: emp.me.id,
  rating: 4.5,
  potential: 4,
  productivity: 88,
  quality: 90,
  teamwork: 85,
  initiative: 80,
  reliability: 92,
  strengths: ['Ships reliably', 'Mentors juniors'],
  improvements: ['Delegation'],
  summary: 'Smoke review',
  status: 'draft'
});
const reviewId = r.j?.id;
assert(r.status === 200 && reviewId, 'Performance: create review with array fields', () => `id=${reviewId} status=${r.status} ${JSON.stringify(r.j).slice(0,120)}`);
r = await call(BASE, hr.token, 'GET', `/api/reviews?employee_id=${emp.me.id}`);
const smokeReview = r.j.rows.find((x) => x.id === reviewId);
assert(smokeReview && smokeReview.strengths.length === 2 && smokeReview.improvements[0] === 'Delegation' && smokeReview.composite === '4.5', 'Performance: arrays round-trip through the DB', () => JSON.stringify(smokeReview?.strengths));
r = await call(BASE, hr.token, 'PATCH', `/api/reviews/${reviewId}`, { status: 'published' });
assert(r.status === 200 && r.j.ok, 'Performance: publish review');
r = await call(BASE, emp.token, 'GET', '/api/reviews?scope=mine');
const published = r.j.rows.find((x) => x.id === reviewId);
assert(published && published.status === 'published' && published.ack === 0, 'Performance: published review visible to employee');
r = await call(BASE, emp.token, 'POST', `/api/reviews/${reviewId}/acknowledge`, { self_rating: 4 });
assert(r.status === 200 && r.j.ok, 'Performance: employee acknowledges');
r = await call(BASE, hr.token, 'DELETE', `/api/reviews/${reviewId}`, {});
assert(r.status === 200 && r.j.ok, 'Performance: review deleted');
r = await call(BASE, emp.token, 'POST', '/api/reviews', { employee_id: hr.me.id, rating: 5 });
assert(r.status === 403, 'Performance: employee lacks performance.manage (403)', () => `status=${r.status}`);

// ---- Helpdesk page --------------------------------------------------------
r = await call(BASE, emp.token, 'GET', '/api/tickets?scope=mine');
assert(r.status === 200 && Array.isArray(r.j.rows) && Array.isArray(r.j.categories) && r.j.totals && 'slaHours' in r.j.rows[0], 'Helpdesk: mine payload shape', () => `${r.j.rows.length} tickets, ${r.j.totals.open} open`);
r = await call(BASE, hr.token, 'GET', '/api/tickets?scope=all&status=open&priority=high&category=it');
assert(r.status === 200 && r.j.rows.every((t) => t.status === 'open' && t.priority === 'high' && t.category === 'it'), 'Helpdesk: filters on scope=all', () => `${r.j.rows.length} rows`);
r = await call(BASE, emp.token, 'POST', '/api/tickets', { subject: 'Smoke ticket', body: 'details', category: 'it', priority: 'high' });
const ticketId = r.j?.id;
assert(r.status === 200 && ticketId, 'Helpdesk: raise ticket', () => `id=${ticketId}`);
r = await call(BASE, emp.token, 'GET', `/api/tickets/${ticketId}`);
assert(r.status === 200 && r.j.ticket.requester && Array.isArray(r.j.comments), 'Helpdesk: ticket detail payload');
r = await call(BASE, hr.token, 'POST', `/api/tickets/${ticketId}/comments`, { body: 'Looking into it' });
assert(r.status === 200 && r.j.id, 'Helpdesk: reply added');
r = await call(BASE, hr.token, 'GET', `/api/tickets/${ticketId}`);
assert(r.j.ticket.status === 'in_progress' && r.j.comments.length === 1, 'Helpdesk: reply moves ticket to in_progress');
r = await call(BASE, hr.token, 'PATCH', `/api/tickets/${ticketId}`, { status: 'resolved', assignee_id: hr.me.id });
assert(r.status === 200 && r.j.ok, 'Helpdesk: resolve + assign');
r = await call(BASE, emp.token, 'POST', `/api/tickets/${ticketId}/rate`, { rating: 5 });
assert(r.status === 200 && r.j.ok, 'Helpdesk: requester rates ticket');
r = await call(BASE, emp.token, 'GET', `/api/tickets/${ticketId}`);
assert(r.j.ticket.status === 'closed' && r.j.ticket.rating === 5, 'Helpdesk: rating closes ticket');
r = await call(BASE, emp.token, 'POST', `/api/tickets/${ticketId}/rate`, { rating: 9 });
assert(r.status === 400, 'Helpdesk: rating out of range rejected (400)', () => `status=${r.status}`);
r = await call(BASE, hr.token, 'DELETE', `/api/tickets/${ticketId}`, {});
assert(r.status === 200 && r.j.ok, 'Helpdesk: ticket deleted');

// ---- Announcements page ---------------------------------------------------
r = await call(BASE, emp.token, 'GET', '/api/announcements');
assert(r.status === 200 && Array.isArray(r.j.rows) && r.j.rows[0]?.author !== undefined, 'Announcements: payload shape', () => `${r.j.rows.length} announcements`);
r = await call(BASE, emp.token, 'POST', '/api/announcements', { title: 'nope', body: 'nope' });
assert(r.status === 403, 'Announcements: employee cannot publish (403)', () => `status=${r.status}`);
r = await call(BASE, hr.token, 'POST', '/api/announcements', { title: 'Smoke announcement', body: 'body', category: 'policy', audience: 'all', priority: 'high', pinned: true });
const annId = r.j?.id;
assert(r.status === 200 && annId, 'Announcements: HR publishes', () => `id=${annId}`);
r = await call(BASE, hr.token, 'GET', '/api/announcements');
const ann = r.j.rows.find((a) => a.id === annId);
assert(ann && ann.pinned === 1 && ann.category === 'policy' && ann.author, 'Announcements: pinned + category persisted');
r = await call(BASE, hr.token, 'PATCH', `/api/announcements/${annId}`, { pinned: 0 });
assert(r.status === 200 && r.j.ok, 'Announcements: unpin');
r = await call(BASE, hr.token, 'DELETE', `/api/announcements/${annId}`, {});
assert(r.status === 200 && r.j.ok, 'Announcements: deleted');

// --- tidy up rows this scratch suite created -------------------------------
{
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(new URL('../data/hrmate.db', import.meta.url).pathname);
  const k = db.prepare("DELETE FROM kyc_checks WHERE type LIKE 'Smoke%'").run();
  const n = db.prepare("DELETE FROM notifications WHERE body LIKE 'Smoke%' OR title LIKE '%Smoke%'").run();
  console.log(`\n[cleanup] removed ${k.changes} smoke kyc rows, ${n.changes} smoke notifications`);
}

await closeServer();
process.exit(summary() ? 1 : 0);
