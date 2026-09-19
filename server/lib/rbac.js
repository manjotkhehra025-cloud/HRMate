// ---------------------------------------------------------------------------
// Role based access control. 7 roles, permission keys + data scope.
// ---------------------------------------------------------------------------
export const ROLES = [
  { key: 'super_admin', label: 'Super Admin', level: 100, icon: 'shield', scope: 'system', color: 'violet' },
  { key: 'hr_admin', label: 'HR Admin', level: 90, icon: 'users-gear', scope: 'company', color: 'indigo' },
  { key: 'hr_manager', label: 'HR Manager', level: 80, icon: 'id-card', scope: 'company', color: 'sky' },
  { key: 'dept_manager', label: 'Department Manager', level: 70, icon: 'sitemap', scope: 'department', color: 'teal' },
  { key: 'supervisor', label: 'Supervisor', level: 60, icon: 'clipboard-check', scope: 'team', color: 'amber' },
  { key: 'team_leader', label: 'Team Leader', level: 50, icon: 'flag', scope: 'team', color: 'orange' },
  { key: 'employee', label: 'Employee', level: 10, icon: 'user', scope: 'self', color: 'slate' }
];

export const ROLE_KEYS = ROLES.map((r) => r.key);

export const roleMeta = (key) => ROLES.find((r) => r.key === key) || ROLES[ROLES.length - 1];

const P = {
  // employees / directory
  'employee.view_self': true,
  'employee.edit_self': true,
  'employee.view_team': true,
  'employee.view_company': true,
  'employee.view_sensitive': true,
  'employee.create': true,
  'employee.update': true,
  'employee.delete': true,
  'employee.export': true,
  // attendance
  'attendance.punch': true,
  'attendance.view_self': true,
  'attendance.view_team': true,
  'attendance.view_company': true,
  'attendance.regularize': true,
  'attendance.edit_any': true,
  // leave
  'leave.request': true,
  'leave.cancel': true,
  'leave.approve': true,
  'leave.view_team': true,
  'leave.view_company': true,
  'leave.manage_types': true,
  // shifts / roster
  'shift.view': true,
  'shift.manage': true,
  'roster.view_self': true,
  'roster.view_team': true,
  'roster.view_company': true,
  'roster.manage': true,
  'roster.swap_request': true,
  'roster.swap_approve': true,
  // approvals
  'approval.view_own': true,
  'approval.inbox': true,
  'approval.approve': true,
  // documents & kyc
  'document.view_self': true,
  'document.upload_self': true,
  'document.view_team': true,
  'document.view_company': true,
  'document.verify': true,
  'document.delete': true,
  'kyc.review': true,
  // performance
  'goal.view_self': true,
  'goal.manage_self': true,
  'goal.view_team': true,
  'goal.manage_team': true,
  'goal.manage_company': true,
  'performance.view_self': true,
  'performance.view_team': true,
  'performance.manage': true,
  // communication
  'post.create': true,
  'post.delete_any': true,
  'announcement.view': true,
  'announcement.manage': true,
  'kudos.give': true,
  'kudos.view_leaderboard': true,
  // helpdesk
  'ticket.create': true,
  'ticket.view_own': true,
  'ticket.assign': true,
  'ticket.view_all': true,
  // reports / analytics
  'report.team': true,
  'report.company': true,
  'report.payroll': true,
  // admin
  'admin.company': true,
  'admin.departments': true,
  'admin.locations': true,
  'admin.roles': true,
  'admin.settings': true,
  'devices.manage': true,
  'devices.view_self': true,
  'audit.view': true,
  'audit.view_all': true
};

const base = ['employee.view_self', 'employee.edit_self', 'employee.view_company', 'attendance.punch', 'attendance.view_self', 'leave.request', 'leave.cancel', 'shift.view', 'roster.view_self', 'roster.swap_request', 'approval.view_own', 'document.view_self', 'document.upload_self', 'goal.view_self', 'goal.manage_self', 'performance.view_self', 'post.create', 'announcement.view', 'kudos.give', 'kudos.view_leaderboard', 'ticket.create', 'ticket.view_own', 'devices.view_self'];

