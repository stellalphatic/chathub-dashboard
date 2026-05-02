/**
 * Resolve Instagram Business Account ID from a Meta access token so users
 * can leave the field blank (same UX as "optional — auto-detected" flows).
 */

const GRAPH = "https://graph.facebook.com/v21.0";

export async function resolveInstagramBusinessUserId(
  accessToken: string,
): Promise<string | null> {
  const token = accessToken.trim();
  if (!token) return null;

  async function getJson(path: string): Promise<Record<string, unknown> | null> {
    const sep = path.includes("?") ? "&" : "?";
    const url = `${GRAPH}${path}${sep}access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  }

  const me = await getJson("/me?fields=id,instagram_business_account{id}");
  const igObj = me?.instagram_business_account as { id?: string } | undefined;
  if (igObj?.id) return String(igObj.id);

  const accounts = await getJson("/me/accounts?fields=instagram_business_account{id}");
  const rows = (accounts?.data as Array<Record<string, unknown>>) ?? [];
  for (const row of rows) {
    const nested = row.instagram_business_account as { id?: string } | undefined;
    if (nested?.id) return String(nested.id);
  }

  return null;
}
