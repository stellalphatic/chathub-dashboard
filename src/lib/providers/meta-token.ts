/**
 * Exchange a short-lived Meta user access token for a long-lived token (~60 days).
 * Same OAuth endpoint used for Instagram + Messenger apps.
 *
 * @see https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived
 */

const GRAPH = "https://graph.facebook.com/v21.0";

export type MetaTokenExchangeResult = {
  accessToken: string;
  expiresIn?: number;
};

export async function exchangeForLongLivedUserToken(opts: {
  appId: string;
  appSecret: string;
  shortLivedToken: string;
}): Promise<MetaTokenExchangeResult | null> {
  const clientId = opts.appId.trim();
  const clientSecret = opts.appSecret.trim();
  const fbExchangeToken = opts.shortLivedToken.trim();
  if (!clientId || !clientSecret || !fbExchangeToken) return null;

  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("fb_exchange_token", fbExchangeToken);

  const res = await fetch(url.toString());
  const raw = await res.text();
  if (!res.ok) {
    console.warn("[meta-token] exchange failed:", res.status, raw.slice(0, 200));
    return null;
  }
  let json: { access_token?: string; expires_in?: number };
  try {
    json = JSON.parse(raw) as { access_token?: string; expires_in?: number };
  } catch {
    return null;
  }
  if (!json.access_token) return null;
  return { accessToken: json.access_token, expiresIn: json.expires_in };
}
