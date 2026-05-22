import { useCallback, useEffect, useRef, useState } from "react";
import { getAccessToken, isLoggedIn, login } from "../oauth";

export function useAuth({ autoLogin }: { autoLogin?: boolean } = {}) {
  const [authLoading, setAuthLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [loginFailed, setLoginFailed] = useState(false);
  const triedRef = useRef(false);

  useEffect(() => {
    (async () => {
      // First try: check stored tokens (no side effects)
      let ok = await isLoggedIn();

      // Second try: if getTokens() failed transiently, try OAuthService which
      // may recover and refresh the token
      if (!ok) {
        try {
          const token = await getAccessToken();
          ok = !!token;
        } catch {
          ok = false;
        }
      }

      setAuthenticated(ok);
      setAuthLoading(false);

      if (!ok && autoLogin && !triedRef.current) {
        triedRef.current = true;
        handleLogin();
      }
    })();
  }, []);

  async function handleLogin() {
    try {
      setLoginFailed(false);
      const success = await login();
      if (success) {
        setAuthenticated(true);
      } else {
        setLoginFailed(true);
      }
      return success;
    } catch {
      setLoginFailed(true);
      return false;
    }
  }

  return { authLoading, authenticated, loginFailed, handleLogin };
}
