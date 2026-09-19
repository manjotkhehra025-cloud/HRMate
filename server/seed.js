// ---------------------------------------------------------------------------
// HRMate demo data seeder — deterministic (seeded PRNG) so re-seeding is stable.
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { db, all, get, insert, one, run, DATA_DIR, isSeeded, migrate } from './lib/db.js';
import { hashPassword, biometricTemplate } from './lib/auth.js';
import { addDays, dateRange, minutesBetween, nowIso, toIsoWithTime } from './lib/http.js';

// --- deterministic RNG -----------------------------------------------------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260919);
const R = {
  int: (min, max) => Math.floor(rnd() * (max - min + 1)) + min,
  float: (min, max, dp = 2) => Number((rnd() * (max - min) + min).toFixed(dp)),
  pick: (arr) => arr[Math.floor(rnd() * arr.length)],
  pickN: (arr, n) => [...arr].sort(() => rnd() - 0.5).slice(0, n),
  chance: (p) => rnd() < p,
  gauss: (mean, sd) => {
    const u = 1 - rnd();
    const v = rnd();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
};

const TODAY = process.env.HRMATE_TODAY || new Date().toISOString().slice(0, 10);
const YEAR = Number(TODAY.slice(0, 4));
const iso = (d) => (typeof d === 'string' ? d : d.toISOString().slice(0, 10));
const weekday = (d) => new Date(d + 'T00:00:00Z').getUTCDay();

export const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#f59e0b', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#a855f7'];

// ---------------------------------------------------------------------------
// Organisation blueprint
// ---------------------------------------------------------------------------
const DEPARTMENTS = [
  { name: 'Executive Office', code: 'EXEC', color: '#6366f1', icon: '🏛️', parent: null, budget: 9500000 },
  { name: 'Human Resources', code: 'HR', color: '#ec4899', icon: '🧑‍💼', parent: 'Executive Office', budget: 6200000 },
  { name: 'Engineering', code: 'ENG', color: '#3b82f6', icon: '⚙️', parent: 'Executive Office', budget: 84000000 },
  { name: 'Platform Engineering', code: 'PLT', color: '#0ea5e9', icon: '🧩', parent: 'Engineering', budget: 28000000 },
  { name: 'Mobile Engineering', code: 'MOB', color: '#8b5cf6', icon: '📱', parent: 'Engineering', budget: 21000000 },
  { name: 'Quality Engineering', code: 'QA', color: '#14b8a6', icon: '🧪', parent: 'Engineering', budget: 12000000 },
  { name: 'Customer Success', code: 'CS', color: '#f59e0b', icon: '🎧', parent: 'Executive Office', budget: 26000000 },
  { name: 'Sales', code: 'SALES', color: '#f43f5e', icon: '📈', parent: 'Executive Office', budget: 38000000 },
  { name: 'Inside Sales', code: 'IS', color: '#fb7185', icon: '☎️', parent: 'Sales', budget: 14000000 },
  { name: 'Field Sales', code: 'FS', color: '#e11d48', icon: '🚗', parent: 'Sales', budget: 16000000 },
  { name: 'Finance', code: 'FIN', color: '#10b981', icon: '💰', parent: 'Executive Office', budget: 18000000 },
  { name: 'Marketing', code: 'MKT', color: '#a855f7', icon: '📣', parent: 'Executive Office', budget: 22000000 },
  { name: 'Design', code: 'DSGN', color: '#f97316', icon: '🎨', parent: 'Executive Office', budget: 11000000 },
  { name: 'IT & Infrastructure', code: 'IT', color: '#06b6d4', icon: '🖥️', parent: 'Executive Office', budget: 15500000 },
  { name: 'Operations', code: 'OPS', color: '#22c55e', icon: '🚚', parent: 'Executive Office', budget: 31000000 }
];

const SHIFTS = [
  { name: 'General', code: 'GEN', start: '09:00', end: '18:00', color: '#3b82f6', break: 60, grace: 15, days: [1, 2, 3, 4, 5] },
  { name: 'Flex Start', code: 'FLEX', start: '10:00', end: '19:00', color: '#8b5cf6', break: 60, grace: 30, days: [1, 2, 3, 4, 5] },
  { name: 'Early Bird', code: 'EARLY', start: '07:00', end: '15:30', color: '#f59e0b', break: 45, grace: 10, days: [1, 2, 3, 4, 5] },
  { name: 'Evening Desk', code: 'EVE', start: '14:00', end: '22:30', color: '#f43f5e', break: 45, grace: 10, days: [1, 2, 3, 4, 5, 6] },
  { name: 'Night Ops', code: 'NIGHT', start: '22:00', end: '06:30', color: '#6366f1', break: 45, grace: 10, days: [0, 1, 2, 3, 4, 5, 6] },
  { name: 'Weekend Support', code: 'WKND', start: '10:00', end: '18:00', color: '#14b8a6', break: 60, grace: 15, days: [0, 6] },
  { name: 'Field Hours', code: 'FIELD', start: '09:30', end: '18:30', color: '#22c55e', break: 60, grace: 20, days: [1, 2, 3, 4, 5, 6] }
];

const LEAVE_TYPES = [
  { name: 'Casual Leave', code: 'CL', quota: 12, color: '#3b82f6', icon: '🌤️', paid: 1, notice: 2 },
  { name: 'Sick Leave', code: 'SL', quota: 10, color: '#f43f5e', icon: '🤒', paid: 1, notice: 0 },
  { name: 'Earned Leave', code: 'EL', quota: 18, color: '#10b981', icon: '🏖️', paid: 1, notice: 7, carry: 10 },
  { name: 'Work From Home', code: 'WFH', quota: 24, color: '#8b5cf6', icon: '🏠', paid: 1, notice: 1 },
  { name: 'Compensatory Off', code: 'COMP', quota: 4, color: '#f59e0b', icon: '🔁', paid: 1, notice: 2 },
  { name: 'Maternity Leave', code: 'MAT', quota: 180, color: '#ec4899', icon: '👶', paid: 1, notice: 15, applies: 'female' },
  { name: 'Paternity Leave', code: 'PAT', quota: 10, color: '#06b6d4', icon: '🍼', paid: 1, notice: 15, applies: 'male' },
  { name: 'Bereavement Leave', code: 'BER', quota: 5, color: '#64748b', icon: '🕯️', paid: 1, notice: 0 },
  { name: 'Loss of Pay', code: 'LOP', quota: 0, color: '#94a3b8', icon: '⛔', paid: 0, notice: 3 },
  { name: 'On Duty', code: 'OD', quota: 8, color: '#14b8a6', icon: '🧳', paid: 1, notice: 2 }
];

const HOLIDAYS = [
  ['New Year', `${YEAR}-01-01`, 'public', '#3b82f6'],
  ['Makar Sankranti', `${YEAR}-01-14`, 'public', '#f59e0b'],
  ['Republic Day', `${YEAR}-01-26`, 'public', '#f97316'],
  ['Holi', `${YEAR}-03-03`, 'public', '#ec4899'],
  ['Ugadi', `${YEAR}-03-25`, 'regional', '#8b5cf6'],
  ['Good Friday', `${YEAR}-04-03`, 'public', '#6366f1'],
  ['Labour Day', `${YEAR}-05-01`, 'public', '#ef4444'],
  ['Independence Day', `${YEAR}-08-15`, 'public', '#f97316'],
  ['Ganesh Chaturthi', `${YEAR}-08-26`, 'public', '#f59e0b'],
  ['Founder’s Day', `${YEAR}-09-11`, 'company', '#10b981'],
  ['Gandhi Jayanti', `${YEAR}-10-02`, 'public', '#0ea5e9'],
  ['Dussehra', `${YEAR}-10-19`, 'public', '#a855f7'],
  ['Diwali', `${YEAR}-11-08`, 'public', '#f59e0b'],
  ['Christmas', `${YEAR}-12-25`, 'public', '#ef4444']
];

// first, last, designation, department, role, managerKey, shift, salary, location, workMode
const PEOPLE = [
  ['Aarav', 'Mehta', 'Group Chief Information Officer', 'Executive Office', 'super_admin', null, 'General', 6800000, 'Bengaluru HQ', 'hybrid', 'male'],
  ['Priya', 'Nair', 'Vice President — Human Resources', 'Human Resources', 'hr_admin', 'Aarav Mehta', 'General', 4800000, 'Bengaluru HQ', 'hybrid', 'female'],
  ['Rohan', 'Deshmukh', 'HR Manager — Talent & Operations', 'Human Resources', 'hr_manager', 'Priya Nair', 'General', 2400000, 'Bengaluru HQ', 'onsite', 'male'],
  ['Sneha', 'Kulkarni', 'HR Executive', 'Human Resources', 'employee', 'Rohan Deshmukh', 'General', 900000, 'Bengaluru HQ', 'onsite', 'female'],
  ['Nikhil', 'Bose', 'Payroll Analyst', 'Human Resources', 'employee', 'Rohan Deshmukh', 'General', 1150000, 'Pune Campus', 'onsite', 'male'],
  ['Divya', 'Menon', 'HR Business Partner', 'Human Resources', 'employee', 'Rohan Deshmukh', 'Flex Start', 1450000, 'Bengaluru HQ', 'hybrid', 'female'],

  ['Ananya', 'Sharma', 'Director — Engineering', 'Engineering', 'dept_manager', 'Aarav Mehta', 'General', 5200000, 'Bengaluru HQ', 'hybrid', 'female'],
  ['Meera', 'Iyer', 'Team Lead — Mobile Engineering', 'Mobile Engineering', 'team_leader', 'Ananya Sharma', 'Flex Start', 3100000, 'Bengaluru HQ', 'hybrid', 'female'],
  ['Kabir', 'Malhotra', 'Senior Mobile Engineer', 'Mobile Engineering', 'employee', 'Meera Iyer', 'Flex Start', 2200000, 'Bengaluru HQ', 'hybrid', 'male'],
  ['Aditya', 'Verma', 'Mobile Engineer', 'Mobile Engineering', 'employee', 'Meera Iyer', 'General', 1650000, 'Pune Campus', 'onsite', 'male'],
  ['Fatima', 'Sheikh', 'Mobile Engineer (iOS)', 'Mobile Engineering', 'employee', 'Meera Iyer', 'Flex Start', 1780000, 'Bengaluru HQ', 'remote', 'female'],
  ['Jason', 'Fernandes', 'Mobile QA Engineer', 'Mobile Engineering', 'employee', 'Meera Iyer', 'General', 1320000, 'Bengaluru HQ', 'onsite', 'male'],

  ['Arjun', 'Reddy', 'Team Lead — Platform', 'Platform Engineering', 'team_leader', 'Ananya Sharma', 'General', 3250000, 'Bengaluru HQ', 'hybrid', 'male'],
  ['Ishita', 'Banerjee', 'Senior Backend Engineer', 'Platform Engineering', 'employee', 'Arjun Reddy', 'General', 2350000, 'Pune Campus', 'hybrid', 'female'],
  ['Omar', 'Qureshi', 'Site Reliability Engineer', 'Platform Engineering', 'employee', 'Arjun Reddy', 'Night Ops', 2100000, 'Bengaluru HQ', 'hybrid', 'male'],
  ['Neha', 'Gupta', 'Backend Engineer', 'Platform Engineering', 'employee', 'Arjun Reddy', 'General', 1580000, 'Pune Campus', 'onsite', 'female'],
  ['Rahul', 'Pillai', 'DevOps Engineer', 'Platform Engineering', 'employee', 'Arjun Reddy', 'General', 1890000, 'Noida Hub', 'onsite', 'male'],
  ['Daniel', 'Costa', 'Staff Engineer', 'Platform Engineering', 'employee', 'Ananya Sharma', 'Flex Start', 4100000, 'Bengaluru HQ', 'remote', 'male'],

  ['Sanya', 'Kapoor', 'Supervisor — Quality Engineering', 'Quality Engineering', 'supervisor', 'Ananya Sharma', 'General', 2600000, 'Bengaluru HQ', 'onsite', 'female'],
  ['Tanvi', 'Joshi', 'QA Analyst', 'Quality Engineering', 'employee', 'Sanya Kapoor', 'General', 1120000, 'Pune Campus', 'onsite', 'female'],
  ['Harsh', 'Patel', 'QA Automation Engineer', 'Quality Engineering', 'employee', 'Sanya Kapoor', 'General', 1440000, 'Bengaluru HQ', 'hybrid', 'male'],
  ['Riya', 'Chawla', 'QA Analyst', 'Quality Engineering', 'employee', 'Sanya Kapoor', 'General', 1080000, 'Noida Hub', 'onsite', 'female'],

  ['Karan', 'Bhatt', 'Head — Customer Success', 'Customer Success', 'dept_manager', 'Aarav Mehta', 'General', 3900000, 'Pune Campus', 'onsite', 'male'],
  ['Vikram', 'Rao', 'Supervisor — Support Operations', 'Customer Success', 'supervisor', 'Karan Bhatt', 'Evening Desk', 1950000, 'Pune Campus', 'onsite', 'male'],
  ['Pooja', 'Singh', 'Senior Support Executive', 'Customer Success', 'employee', 'Vikram Rao', 'Evening Desk', 940000, 'Pune Campus', 'onsite', 'female'],
  ['Rehan', 'Ali', 'Support Executive', 'Customer Success', 'employee', 'Vikram Rao', 'Night Ops', 780000, 'Noida Hub', 'onsite', 'male'],
  ['Aisha', 'Khan', 'Support Specialist', 'Customer Success', 'employee', 'Vikram Rao', 'Weekend Support', 820000, 'Pune Campus', 'onsite', 'female'],
  ['Manish', 'Yadav', 'Support Executive', 'Customer Success', 'employee', 'Vikram Rao', 'Evening Desk', 760000, 'Noida Hub', 'onsite', 'male'],
  ['Leela', 'Krishnan', 'Customer Success Manager', 'Customer Success', 'employee', 'Karan Bhatt', 'General', 1980000, 'Bengaluru HQ', 'hybrid', 'female'],

  ['Nandini', 'Iyer', 'Head — Sales', 'Sales', 'dept_manager', 'Aarav Mehta', 'Field Hours', 4400000, 'Bengaluru HQ', 'hybrid', 'female'],
  ['Sameer', 'Joshi', 'Team Lead — Inside Sales', 'Inside Sales', 'team_leader', 'Nandini Iyer', 'General', 2050000, 'Bengaluru HQ', 'onsite', 'male'],
  ['Ankit', 'Sharma', 'Inside Sales Executive', 'Inside Sales', 'employee', 'Sameer Joshi', 'General', 980000, 'Noida Hub', 'onsite', 'male'],
  ['Ritu', 'Aggarwal', 'Inside Sales Executive', 'Inside Sales', 'employee', 'Sameer Joshi', 'General', 950000, 'Noida Hub', 'onsite', 'female'],
  ['Farhan', 'Sheikh', 'Account Executive', 'Inside Sales', 'employee', 'Sameer Joshi', 'General', 1240000, 'Bengaluru HQ', 'hybrid', 'male'],
  ['Deepika', 'Nambiar', 'Sales Development Rep', 'Inside Sales', 'employee', 'Sameer Joshi', 'General', 890000, 'Pune Campus', 'onsite', 'female'],
  ['Trisha', 'Bose', 'Supervisor — Field Sales', 'Field Sales', 'supervisor', 'Nandini Iyer', 'Field Hours', 2150000, 'Bengaluru HQ', 'onsite', 'female'],
  ['Vivek', 'Kumar', 'Field Sales Officer', 'Field Sales', 'employee', 'Trisha Bose', 'Field Hours', 1080000, 'Bengaluru HQ', 'onsite', 'male'],
  ['Shruti', 'Desai', 'Field Sales Officer', 'Field Sales', 'employee', 'Trisha Bose', 'Field Hours', 1050000, 'Pune Campus', 'onsite', 'female'],
  ['Imran', 'Hussain', 'Field Sales Officer', 'Field Sales', 'employee', 'Trisha Bose', 'Field Hours', 1010000, 'Noida Hub', 'onsite', 'male'],

  ['Rakesh', 'Sinha', 'Finance Controller', 'Finance', 'dept_manager', 'Aarav Mehta', 'General', 3600000, 'Bengaluru HQ', 'onsite', 'male'],
  ['Meghna', 'Dutta', 'Senior Accountant', 'Finance', 'employee', 'Rakesh Sinha', 'General', 1320000, 'Pune Campus', 'onsite', 'female'],
  ['Sanjay', 'Prasad', 'Financial Analyst', 'Finance', 'employee', 'Rakesh Sinha', 'General', 1490000, 'Bengaluru HQ', 'hybrid', 'male'],

  ['Alia', 'Rehman', 'Head — Marketing', 'Marketing', 'dept_manager', 'Aarav Mehta', 'Flex Start', 3400000, 'Bengaluru HQ', 'hybrid', 'female'],
  ['Zoya', 'Merchant', 'Content Strategist', 'Marketing', 'employee', 'Alia Rehman', 'Flex Start', 1260000, 'Bengaluru HQ', 'remote', 'female'],
  ['Karthik', 'Menon', 'Growth Marketing Manager', 'Marketing', 'employee', 'Alia Rehman', 'General', 1720000, 'Pune Campus', 'hybrid', 'male'],

  ['Elena', "D'Souza", 'Head — Design', 'Design', 'dept_manager', 'Aarav Mehta', 'Flex Start', 3300000, 'Bengaluru HQ', 'hybrid', 'female'],
  ['Rohit', 'Saxena', 'Senior Product Designer', 'Design', 'employee', "Elena D'Souza", 'Flex Start', 1980000, 'Bengaluru HQ', 'remote', 'male'],
  ['Anjali', 'Nair', 'UX Researcher', 'Design', 'employee', "Elena D'Souza", 'General', 1540000, 'Bengaluru HQ', 'hybrid', 'female'],

  ['Prakash', 'Reddy', 'Supervisor — IT & Infrastructure', 'IT & Infrastructure', 'supervisor', 'Aarav Mehta', 'General', 2050000, 'Bengaluru HQ', 'onsite', 'male'],
  ['Sunil', 'Verma', 'IT Support Engineer', 'IT & Infrastructure', 'employee', 'Prakash Reddy', 'Evening Desk', 1010000, 'Noida Hub', 'onsite', 'male'],
  ['Nisha', 'Rawat', 'IT Administrator', 'IT & Infrastructure', 'employee', 'Prakash Reddy', 'General', 1290000, 'Pune Campus', 'onsite', 'female'],

  ['Gaurav', 'Chopra', 'Head — Operations', 'Operations', 'dept_manager', 'Aarav Mehta', 'General', 3750000, 'Noida Hub', 'onsite', 'male'],
  ['Pallavi', 'Rane', 'Operations Executive', 'Operations', 'employee', 'Gaurav Chopra', 'Early Bird', 960000, 'Noida Hub', 'onsite', 'female'],
  ['Suresh', 'Naidu', 'Logistics Coordinator', 'Operations', 'employee', 'Gaurav Chopra', 'Night Ops', 880000, 'Noida Hub', 'onsite', 'male'],
  ['Aarti', 'Malviya', 'Operations Analyst', 'Operations', 'employee', 'Gaurav Chopra', 'General', 1180000, 'Pune Campus', 'hybrid', 'female']
];

const SKILLS_POOL = ['Leadership', 'React Native', 'Node.js', 'SQL', 'Stakeholder Management', 'Analytics', 'Figma', 'Recruiting', 'Payroll', 'SAP', 'Salesforce', 'Communication', 'Mentoring', 'Cloud Ops', 'Kubernetes', 'Excel', 'Public Speaking', 'Agile', 'Negotiation', 'Problem Solving'];

const BIO_POOL = [
  'Focused on building reliable systems and helping the team ship with confidence.',
  'Loves turning messy processes into simple, measurable workflows.',
  'People-first leader; enjoys coaching early-career engineers and designers.',
  'Data-driven operator with a bias for automation and clear documentation.',
  'Customer obsessed — happiest when a tough ticket turns into a happy renewal.',
  'Detail oriented, calm under pressure, always the one with the checklist.'
];

// ---------------------------------------------------------------------------
export function resetDatabase() {
  const tables = all(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`);
  db.exec('PRAGMA foreign_keys = OFF');
  for (const t of tables) run(`DELETE FROM ${t.name}`);
  db.exec('PRAGMA foreign_keys = ON');
  run(`DELETE FROM sqlite_sequence`);
}

export function seedDatabase({ force = false } = {}) {
  migrate();
  if (isSeeded() && !force) return { skipped: true, companyId: one('SELECT id FROM companies') };
  resetDatabase();

  const companyId = insert('companies', {
    name: 'NorthPeak Technologies',
    slug: 'northpeak',
    logo_emoji: '⛰️',
    industry: 'Enterprise SaaS & Logistics Software',
    timezone: 'UTC',
    week_start: 1,
    work_hours_per_day: 8,
    work_days: [1, 2, 3, 4, 5],
    currency: 'INR',
    punch_radius_m: 250,
    allow_remote_punch: 1,
    overtime_enabled: 1,
    late_grace_min: 15,
    plan: 'enterprise'
  });

  // locations ---------------------------------------------------------------
  const LOCATIONS = [
    { name: 'NorthPeak HQ', address: 'Prestige Tech Park, Outer Ring Road', city: 'Bengaluru', country: 'India', lat: 12.9279, lng: 77.6271, radius: 250, type: 'office' },
    { name: 'Pune Campus', address: 'Magarpatta City, Hadapsar', city: 'Pune', country: 'India', lat: 18.5196, lng: 73.9071, radius: 300, type: 'office' },
    { name: 'Noida Hub', address: 'Sector 62, Institutional Area', city: 'Noida', country: 'India', lat: 28.6280, lng: 77.3649, radius: 200, type: 'office' },
    { name: 'Remote / Work From Home', address: 'Distributed', city: 'Anywhere', country: 'India', lat: null, lng: null, radius: 0, type: 'remote' }
  ];
  const LOC_ALIAS = { 'Bengaluru HQ': 'NorthPeak HQ' };
  const locKey = (n) => LOC_ALIAS[n] || n;
  const locId = {};
  for (const l of LOCATIONS)
    locId[l.name] = insert('locations', {
      company_id: companyId,
      name: l.name,
      address: l.address,
      city: l.city,
      country: l.country,
      latitude: l.lat,
      longitude: l.lng,
      radius_m: l.radius,
      type: l.type
    });

  // departments -------------------------------------------------------------
  const deptId = {};
  for (const pass of [null, 'x']) {
    for (const d of DEPARTMENTS) {
      const hasParent = !!d.parent;
      if (pass === null && hasParent) continue;
      if (pass === 'x' && !hasParent) continue;
      deptId[d.name] = insert('departments', {
        company_id: companyId,
        name: d.name,
        code: d.code,
        color: d.color,
        icon: d.icon,
        parent_id: d.parent ? deptId[d.parent] : null,
        budget: d.budget,
        description: `${d.name} at NorthPeak Technologies`
      });
    }
  }

  // shifts ------------------------------------------------------------------
  const shiftId = {};
  for (const s of SHIFTS) {
    shiftId[s.name] = insert('shifts', {
      company_id: companyId,
      name: s.name,
      code: s.code,
      start_time: s.start,
      end_time: s.end,
      break_minutes: s.break,
      color: s.color,
      days: s.days,
      grace_min: s.grace,
      work_hours: Number(minutesBetween(s.start, s.end, TODAY) - s.break) / 60,
      overnight: s.end < s.start ? 1 : 0,
      description: `${s.name} — ${s.start} to ${s.end}`
    });
  }

  // leave types -------------------------------------------------------------
  const leaveTypeId = {};
  for (const lt of LEAVE_TYPES) {
    leaveTypeId[lt.name] = insert('leave_types', {
      company_id: companyId,
      name: lt.name,
      code: lt.code,
      color: lt.color,
      icon: lt.icon,
      annual_quota: lt.quota,
      carry_forward: lt.carry || 0,
      paid: lt.paid,
      min_notice_days: lt.notice || 0,
      max_days_per_request: lt.code === 'CL' ? 5 : 0,
      applies_to: lt.applies || 'all',
      active: 1
    });
  }

  // holidays ----------------------------------------------------------------
  for (const [name, date, type, color] of HOLIDAYS) {
    insert('holidays', { company_id: companyId, name, date, type, color, applies_to: 'all' });
  }
  insert('holidays', { company_id: companyId, name: 'Annual Sports Day', date: addDays(TODAY, 12), type: 'company', color: '#10b981', applies_to: 'all' });

  // employees ---------------------------------------------------------------
  const empId = {};
  const employees = [];
  const passwordHash = hashPassword('Demo@1234');
  const pinHash = hashPassword('123456');
  let counter = 1;

  // Two passes so managers exist before dependants.
  const sorted = [...PEOPLE].sort((a, b) => (a[5] === null ? -1 : b[5] === null ? 1 : 0));
  for (const p of sorted) {
    const [first, last, designation, deptName, role, managerName, shiftName, salary, locName, workMode, gender] = p;
    const key = `${first} ${last}`;
    empId[key] = empId[key] || `pending:${key}`;
    const joinYearsAgo = R.float(0.4, 9.5, 1);
    const joinDate = addDays(TODAY, -Math.round(joinYearsAgo * 365));
    const email = `${first.toLowerCase()}.${last.toLowerCase().replace(/[^a-z]/g, '')}@northpeak.io`;
    const id = insert('employees', {
      company_id: companyId,
      emp_code: `NP-${String(1000 + counter).slice(1)}`,
      first_name: first,
      last_name: last,
      email,
      phone: `+91 ${R.int(70000, 99999)} ${R.int(10000, 99999)}`,
      password_hash: passwordHash,
      role,
      designation,
      department_id: deptId[deptName],
      location_id: locId[locKey(locName)],
      manager_id: managerName && empId[managerName] && !String(empId[managerName]).startsWith('pending') ? empId[managerName] : null,
      employment_type: R.chance(0.9) ? 'full_time' : R.pick(['contract', 'intern']),
      status: 'active',
      join_date: joinDate,
      date_of_birth: `${R.int(1972, 2002)}-${String(R.int(1, 12)).padStart(2, '0')}-${String(R.int(1, 28)).padStart(2, '0')}`,
      gender,
      address: `${R.int(1, 400)}, ${R.pick(['Orchid Residency', 'Lakeview Apartments', 'Green Meadows', 'Sunrise Enclave', 'Palm Grove'])}`,
      city: locName === 'Noida Hub' ? 'Noida' : locName === 'Pune Campus' ? 'Pune' : 'Bengaluru',
      emergency_contact: R.pick(['Ramesh', 'Sunita', 'Anil', 'Kavita', 'Zoya', 'Joseph']) + ' ' + last,
      emergency_phone: `+91 ${R.int(70000, 99999)} ${R.int(10000, 99999)}`,
      salary,
      currency: 'INR',
      shift_id: shiftId[shiftName],
      avatar_color: AVATAR_COLORS[counter % AVATAR_COLORS.length],
      avatar_emoji: R.pick(['🙂', '😎', '🤓', '🧑‍💻', '👩‍💼', '🧑‍💼', '👨‍🔬', '👩‍🔧', '🦸', '🧙', '🐱', '🦊', '🐼', '🦁', '🐨', '🦉']),
      bio: R.pick(BIO_POOL),
      skills: R.pickN(SKILLS_POOL, R.int(3, 6)),
      bank_account: `XXXX${R.int(1000, 9999)}`,
      tax_id: `ABCDE${R.int(1000, 9999)}F`,
      work_mode: workMode,
      probation_end: addDays(joinDate, 180),
      notice_period_days: R.pick([30, 60, 60, 90]),
      pin_hash: pinHash,
      face_template: biometricTemplate('face', email),
      fingerprint_template: biometricTemplate('finger', email),
      biometric_enabled: 1,
      locale: 'en',
      theme: R.chance(0.5) ? 'dark' : 'light',
      created_at: new Date(joinDate + 'T09:00:00Z').toISOString()
    });
    empId[key] = id;
    employees.push({ id, key, first, last, role, designation, deptName, shiftName, locName, workMode, salary, joinDate, gender, email });
    counter += 1;
  }

  // Link department heads + manager ids that were deferred
  for (const e of employees) {
    const person = PEOPLE.find((p) => `${p[0]} ${p[1]}` === e.key);
    const managerName = person?.[5];
    if (managerName && empId[managerName]) run('UPDATE employees SET manager_id = ? WHERE id = ?', empId[managerName], e.id);
  }
  const deptHeads = {
    'Human Resources': 'Priya Nair',
    Engineering: 'Ananya Sharma',
    'Customer Success': 'Karan Bhatt',
    Sales: 'Nandini Iyer',
    Finance: 'Rakesh Sinha',
    Marketing: 'Alia Rehman',
    Design: "Elena D'Souza",
    'IT & Infrastructure': 'Prakash Reddy',
    Operations: 'Gaurav Chopra',
    'Executive Office': 'Aarav Mehta',
    'Mobile Engineering': 'Meera Iyer',
    'Platform Engineering': 'Arjun Reddy',
    'Quality Engineering': 'Sanya Kapoor',
    'Inside Sales': 'Sameer Joshi',
    'Field Sales': 'Trisha Bose'
  };
  for (const [dept, personKey] of Object.entries(deptHeads)) {
    if (deptId[dept] && empId[personKey]) run('UPDATE departments SET head_employee_id = ? WHERE id = ?', empId[personKey], deptId[dept]);
  }

  // leave balances ----------------------------------------------------------
  const year = Number(TODAY.slice(0, 4));
  for (const e of employees) {
    for (const lt of LEAVE_TYPES) {
      if (lt.applies === 'female' && e.gender !== 'female') continue;
      if (lt.applies === 'male' && e.gender !== 'male') continue;
      const used = lt.quota ? Math.min(lt.quota, Math.max(0, Math.round(R.gauss(lt.quota * 0.34, lt.quota * 0.16)))) : 0;
      insert('leave_balances', {
        employee_id: e.id,
        leave_type_id: leaveTypeId[lt.name],
        year,
        entitled: lt.quota,
        used,
        pending: 0
      });
    }
  }

  // roster (past 6 weeks + next 4 weeks) ------------------------------------
  const rosterStart = addDays(TODAY, -42);
  const rosterEnd = addDays(TODAY, 28);
  const rosterDays = dateRange(rosterStart, rosterEnd);
  for (const e of employees) {
    const shift = SHIFTS.find((s) => s.name === e.shiftName);
    const weekendRotation = ['Weekend Support', 'Night Ops', 'Evening Desk', 'Field Hours'].includes(e.shiftName);
    for (const d of rosterDays) {
      const dow = weekday(d);
      let working = shift.days.includes(dow);
      if (!working && weekendRotation && R.chance(0.25)) working = true;
      if (!working && R.chance(0.03)) working = true; // occasional weekend drive
      insert('roster', {
        company_id: companyId,
        employee_id: e.id,
        shift_id: working ? shiftId[e.shiftName] : null,
        date: d,
        kind: working ? 'work' : R.chance(0.12) ? 'week_off' : 'off',
        published: 1
      });
    }
  }

  // leave requests ----------------------------------------------------------
  const leaveReasons = [
    'Family function out of town',
    'Down with fever, doctor advised rest',
    'Personal errand — bank & passport work',
    'Wedding in the family',
    'Working from home — deep focus sprint',
    'Child sick at home',
    'Recovering from dental surgery',
    'Attending a conference',
    'Long weekend with family',
    'Moving house',
    'Annual health check-up',
    'Compensatory off for weekend release support'
  ];
  const leavePlan = [];
  for (const e of employees) {
    const count = R.int(2, 6);
    for (let i = 0; i < count; i += 1) {
      const type = R.pick(LEAVE_TYPES.filter((l) => l.code !== 'MAT' && l.code !== 'PAT' && l.code !== 'LOP'));
      const offset = R.int(-70, 20);
      const start = addDays(TODAY, offset);
      const span = type.code === 'CL' ? R.int(1, 2) : type.code === 'SL' ? R.int(1, 3) : R.int(1, 4);
      const end = addDays(start, span - 1);
      let days = 0;
      for (const d of dateRange(start, end)) if (weekday(d) !== 0 && weekday(d) !== 6) days += 1;
      if (!days) days = 1;
      const status = offset < -3 ? (R.chance(0.92) ? 'approved' : 'rejected') : offset < 0 ? (R.chance(0.85) ? 'approved' : R.pick(['pending', 'rejected'])) : R.chance(0.45) ? 'approved' : 'pending';
      const approver = employees.find((x) => x.key === (PEOPLE.find((p) => `${p[0]} ${p[1]}` === e.key)?.[5] || ''));
      const half = days === 1 && R.chance(0.18) ? 1 : 0;
      const id = insert('leave_requests', {
        company_id: companyId,
        employee_id: e.id,
        leave_type_id: leaveTypeId[type.name],
        start_date: start,
        end_date: end,
        days: half ? 0.5 : days,
        half_day: half,
        reason: R.pick(leaveReasons),
        status,
        approver_id: approver?.id || empId['Rohan Deshmukh'],
        decided_at: status === 'pending' ? null : new Date(start + 'T07:00:00Z').toISOString(),
        decision_note: status === 'rejected' ? R.pick(['Coverage not available for those dates', 'Please re-apply after sprint freeze', 'Insufficient balance']) : null,
        created_at: new Date(addDays(start, -R.int(1, 10)) + 'T10:00:00Z').toISOString()
      });
      insert('approvals', {
        company_id: companyId,
        type: 'leave',
        ref_id: id,
        requester_id: e.id,
        approver_id: approver?.id || empId['Rohan Deshmukh'],
        summary: `${type.name} · ${days === 1 ? '1 day' : `${days} days`} · ${start}`,
        status,
        created_at: new Date(addDays(start, -R.int(1, 10)) + 'T10:05:00Z').toISOString()
      });
      leavePlan.push({ employee: e, start, end, days, half, type, status });
    }
  }

  // attendance + punches ----------------------------------------------------
  const attStart = addDays(TODAY, -75);
  const attDays = dateRange(attStart, TODAY);
  const holidaySet = new Set(HOLIDAYS.map((h) => h[1]));
  const methodPool = (e) => {
    const base = ['biometric', 'face', 'gps'];
    if (e.workMode === 'remote') return ['gps', 'face', 'selfie'];
    if (e.workMode === 'hybrid') return base.concat('selfie');
    return base.concat('pin');
  };

  for (const e of employees) {
    const shift = SHIFTS.find((s) => s.name === e.shiftName);
    const [sh, sm] = shift.start.split(':').map(Number);
    const [eh, em] = shift.end.split(':').map(Number);
    for (const d of attDays) {
      const dow = weekday(d);
      const rosterRow = get('SELECT * FROM roster WHERE employee_id = ? AND date = ?', e.id, d);
      const isScheduled = rosterRow ? rosterRow.kind === 'work' : shift.days.includes(dow);
      const isHoliday = holidaySet.has(d);
      const leaveToday = leavePlan.find((l) => l.employee.id === e.id && l.status === 'approved' && l.start <= d && l.end >= d);

      let status = 'week_off';
      let firstIn = null;
      let lastOut = null;
      let inMethod = null;
      let outMethod = null;
      let lateMin = 0;
      let otMin = 0;
      let workMin = 0;
      let geofenceOk = 1;
      let inLat = null;
      let inLng = null;
      let inLoc = null;
      let note = null;
      let regularized = 0;

      if (isHoliday) {
        status = 'holiday';
      } else if (!isScheduled) {
        status = 'week_off';
      } else if (leaveToday) {
        status = leaveToday.half ? 'half_day' : 'on_leave';
        note = leaveToday.type.name;
      } else if (R.chance(0.035)) {
        status = R.chance(0.5) ? 'absent' : 'missed_punch';
        note = status === 'missed_punch' ? 'Forgot to punch out' : null;
        if (status === 'missed_punch') regularized = R.chance(0.6) ? 1 : 0;
      } else {
        const latenessBias = R.gauss(0, 11);
        const inMinutes = sh * 60 + sm + Math.round(latenessBias);
        const lateness = Math.max(0, inMinutes - (sh * 60 + sm + shift.grace));
        const outMinutes = eh * 60 + em + Math.round(R.gauss(18, 32));
        const firstInDate = new Date(d + 'T00:00:00Z');
        firstInDate.setUTCMinutes(inMinutes);
        firstIn = firstInDate.toISOString();
        const lastOutDate = new Date(d + 'T00:00:00Z');
        lastOutDate.setUTCMinutes(outMinutes);
        lastOut = lastOutDate.toISOString();
        workMin = Math.max(0, outMinutes - inMinutes - shift.break);
        const expected = shift.work_hours * 60;
        otMin = Math.max(0, Math.round(workMin - expected));
        lateMin = lateness;
        status = lateness > 15 ? 'late' : workMin < expected * 0.55 ? 'half_day' : R.chance(0.14) && e.workMode !== 'onsite' ? 'wfh' : 'present';
        inMethod = R.pick(methodPool(e));
        outMethod = R.pick(methodPool(e));
        const loc = LOCATIONS.find((l) => l.name === locKey(e.locName));
        if (status === 'wfh' || e.workMode === 'remote' || R.chance(0.12)) {
          const home = { lat: loc.lat ? loc.lat + R.float(-0.06, 0.06, 5) : 12.9716, lng: loc.lng ? loc.lng + R.float(-0.06, 0.06, 5) : 77.5946 };
          inLat = Number(home.lat.toFixed(5));
          inLng = Number(home.lng.toFixed(5));
          inLoc = locId['Remote / Work From Home'];
          geofenceOk = 0;
        } else {
          inLat = Number((loc.lat + R.float(-0.0012, 0.0012, 6)).toFixed(6));
          inLng = Number((loc.lng + R.float(-0.0012, 0.0012, 6)).toFixed(6));
          inLoc = locId[locKey(e.locName)];
          geofenceOk = 1;
        }
        if (status === 'late') note = `Punched in ${lateMin} min after grace`;
      }

      const attendanceId = insert('attendance', {
        company_id: companyId,
        employee_id: e.id,
        date: d,
        shift_id: isScheduled ? shiftId[e.shiftName] : null,
        first_in: firstIn,
        last_out: lastOut,
        work_minutes: workMin,
        ot_minutes: otMin,
        break_minutes: workMin > 0 ? shift.break : 0,
        late_minutes: lateMin,
        status,
        in_method: inMethod,
        out_method: outMethod,
        in_lat: inLat,
        in_lng: inLng,
        in_accuracy: inMethod ? R.float(4, 28, 1) : null,
        in_location_id: inLoc,
        out_lat: inLat ? Number((inLat + R.float(-0.0008, 0.0008, 6)).toFixed(6)) : null,
        out_lng: inLng ? Number((inLng + R.float(-0.0008, 0.0008, 6)).toFixed(6)) : null,
        out_location_id: inLoc,
        geofence_ok: geofenceOk,
        notes: note,
        regularized
      });

      if (firstIn) {
        insert('punches', {
          company_id: companyId,
          employee_id: e.id,
          attendance_id: attendanceId,
          type: 'in',
          at: firstIn,
          method: inMethod,
          lat: inLat,
          lng: inLng,
          accuracy: R.float(4, 28, 1),
          distance_m: geofenceOk ? R.float(3, 90, 1) : R.float(2000, 18000, 0),
          geofence_ok: geofenceOk,
          face_score: inMethod === 'face' ? R.float(0.9, 0.99, 3) : null,
          fingerprint_score: inMethod === 'biometric' ? R.float(0.92, 0.99, 3) : null,
          ip: `10.20.${R.int(1, 40)}.${R.int(2, 250)}`
        });
      }
      if (lastOut && status !== 'missed_punch') {
        insert('punches', {
          company_id: companyId,
          employee_id: e.id,
          attendance_id: attendanceId,
          type: 'out',
          at: lastOut,
          method: outMethod,
          lat: inLat,
          lng: inLng,
          accuracy: R.float(4, 30, 1),
          distance_m: geofenceOk ? R.float(3, 120, 1) : R.float(2000, 18000, 0),
          geofence_ok: geofenceOk,
          face_score: outMethod === 'face' ? R.float(0.9, 0.99, 3) : null,
          fingerprint_score: outMethod === 'biometric' ? R.float(0.92, 0.99, 3) : null,
          ip: `10.20.${R.int(1, 40)}.${R.int(2, 250)}`
        });
      }
    }
  }

  // documents + KYC ---------------------------------------------------------
  const docCatalog = [
    ['Offer Letter', 'employment', 'offer-letter.pdf', 420, 'issued'],
    ['Appointment Letter', 'employment', 'appointment-letter.pdf', 512, 'issued'],
    ['Employment Contract', 'employment', 'contract.pdf', 880, 'issued'],
    ['Aadhaar Card', 'kyc', 'aadhaar.pdf', 180, 'issued'],
    ['PAN Card', 'kyc', 'pan.pdf', 145, 'issued'],
    ['Passport', 'kyc', 'passport.pdf', 940, 'issued'],
    ['Bank Details Proof', 'finance', 'bank-proof.pdf', 210, 'issued'],
    ['Highest Degree Certificate', 'education', 'degree.pdf', 1240, 'issued'],
    ['Previous Employer Relieving Letter', 'employment', 'relieving.pdf', 330, 'issued'],
    ['NDA & IP Agreement', 'policy', 'nda.pdf', 275, 'issued'],
    ['Group Insurance Card', 'benefits', 'insurance.pdf', 160, 'issued'],
    ['Device Handover Form', 'it', 'device-handover.pdf', 190, 'issued']
  ];
  let docCount = 0;
  for (const e of employees) {
    const sample = R.pickN(docCatalog, R.int(4, 8));
    for (const [title, category, fileName, size] of sample) {
      const verified = R.chance(0.72);
      insert('documents', {
        company_id: companyId,
        employee_id: e.id,
        category,
        title,
        doc_type: 'pdf',
        file_name: fileName,
        file_url: `/uploads/sample/${category}-${fileName}`,
        size_kb: size + R.int(-40, 200),
        uploaded_by: empId['Rohan Deshmukh'],
        issue_date: e.joinDate,
        expiry_date: category === 'kyc' ? addDays(TODAY, R.int(-30, 1400)) : null,
        verified,
        verified_by: verified ? empId['Priya Nair'] : null,
        verified_at: verified ? nowIso() : null,
        status: verified ? 'verified' : R.chance(0.5) ? 'pending' : 'rejected',
        tags: [category, 'employee'],
        created_at: new Date(addDays(e.joinDate, R.int(0, 12)) + 'T11:00:00Z').toISOString()
      });
      docCount += 1;
    }
    // company-wide policies attached to everyone
    if (R.chance(0.4)) {
      insert('documents', {
        company_id: companyId,
        employee_id: e.id,
        category: 'policy',
        title: 'Employee Handbook 2026 (Acknowledged)',
        doc_type: 'pdf',
        file_name: 'handbook-2026.pdf',
        file_url: '/uploads/sample/policy-handbook.pdf',
        size_kb: 3200,
        uploaded_by: empId['Priya Nair'],
        verified: 1,
        verified_by: empId['Priya Nair'],
        status: 'verified',
        tags: ['policy'],
        created_at: nowIso()
      });
    }

    const kycTypes = ['Aadhaar Verification', 'PAN Verification', 'Background Check', 'Address Verification'];
    for (const t of R.pickN(kycTypes, R.int(2, 4))) {
      const status = R.chance(0.7) ? 'verified' : R.chance(0.5) ? 'pending' : 'flagged';
      insert('kyc_checks', {
        company_id: companyId,
        employee_id: e.id,
        type: t,
        status,
        score: status === 'verified' ? R.int(88, 100) : status === 'flagged' ? R.int(35, 65) : null,
        submitted_at: new Date(addDays(e.joinDate, R.int(0, 20)) + 'T09:30:00Z').toISOString(),
        reviewed_by: status === 'verified' ? empId['Rohan Deshmukh'] : null,
        reviewed_at: status === 'verified' ? nowIso() : null,
        note: status === 'flagged' ? 'Document image unclear — resubmission requested' : null
      });
    }
  }

  // goals + key results -----------------------------------------------------
  const goalTemplates = [
    ['Ship HRMate mobile attendance v2', 'Reduce punch-in failure rate below 0.5%', 'business'],
    ['Improve customer NPS to 55', 'Close 95% of P1 tickets within 4h', 'customer'],
    ['Grow pipeline by 40% QoQ', 'Convert 25% of trials to paid', 'revenue'],
    ['Cut cloud spend by 18%', 'Migrate 6 services to spot instances', 'efficiency'],
    ['Launch inclusive hiring program', 'Achieve 40% diverse shortlists', 'people'],
    ['Zero payroll discrepancies', 'Automate 100% of statutory filings', 'compliance'],
    ['Design system adoption at 90%', 'Ship 12 accessible components', 'product'],
    ['Reduce attrition below 9%', 'Complete stay interviews for all managers', 'people']
  ];
  for (const e of employees) {
    const goals = R.pickN(goalTemplates, R.int(2, 4));
    const weightStep = Math.floor(100 / goals.length);
    goals.forEach((g, idx) => {
      const progress = R.int(15, 100);
      const goalId = insert('goals', {
        company_id: companyId,
        employee_id: e.id,
        title: g[0],
        description: `${g[0]} — owned by ${e.first} for the ${YEAR} H2 cycle.`,
        category: g[2],
        weight: idx === goals.length - 1 ? 100 - weightStep * (goals.length - 1) : weightStep,
        progress,
        status: progress >= 75 ? 'ahead' : progress >= 40 ? 'on_track' : R.chance(0.5) ? 'at_risk' : 'behind',
        start_date: addDays(TODAY, -R.int(20, 90)),
        due_date: addDays(TODAY, R.int(10, 90)),
        owner_id: e.id
      });
      const krs = R.int(2, 3);
      for (let k = 0; k < krs; k += 1) {
        const target = R.pick([100, 50, 40, 25, 10]);
        insert('key_results', {
          goal_id: goalId,
          title: k === 0 ? g[1] : `${R.pick(['Reduce', 'Increase', 'Automate', 'Publish', 'Certify'])} ${R.pick(['cycle time', 'coverage', 'docs', 'SLA compliance', 'CSAT'])} by ${R.int(5, 30)}%`,
          metric: R.pick(['percentage', 'count', 'hours', 'score']),
          target,
          current: Math.min(target, Number((target * R.float(0.2, 1.05, 2)).toFixed(2))),
          unit: R.pick(['%', 'tickets', 'hours', 'index']),
          due_date: addDays(TODAY, R.int(5, 60)),
          status: R.pick(['on_track', 'on_track', 'ahead', 'at_risk']),
          updated_at: nowIso()
        });
      }
    });
  }

  // performance cycles + reviews -------------------------------------------
  const cycleCompleted = insert('review_cycles', {
    company_id: companyId,
    name: `H1 ${YEAR} Performance Cycle`,
    period: `Jan–Jun ${YEAR}`,
    start_date: `${YEAR}-01-05`,
    end_date: `${YEAR}-06-30`,
    status: 'completed'
  });
  const cycleActive = insert('review_cycles', {
    company_id: companyId,
    name: `H2 ${YEAR} Performance Cycle`,
    period: `Jul–Dec ${YEAR}`,
    start_date: `${YEAR}-07-01`,
    end_date: `${YEAR}-12-31`,
    status: 'active'
  });
  const strengthsPool = ['Strong ownership', 'Excellent communication', 'Deep technical craft', 'Mentors teammates', 'Calm under pressure', 'Customer empathy', 'Data-driven decisions'];
  const improvePool = ['Delegate more effectively', 'Write more design docs', 'Speak up earlier on risks', 'Broaden cross-team exposure', 'Timebox investigation work'];
  for (const e of employees) {
    const managerName = PEOPLE.find((p) => `${p[0]} ${p[1]}` === e.key)?.[5];
    const reviewerId = managerName ? empId[managerName] : empId['Priya Nair'];
    const rating = Number(R.gauss(3.9, 0.55).toFixed(1));
    const clamped = Math.min(5, Math.max(2.2, rating));
    insert('reviews', {
      company_id: companyId,
      cycle_id: cycleCompleted,
      employee_id: e.id,
      reviewer_id: reviewerId,
      rating: clamped,
      potential: R.int(2, 4),
      productivity: R.int(62, 98),
      quality: R.int(65, 99),
      teamwork: R.int(68, 99),
      initiative: R.int(55, 97),
      reliability: R.int(70, 99),
      strengths: R.pickN(strengthsPool, 3),
      improvements: R.pickN(improvePool, 2),
      summary: `${e.first} delivered consistently across the H1 cycle with a ${clamped.toFixed(1)} composite rating. Key wins were recognised in the quarterly town hall.`,
      status: 'published',
      self_rating: Number((clamped + R.float(-0.3, 0.4, 1)).toFixed(1)),
      ack: R.chance(0.8) ? 1 : 0,
      created_at: new Date(`${YEAR}-06-20T10:00:00Z`).toISOString()
    });
    if (R.chance(0.6)) {
      insert('reviews', {
        company_id: companyId,
        cycle_id: cycleActive,
        employee_id: e.id,
        reviewer_id: reviewerId,
        rating: null,
        productivity: R.int(60, 95),
        quality: R.int(62, 96),
        teamwork: R.int(65, 96),
        initiative: R.int(52, 94),
        reliability: R.int(68, 96),
        status: R.pick(['in_progress', 'draft']),
        self_rating: Number(R.float(3.2, 4.8, 1)),
        created_at: new Date(`${YEAR}-07-05T10:00:00Z`).toISOString()
      });
    }
  }

  // announcements -----------------------------------------------------------
  const announcements = [
    ['🎉 Q3 results are out — 22% YoY growth', 'Team, we closed Q3 at 22% year-on-year growth with record retention. Thank you for the relentless focus on customers. Full deck is in the all-hands recording.', 'achievement', 'all', 1, 'high'],
    ['Diwali bonus & appraisal timeline', 'Appraisal letters roll out from 20 October. Diwali bonus will be credited with the October payroll. Eligibility cut-off is 30 September.', 'hr', 'all', 1, 'high'],
    ['New hybrid work policy effective 1 October', 'Hybrid colleagues may work remotely up to 2 days a week with manager approval. Punch in from home is allowed within your registered geofence.', 'policy', 'all', 0, 'normal'],
    ['Support roster changes for the festive week', 'Weekend Support shift moves to 09:00–17:00 during the festive week. Swap requests open now in the Roster tab.', 'operations', 'Customer Success', 0, 'normal'],
    ['Security reminder: enable biometric login', 'Enable fingerprint or face unlock in Settings → Security. Sessions older than 14 days expire automatically.', 'it', 'all', 0, 'normal'],
    ['Annual Sports Day — registrations open', 'Register your department team by Friday. Events include relay, table tennis, and the legendary HR vs Engineering football match.', 'culture', 'all', 0, 'normal'],
    ['Health camp on campus next Wednesday', 'Free health screening, eye check-up and vaccination drive at Bengaluru HQ from 09:00 to 16:00.', 'health', 'all', 0, 'normal'],
    ['Engineering freeze before the v2 launch', 'Code freeze from 28 September to 2 October. Only P0 hotfixes will be merged during the window.', 'engineering', 'Engineering', 0, 'normal']
  ];
  announcements.forEach((a, i) => {
    insert('announcements', {
      company_id: companyId,
      title: a[0],
      body: a[1],
      category: a[2],
      audience: a[3],
      pinned: a[4],
      priority: a[5],
      author_id: empId[a[2] === 'engineering' ? 'Ananya Sharma' : 'Priya Nair'],
      publish_at: new Date(addDays(TODAY, -i * 4 - 1) + 'T08:30:00Z').toISOString(),
      views: R.int(40, 480),
      created_at: new Date(addDays(TODAY, -i * 4 - 1) + 'T08:00:00Z').toISOString()
    });
  });

  // social wall -------------------------------------------------------------
  const postBodies = [
    'Shipped the biometric punch-in flow to 100% of mobile users this morning. Zero crashes in the first 3 hours. 🎉',
    'Grateful for the support crew that stayed back during Sunday’s release. Snacks are on me next time!',
    'Completed 5 years at NorthPeak today. From a 12-person startup to this — what a ride.',
    'Our QA guild ran a bug bash yesterday: 63 issues found, 41 fixed in the same sprint. Quality is a habit.',
    'New hire spotlight: welcome Aarti to the Operations team! She joins us from a logistics unicorn.',
    'Design review of the new leave calendar was fantastic. Shipping the mobile-first version next week.',
    'Customer NPS moved from 41 to 52 this quarter. Every support engineer deserves a high five. 🙌',
    'Ran my first internal workshop on secure coding — 38 attendees. Recording is in the knowledge base.',
    'Reminder: mental health day is a real leave type. Use it without guilt. 🌱',
    'The field sales team closed 14 new logos this month across three cities. Incredible hustle.',
    'Proud to announce NorthPeak crossed 1M monthly punches processed on HRMate.',
    'Coffee chat with the CEO tomorrow 16:00. Bring your toughest questions.',
    'Our new geofencing accuracy improvement cut false rejections by 71%. Metrics in the reports tab.',
    'Volunteered at the weekend coding bootcamp — 60 students, 12 projects, endless energy.',
    'Tip: the roster swap request now auto-suggests teammates with matching skills. Try it out.'
  ];
  const empIds = employees.map((e) => e.id);
  postBodies.forEach((body, i) => {
    const author = employees[R.int(0, employees.length - 1)];
    const postId = insert('posts', {
      company_id: companyId,
      employee_id: author.id,
      body,
      tag: R.pick(['general', 'wins', 'culture', 'engineering', 'milestone']),
      likes: 0,
      comments_count: 0,
      created_at: new Date(addDays(TODAY, -Math.floor(i / 2)) + `T${String(R.int(8, 19)).padStart(2, '0')}:${String(R.int(0, 59)).padStart(2, '0')}:00Z`).toISOString()
    });
    const likers = R.pickN(empIds, R.int(3, 22));
    for (const l of likers) insert('post_likes', { post_id: postId, employee_id: l });
    run('UPDATE posts SET likes = ? WHERE id = ?', likers.length, postId);
    const commentCount = R.int(0, 4);
    for (let c = 0; c < commentCount; c += 1) {
      insert('comments', {
        post_id: postId,
        employee_id: R.pick(empIds),
        body: R.pick(['Amazing work! 👏', 'This is exactly what our customers needed.', 'Congrats team!', 'Can you share the metrics deck?', 'Inspiring! 🚀', 'Well deserved 🙌']),
        created_at: new Date(addDays(TODAY, -Math.floor(i / 2)) + `T${String(R.int(9, 20)).padStart(2, '0')}:${String(R.int(0, 59)).padStart(2, '0')}:00Z`).toISOString()
      });
    }
    run('UPDATE posts SET comments_count = ? WHERE id = ?', commentCount, postId);
  });

  // kudos / star workers ----------------------------------------------------
  const values = ['Teamwork', 'Ownership', 'Customer First', 'Innovation', 'Integrity', 'Speed', 'Mentorship', 'Excellence'];
  const badges = ['🌟 Star Performer', '🤝 Team Player', '🚀 Go Getter', '🧠 Problem Solver', '💡 Innovator', '🎯 Goal Crusher'];
  for (let i = 0; i < 190; i += 1) {
    const from = employees[R.int(0, employees.length - 1)];
    let to = employees[R.int(0, employees.length - 1)];
    if (to.id === from.id) to = employees[(employees.indexOf(to) + 1) % employees.length];
    insert('kudos', {
      company_id: companyId,
      from_employee_id: from.id,
      to_employee_id: to.id,
      value: R.pick(values),
      message: R.pick([
        'Jumped in on a weekend escalation without being asked.',
        'Turned a furious customer into a reference account.',
        'Caught a payroll bug before it hit 2,000 payslips.',
        'Mentored two interns into full-time offers.',
        'Shipped the geofence fix a day early.',
        'Kept the standup honest and the backlog clean.'
      ]),
      points: R.pick([5, 5, 10, 10, 15, 20]),
      badge: R.chance(0.4) ? R.pick(badges) : null,
      created_at: new Date(addDays(TODAY, -R.int(0, 80)) + `T${String(R.int(9, 19)).padStart(2, '0')}:${String(R.int(0, 59)).padStart(2, '0')}:00Z`).toISOString()
    });
  }

  // helpdesk tickets --------------------------------------------------------
  const ticketCatalog = [
    ['Laptop not booting after update', 'it', 'high'],
    ['Need VPN access for client site', 'it', 'medium'],
    ['Payroll shows wrong tax deduction', 'payroll', 'high'],
    ['Request additional monitor', 'facilities', 'low'],
    ['Access to Salesforce sandbox', 'it', 'medium'],
    ['Salary slip not downloaded', 'payroll', 'medium'],
    ['Visitor pass for client meeting', 'admin', 'low'],
    ['Biometric device not registering my fingerprint', 'it', 'high'],
    ['Leave balance looks incorrect', 'hr', 'medium'],
    ['Cab reimbursement pending since last month', 'finance', 'medium'],
    ['New joiner laptop setup', 'it', 'medium'],
    ['ID card lost — need replacement', 'admin', 'low'],
    ['Air conditioning issue on 4th floor', 'facilities', 'low'],
    ['SSO login failing on mobile app', 'it', 'high'],
    ['Request work from home exception', 'hr', 'low']
  ];
  for (let i = 0; i < 54; i += 1) {
    const t = ticketCatalog[i % ticketCatalog.length];
    const requester = employees[R.int(0, employees.length - 1)];
    const status = R.pick(['open', 'open', 'in_progress', 'in_progress', 'resolved', 'resolved', 'closed', 'escalated']);
    const createdAt = new Date(addDays(TODAY, -R.int(0, 45)) + `T${String(R.int(9, 18)).padStart(2, '0')}:${String(R.int(0, 59)).padStart(2, '0')}:00Z`).toISOString();
    const ticketId = insert('tickets', {
      company_id: companyId,
      employee_id: requester.id,
      assignee_id: R.chance(0.75) ? empId[R.pick(['Sunil Verma', 'Nisha Rawat', 'Prakash Reddy', 'Sneha Kulkarni'])] : null,
      subject: `${t[0]}${i > ticketCatalog.length - 1 ? ` (#${i})` : ''}`,
      body: `Raised via the HRMate mobile app. Priority: ${t[2]}. Requester department: ${requester.deptName}.`,
      category: t[1],
      priority: t[2],
      status,
      due_date: addDays(TODAY, R.int(-5, 7)),
      resolved_at: ['resolved', 'closed'].includes(status) ? new Date(addDays(TODAY, -R.int(0, 5)) + 'T14:00:00Z').toISOString() : null,
      rating: ['resolved', 'closed'].includes(status) && R.chance(0.7) ? R.int(3, 5) : null,
      created_at: createdAt,
      updated_at: createdAt
    });
    const commentCount = R.int(0, 3);
    for (let c = 0; c < commentCount; c += 1) {
      insert('comments', {
        ticket_id: ticketId,
        employee_id: R.pick([empId['Sunil Verma'], empId['Nisha Rawat'], empId['Prakash Reddy'], requester.id]),
        body: R.pick([
          'Acknowledged — looking into this now.',
          'Can you share a screenshot of the error?',
          'Replacement device has been dispatched, ETA 2 days.',
          'Fixed in the latest patch, please re-login.',
          'Escalating to the vendor for a same-day response.',
          'Closing this out — feel free to reopen if it recurs.'
        ]),
        created_at: new Date(addDays(TODAY, -R.int(0, 10)) + 'T15:00:00Z').toISOString()
      });
    }
  }

  // devices -----------------------------------------------------------------
  const platforms = [
    ['iOS', 'iPhone 15 Pro'],
    ['iOS', 'iPhone 13'],
    ['Android', 'Samsung Galaxy S24'],
    ['Android', 'Google Pixel 8'],
    ['Android', 'OnePlus 12'],
    ['iPadOS', 'iPad Air'],
    ['Android', 'Xiaomi 14']
  ];
  for (const e of employees) {
    const count = R.int(1, 3);
    for (let i = 0; i < count; i += 1) {
      const [platform, model] = R.pick(platforms);
      const status = R.chance(0.86) ? 'trusted' : R.pick(['pending', 'blocked', 'revoked']);
      const loc = LOCATIONS.find((l) => l.name === locKey(e.locName));
      insert('devices', {
        company_id: companyId,
        employee_id: e.id,
        label: `${e.first.split(' ')[0]}’s ${model.split(' ')[0]}${i > 0 ? ` ${i + 1}` : ''}`,
        platform,
        model,
        app_version: `4.${R.int(0, 9)}.${R.int(0, 9)}`,
        status,
        trusted: status === 'trusted' ? 1 : 0,
        fingerprint_enrolled: R.chance(0.7) ? 1 : 0,
        face_enrolled: R.chance(0.65) ? 1 : 0,
        last_lat: loc.lat,
        last_lng: loc.lng,
        last_seen_at: new Date(addDays(TODAY, -R.int(0, 6)) + `T${String(R.int(8, 20)).padStart(2, '0')}:${String(R.int(0, 59)).padStart(2, '0')}:00Z`).toISOString(),
        enrolled_at: new Date(addDays(e.joinDate, R.int(0, 40)) + 'T10:00:00Z').toISOString(),
        revoked_at: status === 'revoked' ? nowIso() : null,
        revoked_reason: status === 'revoked' ? 'Device lost / replaced' : null
      });
    }
  }

  // swap requests, overtime, expenses --------------------------------------
  for (let i = 0; i < 14; i += 1) {
    const e = employees[R.int(0, employees.length - 1)];
    const withEmp = employees[R.int(0, employees.length - 1)];
    const date = addDays(TODAY, R.int(-10, 14));
    const id = insert('swap_requests', {
      company_id: companyId,
      employee_id: e.id,
      with_employee_id: withEmp.id !== e.id ? withEmp.id : null,
      date,
      shift_id: shiftId[e.shiftName],
      reason: R.pick(['Medical appointment', 'Family commitment', 'Travel planned', 'Personal work']),
      status: R.pick(['pending', 'pending', 'approved', 'rejected']),
      created_at: new Date(addDays(date, -R.int(1, 6)) + 'T09:00:00Z').toISOString()
    });
    insert('approvals', {
      company_id: companyId,
      type: 'shift_swap',
      ref_id: id,
      requester_id: e.id,
      approver_id: empId[PEOPLE.find((p) => `${p[0]} ${p[1]}` === e.key)?.[5]] || empId['Priya Nair'],
      summary: `Shift swap · ${date} · ${e.shiftName}`,
      status: get('SELECT status FROM swap_requests WHERE id = ?', id).status
    });
  }

  for (let i = 0; i < 26; i += 1) {
    const e = employees[R.int(0, employees.length - 1)];
    const date = addDays(TODAY, -R.int(0, 30));
    const id = insert('overtime_requests', {
      company_id: companyId,
      employee_id: e.id,
      date,
      minutes: R.pick([30, 45, 60, 90, 120, 150]),
      reason: R.pick(['Release support', 'Month-end close', 'Client escalation', 'Incident response']),
      status: R.pick(['pending', 'approved', 'approved', 'rejected']),
      approver_id: empId[PEOPLE.find((p) => `${p[0]} ${p[1]}` === e.key)?.[5]] || empId['Priya Nair'],
      created_at: new Date(date + 'T19:00:00Z').toISOString()
    });
    insert('approvals', {
      company_id: companyId,
      type: 'overtime',
      ref_id: id,
      requester_id: e.id,
      approver_id: empId[PEOPLE.find((p) => `${p[0]} ${p[1]}` === e.key)?.[5]] || empId['Priya Nair'],
      summary: `Overtime · ${date}`,
      status: get('SELECT status FROM overtime_requests WHERE id = ?', id).status
    });
  }

  for (let i = 0; i < 30; i += 1) {
    const e = employees[R.int(0, employees.length - 1)];
    const id = insert('expenses', {
      company_id: companyId,
      employee_id: e.id,
      category: R.pick(['Travel', 'Client meals', 'Software', 'Cab', 'Training', 'Equipment']),
      amount: R.int(450, 48000),
      currency: 'INR',
      date: addDays(TODAY, -R.int(0, 40)),
      description: R.pick(['Client visit — Pune', 'Team lunch after release', 'AWS training certification', 'Airport cab', 'Design tool licence', 'Monitor stand']),
      status: R.pick(['pending', 'approved', 'approved', 'rejected', 'paid']),
      approver_id: empId[PEOPLE.find((p) => `${p[0]} ${p[1]}` === e.key)?.[5]] || empId['Rakesh Sinha'],
      created_at: nowIso()
    });
    insert('approvals', {
      company_id: companyId,
      type: 'expense',
      ref_id: id,
      requester_id: e.id,
      approver_id: empId[PEOPLE.find((p) => `${p[0]} ${p[1]}` === e.key)?.[5]] || empId['Rakesh Sinha'],
      summary: `Expense · ${get('SELECT category FROM expenses WHERE id = ?', id).category}`,
      status: get('SELECT status FROM expenses WHERE id = ?', id).status
    });
  }

  // calendar events ---------------------------------------------------------
  const eventCatalog = [
    ['Sprint planning', 'meeting', 1],
    ['All hands town hall', 'meeting', 2],
    ['1:1 with manager', 'meeting', 0],
    ['Design review — leave calendar', 'review', 1],
    ['Mandatory POSH training', 'training', 1],
    ['Quarterly business review', 'meeting', 2],
    ['Team lunch', 'culture', 0],
    ['Security & compliance refresher', 'training', 1],
    ['Customer advisory board', 'customer', 1],
    ['Release dry run', 'engineering', 0],
    ['Birthday celebrations', 'culture', 0],
    ['Interview panel — Senior Engineer', 'hiring', 0]
  ];
  for (let i = 0; i < 42; i += 1) {
    const [title, kind] = eventCatalog[i % eventCatalog.length];
    const date = addDays(TODAY, R.int(-14, 21));
    insert('events', {
      company_id: companyId,
      title,
      description: `${title} — scheduled by the ${kind} team.`,
      date,
      start_time: R.pick(['09:30', '10:00', '11:00', '14:00', '15:30', '16:00']),
      end_time: R.pick(['10:30', '11:00', '12:00', '15:00', '16:30', '17:00']),
      kind,
      location: R.pick(['Bengaluru HQ — Floor 4', 'Zoom', 'Pune Campus — Boardroom', 'Google Meet', 'Noida Hub — Training Room']),
      organizer_id: R.pick(empIds),
      color: R.pick(['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899']),
      attendees: R.pickN(empIds, R.int(2, 8))
    });
  }

  // notifications -----------------------------------------------------------
  const notifTemplates = [
    ['leave', 'Leave approved', 'Your Casual Leave for next week was approved by your manager.', '✅', '#/leaves'],
    ['attendance', 'Missed punch detected', 'You did not punch out yesterday. Regularise it to avoid loss of pay.', '⏰', '#/attendance'],
    ['announcement', 'New company announcement', 'Q3 results are out — 22% YoY growth.', '📣', '#/announcements'],
    ['approval', 'Approval waiting for you', '2 requests need your decision today.', '🧾', '#/approvals'],
    ['kudos', 'You received kudos', 'Meera Iyer recognised you for Ownership.', '🌟', '#/star-workers'],
    ['ticket', 'Ticket updated', 'IT replied on "Laptop not booting after update".', '🎫', '#/helpdesk'],
    ['shift', 'Roster published', 'Your roster for next week is now available.', '🗓️', '#/roster'],
    ['security', 'New device signed in', 'A new Android device was enrolled to your account.', '🔐', '#/devices'],
    ['goal', 'Key result updated', 'Progress moved to 72% on your top KRA.', '🎯', '#/goals'],
    ['document', 'Document expiring soon', 'Your passport expires in 30 days. Upload a renewed copy.', '📄', '#/documents']
  ];
  for (const e of employees) {
    const count = R.int(4, 10);
    for (let i = 0; i < count; i += 1) {
      const t = R.pick(notifTemplates);
      insert('notifications', {
        company_id: companyId,
        employee_id: e.id,
        type: t[0],
        title: t[1],
        body: t[2],
        icon: t[3],
        link: t[4],
        read: R.chance(0.55) ? 1 : 0,
        priority: R.chance(0.15) ? 'high' : 'normal',
        created_at: new Date(addDays(TODAY, -R.int(0, 9)) + `T${String(R.int(7, 21)).padStart(2, '0')}:${String(R.int(0, 59)).padStart(2, '0')}:00Z`).toISOString()
      });
    }
  }

  // audit logs --------------------------------------------------------------
  const auditActions = [
    ['employee.update', 'employee', 'Updated employment details'],
    ['attendance.regularize', 'attendance', 'Regularised a missed punch'],
    ['leave.approve', 'leave', 'Approved leave request'],
    ['leave.reject', 'leave', 'Rejected leave request'],
    ['employee.create', 'employee', 'Onboarded new employee'],
    ['shift.update', 'shift', 'Changed shift timings'],
    ['roster.publish', 'roster', 'Published weekly roster'],
    ['login', 'session', 'Signed in from mobile app'],
    ['document.verify', 'document', 'Verified KYC document'],
    ['device.revoke', 'device', 'Revoked device access'],
    ['settings.update', 'company', 'Updated company policy settings'],
    ['review.publish', 'review', 'Published performance review'],
    ['export.run', 'report', 'Exported attendance report']
  ];
  for (let i = 0; i < 240; i += 1) {
    const a = R.pick(auditActions);
    const actor = employees[R.int(0, employees.length - 1)];
    insert('audit_logs', {
      company_id: companyId,
      actor_id: actor.id,
      actor_name: `${actor.first} ${actor.last}`,
      action: a[0],
      entity: a[1],
      entity_id: R.int(1, 60),
      summary: `${a[2]} — ${actor.designation}`,
      meta: { via: R.pick(['mobile-app', 'web', 'api']), ua: 'HRMate/4.2' },
      ip: `10.20.${R.int(1, 40)}.${R.int(2, 250)}`,
      severity: R.chance(0.08) ? 'warning' : 'info',
      created_at: new Date(addDays(TODAY, -R.int(0, 45)) + `T${String(R.int(8, 20)).padStart(2, '0')}:${String(R.int(0, 59)).padStart(2, '0')}:00Z`).toISOString()
    });
  }

  // company settings --------------------------------------------------------
  const settings = {
    attendance_auto_regularize: '0',
    punch_methods: '["gps","face","fingerprint","pin","qr","manual"]',
    biometric_required_roles: '["supervisor","team_leader","employee"]',
    allow_selfie_punch: '1',
    geofence_strictness: 'moderate',
    overtime_multiplier: '2',
    late_deduction_after_min: '45',
    probation_months: '6',
    notice_period_days: '60',
    appraisal_cycles: '2',
    kudos_enabled: '1',
    social_wall_enabled: '1',
    helpdesk_sla_hours: '24',
    data_retention_months: '84',
    two_factor_required: '1',
    session_timeout_hours: '336',
    locales: '["en","es","hi","fr","ar","de","pt"]',
    default_locale: 'en',
    payroll_day: '1'
  };
  for (const [k, v] of Object.entries(settings)) insert('settings', { key: k, value: v, updated_at: nowIso() });

  polishDemoAccounts();

  // Make the seven demo logins feel alive right now: four are clocked in,
  // three are still waiting to punch in (fresh CTA on first load).
  function polishDemoAccounts() {
    const personas = [
      'aarav.mehta@northpeak.io',
      'priya.nair@northpeak.io',
      'rohan.deshmukh@northpeak.io',
      'ananya.sharma@northpeak.io',
      'vikram.rao@northpeak.io',
      'meera.iyer@northpeak.io',
      'kabir.malhotra@northpeak.io'
    ];
    personas.forEach((email, idx) => {
      const emp = get('SELECT * FROM employees WHERE email = ?', email);
      if (!emp) return;
      const shift = get('SELECT * FROM shifts WHERE id = ?', emp.shift_id);
      // ensure today is a scheduled working day for the demo accounts
      const rosterRow = get('SELECT * FROM roster WHERE employee_id = ? AND date = ?', emp.id, TODAY);
      if (rosterRow) {
        run('UPDATE roster SET kind = ?, shift_id = ? WHERE id = ?', 'work', emp.shift_id, rosterRow.id);
      } else {
        insert('roster', { company_id: companyId, employee_id: emp.id, shift_id: emp.shift_id, date: TODAY, kind: 'work', published: 1 });
      }
      const att = get('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', emp.id, TODAY);
      if (idx < 4) {
        const [sh, sm] = shift.start_time.split(':').map(Number);
        const inMinutes = sh * 60 + sm + R.int(-12, 14);
        const inDate = new Date(TODAY + 'T00:00:00Z');
        inDate.setUTCMinutes(inMinutes);
        const firstIn = inDate.toISOString();
        const loc = LOCATIONS.find((l) => l.name === locKey(emp.city === 'Noida' ? 'Noida Hub' : emp.city === 'Pune' ? 'Pune Campus' : 'Bengaluru HQ'));
        const payload = {
          company_id: companyId,
          employee_id: emp.id,
          date: TODAY,
          shift_id: shift.id,
          first_in: firstIn,
          last_out: null,
          work_minutes: Math.max(0, Math.round((Date.now() - inDate.getTime()) / 60000)),
          status: 'present',
          in_method: 'face',
          in_lat: loc.latitude,
          in_lng: loc.longitude,
          in_accuracy: 9.4,
          in_location_id: locId[loc.name],
          geofence_ok: 1,
          break_minutes: 0
        };
        if (att) {
          run('DELETE FROM attendance WHERE id = ?', att.id);
        }
        const newId = insert('attendance', payload);
        insert('punches', {
          company_id: companyId,
          employee_id: emp.id,
          attendance_id: newId,
          type: 'in',
          at: firstIn,
          method: 'face',
          lat: loc.latitude,
          lng: loc.longitude,
          accuracy: 9.4,
          distance_m: R.float(4, 60, 1),
          geofence_ok: 1,
          face_score: 0.972,
          ip: '10.20.4.88'
        });
      } else if (att) {
        run('DELETE FROM attendance WHERE id = ?', att.id);
      }
    });
  }

  const stats = {
    companies: one('SELECT COUNT(*) FROM companies'),
    employees: one('SELECT COUNT(*) FROM employees'),
    attendance: one('SELECT COUNT(*) FROM attendance'),
    punches: one('SELECT COUNT(*) FROM punches'),
    roster: one('SELECT COUNT(*) FROM roster'),
    leaveRequests: one('SELECT COUNT(*) FROM leave_requests'),
    documents: one('SELECT COUNT(*) FROM documents'),
    goals: one('SELECT COUNT(*) FROM goals'),
    reviews: one('SELECT COUNT(*) FROM reviews'),
    tickets: one('SELECT COUNT(*) FROM tickets'),
    kudos: one('SELECT COUNT(*) FROM kudos'),
    devices: one('SELECT COUNT(*) FROM devices'),
    notifications: one('SELECT COUNT(*) FROM notifications'),
    auditLogs: one('SELECT COUNT(*) FROM audit_logs')
  };
  return { skipped: false, companyId, stats };
}

export { TODAY };
