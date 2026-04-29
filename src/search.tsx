import { useState } from "react";
import { Action, ActionPanel, Image, List, getPreferenceValues } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { searchSubjects } from "./api/client";
import { SubjectDetail } from "./subject-detail";
import { SubjectTypeLabel } from "./api/types";
import type { Subject } from "./api/types";

interface Preferences {
  accessToken: string;
}

const subjectTypeOptions: { label: string; value: string }[] = [
  { label: "全部", value: "" },
  { label: "动画", value: "2" },
  { label: "书籍", value: "1" },
  { label: "音乐", value: "3" },
  { label: "游戏", value: "4" },
  { label: "三次元", value: "6" },
];

export default function Command() {
  const { accessToken } = getPreferenceValues<Preferences>();
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const {
    isLoading,
    data: searchResult,
    error,
  } = useCachedPromise(
    async (text: string, type: string) => {
      if (!text.trim()) return { data: [], total: 0 };
      const types = type ? [parseInt(type)] : undefined;
      return searchSubjects({ keyword: text, type: types });
    },
    [searchText, typeFilter],
    {
      keepPreviousData: true,
      execute: searchText.trim().length > 0,
    },
  );

  const subjects = searchResult?.data ?? [];

  return (
    <List
      isLoading={isLoading}
      onSearchTextChange={setSearchText}
      throttle
      searchBarPlaceholder="搜索番剧、书籍、游戏..."
      searchBarAccessory={
        <List.Dropdown
          tooltip="条目类型"
          onChange={setTypeFilter}
          value={typeFilter}
        >
          {subjectTypeOptions.map((opt) => (
            <List.Dropdown.Item
              key={opt.value}
              title={opt.label}
              value={opt.value}
            />
          ))}
        </List.Dropdown>
      }
    >
      {!accessToken && (
        <List.EmptyView
          title="未配置 Access Token"
          description="请在扩展偏好设置中填入 Bangumi Access Token"
        />
      )}
      {accessToken && !searchText.trim() && (
        <List.EmptyView title="输入关键词开始搜索" description="支持搜索番剧、书籍、音乐、游戏等" />
      )}
      {error && (
        <List.EmptyView title="搜索失败" description={error.message} />
      )}
      {!isLoading && searchText.trim() && subjects.length === 0 && (
        <List.EmptyView title="无结果" description={`未找到 "${searchText}" 相关内容`} />
      )}
      {subjects.map((subject: Subject) => (
        <SubjectListItem key={subject.id} subject={subject} />
      ))}
    </List>
  );
}

function SubjectListItem({ subject }: { subject: Subject }) {
  const typeLabel = SubjectTypeLabel[subject.type] || "未知";
  const rating = subject.rating?.score ? `★ ${subject.rating.score.toFixed(1)}` : "暂无评分";

  return (
    <List.Item
      id={String(subject.id)}
      icon={{
        source: subject.images?.small || subject.images?.grid || "",
        mask: Image.Mask.RoundedRectangle,
      }}
      title={subject.name_cn || subject.name}
      subtitle={subject.name_cn ? subject.name : undefined}
      accessories={[
        { tag: typeLabel },
        { text: rating },
      ]}
      detail={
        <List.Item.Detail
          markdown={
            subject.images?.large
              ? `![${subject.name_cn || subject.name}](${subject.images.large}?raycast-width=280)`
              : ""
          }
          metadata={
            <List.Item.Detail.Metadata>
              <List.Item.Detail.Metadata.Label title="名称" text={subject.name_cn || subject.name} />
              {subject.name_cn && (
                <List.Item.Detail.Metadata.Label title="原文" text={subject.name} />
              )}
              <List.Item.Detail.Metadata.Label title="类型" text={typeLabel} />
              <List.Item.Detail.Metadata.Label title="评分" text={subject.rating?.score?.toFixed(1) || "暂无"} />
              <List.Item.Detail.Metadata.Label title="评分人数" text={String(subject.rating?.total || 0)} />
              {subject.date && (
                <List.Item.Detail.Metadata.Label title="日期" text={subject.date} />
              )}
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Label title="简介" text={subject.summary || "暂无简介"} />
            </List.Item.Detail.Metadata>
          }
        />
      }
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.Push
              title="查看详情"
              target={<SubjectDetail id={subject.id} />}
            />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action.OpenInBrowser
              title="在 Bangumi 中打开"
              url={`https://bgm.tv/subject/${subject.id}`}
            />
            <Action.CopyToClipboard
              title="复制条目链接"
              content={`https://bgm.tv/subject/${subject.id}`}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
