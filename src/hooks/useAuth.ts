import { useCallback, useEffect, useRef, useState } from "react";
import { isLoggedIn, login } from "../oauth";

export function useAuth({ autoLogin }: { autoLogin?: boolean } = {}) {
  const [authLoading, setAuthLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [loginFailed, setLoginFailed] = useState(false);
  const triedRef = useRef(false);

  const handleLogin = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    (async () => {
      const ok = await isLoggedIn();
      setAuthenticated(ok);
      setAuthLoading(false);

      if (!ok && autoLogin && !triedRef.current) {
        triedRef.current = true;
        handleLogin();
      }
    })();
  }, []);

  return { authLoading, authenticated, loginFailed, handleLogin };
}