export const ROLE_PERMISSIONS = {
  employee: [...base],
  team_leader: [
    ...base,
    'employee.view_team', 'attendance.view_team', 'leave.approve', 'leave.view_team',
    'roster.view_team', 'roster.manage', 'roster.swap_approve', 'approval.inbox', 'approval.approve',
    'document.view_team', 'goal.view_team', 'goal.manage_team', 'performance.view_team',
    'ticket.assign', 'report.team'
  ],
  supervisor: [
    ...base,
    'employee.view_team', 'attendance.view_team', 'attendance.regularize', 'leave.approve', 'leave.view_team',
    'roster.view_team', 'roster.manage', 'roster.swap_approve', 'approval.inbox', 'approval.approve',
    'document.view_team', 'goal.view_team', 'goal.manage_team', 'performance.view_team',
    'ticket.assign', 'report.team'
  ],
  dept_manager: [
    ...base,
    'employee.view_team', 'attendance.view_team', 'attendance.regularize', 'leave.approve', 'leave.view_team',
    'shift.view', 'roster.view_team', 'roster.manage', 'roster.swap_approve', 'approval.inbox', 'approval.approve',
    'document.view_team', 'goal.view_team', 'goal.manage_team', 'performance.view_team', 'performance.manage',
    'ticket.assign', 'ticket.view_all', 'report.team', 'announcement.manage'
  ],
  hr_manager: [
    ...base,
    'employee.view_company', 'employee.view_sensitive', 'employee.create', 'employee.update',
    'attendance.view_company', 'attendance.regularize', 'attendance.edit_any',
    'leave.approve', 'leave.view_company', 'shift.manage', 'roster.view_company', 'roster.manage', 'roster.swap_approve',
    'approval.inbox', 'approval.approve', 'document.view_company', 'document.verify', 'kyc.review',
    'goal.manage_company', 'performance.manage', 'performance.view_team',
    'post.delete_any', 'announcement.manage', 'ticket.view_all', 'ticket.assign',
    'report.team', 'report.company', 'employee.export'
  ],
  hr_admin: [
    ...base,
    'employee.view_company', 'employee.view_sensitive', 'employee.create', 'employee.update', 'employee.delete', 'employee.export',
    'attendance.view_company', 'attendance.regularize', 'attendance.edit_any',
    'leave.approve', 'leave.view_company', 'leave.manage_types', 'shift.manage',
    'roster.view_company', 'roster.manage', 'roster.swap_approve',
    'approval.inbox', 'approval.approve', 'document.view_company', 'document.verify', 'document.delete', 'kyc.review',
    'goal.manage_company', 'performance.manage', 'performance.view_team',
    'post.delete_any', 'announcement.manage', 'ticket.view_all', 'ticket.assign',
    'report.team', 'report.company', 'report.payroll',
    'admin.company', 'admin.settings', 'admin.departments', 'admin.locations',
    'devices.manage', 'audit.view', 'audit.view_all'
  ],
  super_admin: Object.keys(P)
};

export const PERMISSION_GROUPS = [
  {
    key: 'people',
    label: 'People',
    perms: ['employee.view_self', 'employee.edit_self', 'employee.view_team', 'employee.view_company', 'employee.view_sensitive', 'employee.create', 'employee.update', 'employee.delete', 'employee.export']
  },
  {
    key: 'attendance',
    label: 'Attendance & Workforce',
    perms: ['attendance.punch', 'attendance.view_self', 'attendance.view_team', 'attendance.view_company', 'attendance.regularize', 'attendance.edit_any', 'shift.view', 'shift.manage', 'roster.view_self', 'roster.view_team', 'roster.view_company', 'roster.manage', 'roster.swap_request', 'roster.swap_approve']
  },
  {
    key: 'leave',
    label: 'Leave & Approvals',
    perms: ['leave.request', 'leave.cancel', 'leave.approve', 'leave.view_team', 'leave.view_company', 'leave.manage_types', 'approval.view_own', 'approval.inbox', 'approval.approve']
  },
  {
    key: 'records',
    label: 'Documents & KYC',
    perms: ['document.view_self', 'document.upload_self', 'document.view_team', 'document.view_company', 'document.verify', 'document.delete', 'kyc.review']
  },
  {
    key: 'performance',
    label: 'Performance & Goals',
    perms: ['goal.view_self', 'goal.manage_self', 'goal.view_team', 'goal.manage_team', 'goal.manage_company', 'performance.view_self', 'performance.view_team', 'performance.manage']
  },
  {
    key: 'engagement',
    label: 'Communication & Helpdesk',
    perms: ['post.create', 'post.delete_any', 'announcement.view', 'announcement.manage', 'kudos.give', 'kudos.view_leaderboard', 'ticket.create', 'ticket.view_own', 'ticket.assign', 'ticket.view_all']
  },
  {
    key: 'admin',
    label: 'Administration & Security',
    perms: ['report.team', 'report.company', 'report.payroll', 'admin.company', 'admin.departments', 'admin.locations', 'admin.roles', 'admin.settings', 'devices.manage', 'devices.view_self', 'audit.view', 'audit.view_all']
  }
];

export function can(actor, perm) {
  if (!actor) return false;
  if (actor.role === 'super_admin') return true;
  const list = ROLE_PERMISSIONS[actor.role] || [];
  return list.includes(perm);
}

export function scopeOf(actor) {
  return roleMeta(actor?.role).scope;
}

export function levelOf(role) {
  return roleMeta(role).level;
}
