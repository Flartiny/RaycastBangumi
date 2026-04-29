import { OAuth, getPreferenceValues } from "@raycast/api";

interface Preferences {
  accessToken: string;
}

const CLIENT_ID = process.env.CLIENT_ID || "";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "";

export const oauthClient = new OAuth.PKCEClient({
  redirectMethod: OAuth.RedirectMethod.Web,
  providerName: "Bangumi",
  providerIcon: "extension-icon.png",
  providerId: "bangumi",
  description: "登录 Bangumi 账户以使用收藏等高级功能",
});

export async function isLoggedIn(): Promise<boolean> {
  const tokens = await oauthClient.getTokens();
  return !!tokens?.accessToken;
}

/** Returns the current access token, trying OAuth first then manual preference */
export async function getAccessToken(): Promise<string> {
  const tokens = await oauthClient.getTokens();
  if (tokens?.accessToken) {
    return tokens.accessToken;
  }
  // Fallback to manual token from preferences
  const { accessToken } = getPreferenceValues<Preferences>();
  return accessToken || "";
}

/** Start the OAuth login flow. Returns true on success. */
export async function login(): Promise<boolean> {
  try {
    const authRequest = await oauthClient.authorizationRequest({
      endpoint: "https://bgm.tv/oauth/authorize",
      clientId: CLIENT_ID,
      scope: "",
    });

    const { authorizationCode } = await oauthClient.authorize(authRequest);

    const tokenResponse = await fetchTokens(authRequest, authorizationCode);

    await oauthClient.setTokens(tokenResponse);
    return true;
  } catch (error) {
    console.error("OAuth login failed:", error);
    return false;
  }
}

export async function logout(): Promise<void> {
  await oauthClient.removeTokens();
}

async function fetchTokens(
  authRequest: OAuth.AuthorizationRequest,
  code: string,
): Promise<OAuth.TokenResponse> {
  const response = await fetch("https://bgm.tv/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: authRequest.redirectURI,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
    token_type: string;
    refresh_token: string;
    user_id: number;
  };

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  } satisfies OAuth.TokenResponse;
}
