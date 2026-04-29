import { Action, ActionPanel, List } from "@raycast/api";

interface Props {
  onLogin: () => void;
  message?: string;
}

export function LoginPrompt({ onLogin, message }: Props) {
  return (
    <List.EmptyView
      title="未登录 Bangumi"
      description={message || "登录后可使用收藏等完整功能"}
      actions={
        <ActionPanel>
          <Action title="登录 Bangumi" onAction={onLogin} />
        </ActionPanel>
      }
    />
  );
}

export function LoginLoading() {
  return <List.EmptyView title="正在检查登录状态..." />;
}
