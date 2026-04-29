import { useCallback, useEffect, useRef, useState } from "react";
import { isLoggedIn, login } from "../oauth";

export function useAuth({ autoLogin }: { autoLogin?: boolean } = {}) {
  const [authLoading, setAuthLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [loginFailed, setLoginFailed] = useState(false);
  const triedRef = useRef(false);

  const checkAuth = useCallback(async () => {
    try {
      const ok = await isLoggedIn();
      setAuthenticated(ok);
      return ok;
    } catch {
      setAuthenticated(false);
      return false;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth().then((ok) => {
      if (!ok && autoLogin && !triedRef.current) {
        triedRef.current = true;
        handleLogin();
      }
    });
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
