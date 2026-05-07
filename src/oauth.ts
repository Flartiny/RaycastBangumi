import { LocalStorage, OAuth } from "@raycast/api";
import { OAuthService } from "@raycast/utils";

const USERNAME_CACHE_KEY = "bangumi_username";

export const oauthClient = new OAuth.PKCEClient({
  redirectMethod: OAuth.RedirectMethod.AppURI,
  providerName: "Bangumi",
  providerIcon: "extension-icon.png",
  providerId: "bangumi",
  description: "登录 Bangumi 账户以使用收藏等高级功能",
});

const REFRESH_TOKEN_URL =
  "https://oauth.raycast.com/v1/refresh-token/sVkEaU9uSQj-x-jqMbDTgP7bmUu6YKKbFEcOslLZrJa_b1ww4E4SXW1d0t30PTGEXGOw2s3ghgg5ZfiYwYCe7z0GTYfFeB6J2XQN8VZnr3-klv4w2t0RYmyk5GQX1zw";

const bangumiOAuth = new OAuthService({
  client: oauthClient,
  clientId: "bgm602569f1d18f7f061",
  authorizeUrl:
    "https://oauth.raycast.com/v1/authorize/E2PP3iKmb5JlZ5QHnxr_pMS0eXVxfq8fni3yhSfEuTWP-9zrGQvNmMZFXMSZI5Z9rjbpTPAkrtcTdZa5MiqugJ_8pfKbv2FbrXwAGAhQJb8PmhzoWJOOwKAUXtk",
  tokenUrl:
    "https://oauth.raycast.com/v1/token/mRKNpPCabwMLkMaLp8LQ1quMeAlZbElU1E1kgfW-wxTda5wiUD5v8Ktx8tBTUSAQlYdKJUHYIVLf5o23cRuRhFS4L2TTDdUvq0qXGxvpPPC4tXNaPv9veC8qx3dgngs",
  refreshTokenUrl: REFRESH_TOKEN_URL,
  scope: "",
  bodyEncoding: "json",
  tokenResponseParser: (response) => {
    const data = response as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string | null;
      user_id?: number;
    };
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      ...(typeof data.scope === "string" ? { scope: data.scope } : {}),
    };
  },
  tokenRefreshResponseParser: (response) => {
    const data = response as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string | null;
    };
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      ...(typeof data.scope === "string" ? { scope: data.scope } : {}),
    };
  },
});

async function refreshTokens(refreshToken: string): Promise<OAuth.TokenResponse> {
  const res = await fetch(REFRESH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? refreshToken,
    expires_in: data.expires_in,
  };
}

/** Check login status without triggering OAuth flow */
export async function isLoggedIn(): Promise<boolean> {
  for (let i = 0; i < 3; i++) {
    try {
      const tokens = await oauthClient.getTokens();
      return !!tokens?.accessToken;
    } catch (e) {
      if (i === 2) {
        console.error("getTokens failed after 3 attempts:", e);
        return false;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return false;
}

/** Get a valid access token, refreshing if expired */
export async function getAccessToken(): Promise<string> {
  const tokenSet = await oauthClient.getTokens();
  if (tokenSet?.accessToken) {
    if (tokenSet.refreshToken && tokenSet.isExpired()) {
      try {
        const refreshed = await refreshTokens(tokenSet.refreshToken);
        await oauthClient.setTokens(refreshed);
        return refreshed.access_token;
      } catch (e) {
        console.error("Token refresh failed, falling back to re-auth:", e);
        // Fall through to OAuth flow
      }
    } else {
      return tokenSet.accessToken;
    }
  }
  // No tokens or refresh failed — trigger OAuth flow
  const token = await bangumiOAuth.authorize();
  return token ?? "";
}

/** Start OAuth login flow. Automatically retries on network errors. */
export async function login(): Promise<boolean> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await bangumiOAuth.authorize();
      fetchAndCacheUsername().catch(() => {});
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      if (msg.includes("ConnectTimeoutError") || msg.includes("fetch failed")) {
        console.error(`OAuth attempt ${attempt} failed:`, msg);
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
      }
      console.error("OAuth login failed:", error);
      return false;
    }
  }
  return false;
}

async function fetchAndCacheUsername() {
  try {
    const token = await bangumiOAuth.authorize();
    const res = await fetch("https://api.bgm.tv/v0/me", {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "RaycastBangumi/1.0",
      },
    });
    if (res.ok) {
      const data = (await res.json()) as { username: string };
      if (data.username) {
        await LocalStorage.setItem(USERNAME_CACHE_KEY, data.username);
      }
    }
  } catch {
    // non-critical, ignore
  }
}

/** Get username from cache (auto-detected on first login) */
export async function getUsername(): Promise<string> {
  const cached = await LocalStorage.getItem<string>(USERNAME_CACHE_KEY);
  return cached ?? "";
}

/** Remove stored tokens (also available via Raycast Settings) */
export async function logout(): Promise<void> {
  await oauthClient.removeTokens();
}
