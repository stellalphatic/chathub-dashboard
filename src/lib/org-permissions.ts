/**
 * Organization-scoped RBAC (business dashboard).
 *
 * Platform staff (`user.platform_admin`) still bypasses these checks where
 * noted in `org-access` — they are not `organization_member` rows.
 */

export const ORG_MEMBER_ROLES = [
  "owner",
  "admin",
  "editor",
  "viewer",
  "agent",
] as const;

export type OrgMemberRole = (typeof ORG_MEMBER_ROLES)[number];

/** Human-readable labels for role pickers (staff console + team page). */
export const ORG_ROLE_LABELS: Record<OrgMemberRole, string> = {
  owner: "Owner — full access + manage team",
  admin: "Admin — full access + manage team",
  editor: "Editor — configure bot & channels, no team admin",
  viewer: "Viewer — read-only (e.g. demos)",
  agent: "Agent — inbox & customers only",
};

export type OrgSection =
  | "overview"
  | "inbox"
  | "crm"
  | "team"
  | "bot"
  | "knowledge"
  | "channels"
  | "templates"
  | "broadcasts";

export type OrgSectionAccess = { view: boolean; edit: boolean };

export type OrgPermissionMap = Record<OrgSection, OrgSectionAccess>;

const ALL: OrgSectionAccess = { view: true, edit: true };
const VIEW: OrgSectionAccess = { view: true, edit: false };
const NONE: OrgSectionAccess = { view: false, edit: false };

function fullAccess(): OrgPermissionMap {
  return {
    overview: ALL,
    inbox: ALL,
    crm: ALL,
    team: ALL,
    bot: ALL,
    knowledge: ALL,
    channels: ALL,
    templates: ALL,
    broadcasts: ALL,
  };
}

/** Maps DB role string → UI permissions. Unknown / legacy values → agent. */
export function normalizeOrgMemberRole(raw: string | null | undefined): OrgMemberRole {
  const r = (raw ?? "agent").toLowerCase().trim();
  if (ORG_MEMBER_ROLES.includes(r as OrgMemberRole)) return r as OrgMemberRole;
  // legacy rows from older builds
  if (r === "member") return "agent";
  return "agent";
}

export function buildPermissionMap(
  memberRole: OrgMemberRole | null,
  opts: { isPlatformAdmin: boolean; isOrgMember: boolean },
): { permissions: OrgPermissionMap; canManageOrgMembers: boolean } {
  if (opts.isPlatformAdmin) {
    return { permissions: fullAccess(), canManageOrgMembers: true };
  }
  if (!opts.isOrgMember || !memberRole) {
    const dead: OrgPermissionMap = {
      overview: NONE,
      inbox: NONE,
      crm: NONE,
      team: NONE,
      bot: NONE,
      knowledge: NONE,
      channels: NONE,
      templates: NONE,
      broadcasts: NONE,
    };
    return { permissions: dead, canManageOrgMembers: false };
  }

  switch (memberRole) {
    case "owner":
    case "admin":
      return { permissions: fullAccess(), canManageOrgMembers: true };
    case "editor":
      return {
        permissions: {
          overview: ALL,
          inbox: ALL,
          crm: ALL,
          team: VIEW,
          bot: ALL,
          knowledge: ALL,
          channels: ALL,
          templates: ALL,
          broadcasts: ALL,
        },
        canManageOrgMembers: false,
      };
    case "viewer":
      return {
        permissions: {
          overview: VIEW,
          inbox: VIEW,
          crm: VIEW,
          team: VIEW,
          bot: VIEW,
          knowledge: VIEW,
          channels: VIEW,
          templates: VIEW,
          broadcasts: VIEW,
        },
        canManageOrgMembers: false,
      };
    case "agent":
    default:
      return {
        permissions: {
          overview: ALL,
          inbox: ALL,
          crm: ALL,
          team: VIEW,
          bot: NONE,
          knowledge: NONE,
          channels: NONE,
          templates: NONE,
          broadcasts: NONE,
        },
        canManageOrgMembers: false,
      };
  }
}

export function canUseSection(
  map: OrgPermissionMap,
  section: OrgSection,
  mode: "view" | "edit",
): boolean {
  const p = map[section];
  if (!p) return false;
  return mode === "view" ? p.view : p.edit;
}

export function isOrgOwnerOrAdminRole(role: OrgMemberRole): boolean {
  return role === "owner" || role === "admin";
}
