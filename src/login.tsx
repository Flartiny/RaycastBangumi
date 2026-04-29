import { Action, ActionPanel, Color, Detail, List, Toast, showToast } from "@raycast/api";
import { useEffect, useState } from "react";
import { getAccessToken, isLoggedIn, login, logout } from "./oauth";

export default function Command() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [token, setToken] = useState("");

  useEffect(() => {
    checkLogin();
  }, []);

  async function checkLogin() {
    const ok = await isLoggedIn();
    setLoggedIn(ok);
    if (ok) {
      const t = await getAccessToken();
      setToken(t ? `${t.slice(0, 8)}...` : "(未获取到)");
    }
  }

  async function handleLogin() {
    const toast = await showToast({ title: "正在跳转 Bangumi 授权...", style: Toast.Style.Animated });
    const success = await login();
    if (success) {
      toast.style = Toast.Style.Success;
      toast.title = "登录成功";
      await checkLogin();
    } else {
      toast.style = Toast.Style.Failure;
      toast.title = "登录失败";
      toast.message = "请检查 App ID / App Secret 配置，或使用备用 Access Token";
    }
  }

  async function handleLogout() {
    await logout();
    await showToast({ title: "已登出", style: Toast.Style.Success });
    setLoggedIn(false);
    setToken("");
  }

  if (loggedIn === null) {
    return <Detail isLoading />;
  }

  return (
    <List>
      {loggedIn ? (
        <>
          <List.Item
            icon={{ source: "check-circle", tintColor: Color.Green }}
            title="已登录"
            subtitle={`Token: ${token}`}
            actions={
              <ActionPanel>
                <Action title="登出" onAction={handleLogout} />
              </ActionPanel>
            }
          />
        </>
      ) : (
        <List.Item
          icon={{ source: "circle", tintColor: Color.Red }}
          title="未登录"
          subtitle="点击登录授权 Bangumi 账户"
          actions={
            <ActionPanel>
              <Action title="登录 Bangumi" onAction={handleLogin} />
            </ActionPanel>
          }
        />
      )}
    </List>
  );
}
