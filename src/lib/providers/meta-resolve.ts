/**
 * Resolve Instagram Business Account ID from a Meta access token so users
 * can leave the field blank (same UX as "optional — auto-detected" flows).
 *
 * Instagram **send** API (`POST /{ig-user-id}/messages`) requires a **Page**
 * access token for the Facebook Page linked to that IG business account.
 * User tokens often produce OAuth 190 "Cannot parse access token" or
 * permission errors — `resolveInstagramPageAccessToken` fixes that.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

async function graphGet(
  path: string,
  accessToken: string,
): Promise<Record<string, unknown> | null> {
  const token = accessToken.trim();
  if (!token) return null;
  const sep = path.includes("?") ? "&" : "?";
  const url = `${GRAPH}${path}${sep}access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown>;
}

export async function resolveInstagramBusinessUserId(
  accessToken: string,
): Promise<string | null> {
  const token = accessToken.trim();
  if (!token) return null;

  const me = await graphGet("/me?fields=id,instagram_business_account{id}", token);
  const igObj = me?.instagram_business_account as { id?: string } | undefined;
  if (igObj?.id) return String(igObj.id);

  const accounts = await graphGet(
    "/me/accounts?fields=instagram_business_account{id}",
    token,
  );
  const rows = (accounts?.data as Array<Record<string, unknown>>) ?? [];
  for (const row of rows) {
    const nested = row.instagram_business_account as { id?: string } | undefined;
    if (nested?.id) return String(nested.id);
  }

  return null;
}

/**
 * Pick the **Page** access token whose linked `instagram_business_account.id`
 * matches `instagramBusinessAccountId`. Required for `/{ig-id}/messages`.
 */
export async function resolveInstagramPageAccessToken(
  accessToken: string,
  instagramBusinessAccountId: string,
): Promise<string | null> {
  const igTarget = instagramBusinessAccountId.trim();
  if (!igTarget) return null;

  const me = await graphGet(
    "/me?fields=access_token,id,instagram_business_account{id}",
    accessToken,
  );
  const meIg = me?.instagram_business_account as { id?: string } | undefined;
  if (meIg?.id && String(meIg.id) === igTarget) {
    const at = me?.access_token;
    if (typeof at === "string" && at.trim()) return at.trim();
  }

  const accounts = await graphGet(
    "/me/accounts?fields=id,access_token,instagram_business_account{id}",
    accessToken,
  );
  const rows = (accounts?.data as Array<Record<string, unknown>>) ?? [];
  for (const row of rows) {
    const nested = row.instagram_business_account as { id?: string } | undefined;
    if (nested?.id && String(nested.id) === igTarget) {
      const at = row.access_token;
      if (typeof at === "string" && at.trim()) return at.trim();
    }
  }

  return null;
}

/** Our IG business account @handle + display name (for dashboard labels). */
export async function fetchInstagramBusinessAccountProfile(
  pageAccessToken: string,
  instagramBusinessAccountId: string,
): Promise<{ username?: string; name?: string } | null> {
  const id = instagramBusinessAccountId.trim();
  const token = pageAccessToken.trim();
  if (!id || !token) return null;
  const url = `${GRAPH}/${encodeURIComponent(id)}?fields=username,name&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const j = (await res.json()) as { username?: string; name?: string };
  if (!j.username && !j.name) return null;
  return { username: j.username, name: j.name };
}

export type InstagramScopedParticipant = {
  label: string | null;
  /** HTTPS URL suitable for `<img src>` (Meta CDN). */
  profilePicUrl: string | null;
};

/** Customer in an IG DM thread (IG-scoped user id from webhooks). */
export async function fetchInstagramScopedParticipant(
  pageAccessToken: string,
  instagramScopedUserId: string,
): Promise<InstagramScopedParticipant | null> {
  const sid = instagramScopedUserId.trim();
  const token = pageAccessToken.trim();
  if (!sid || !token) return null;
  const url = `${GRAPH}/${encodeURIComponent(sid)}?fields=username,name,profile_pic&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const j = (await res.json()) as {
    username?: string;
    name?: string;
    profile_pic?: string;
  };
  let label: string | null = null;
  if (j.username) label = `@${String(j.username).replace(/^@/, "")}`;
  else if (j.name) label = j.name;
  const profilePicUrl =
    typeof j.profile_pic === "string" && j.profile_pic.startsWith("http")
      ? j.profile_pic
      : null;
  if (!label && !profilePicUrl) return null;
  return { label, profilePicUrl };
}

export async function fetchMessengerPageName(
  pageAccessToken: string,
  pageId: string,
): Promise<string | null> {
  const pid = pageId.trim();
  const token = pageAccessToken.trim();
  if (!pid || !token) return null;
  const url = `${GRAPH}/${encodeURIComponent(pid)}?fields=name&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const j = (await res.json()) as { name?: string };
  return j.name?.trim() || null;
}
