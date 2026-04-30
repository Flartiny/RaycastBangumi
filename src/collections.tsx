import { useEffect, useState } from "react";
import { Action, ActionPanel, Color, Image, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { getUserCollections, getAllUserCollections, getCalendar } from "./api/client";
import { getUsername } from "./oauth";
import { SubjectDetail } from "./subject-detail";
import { useAuth } from "./hooks/useAuth";
import { LoginLoading, LoginPrompt } from "./components/LoginPrompt";
import { CollectionTypeLabel, SubjectTypeLabel } from "./api/types";
import { sortCollections, getDisplayLabel, getTodayBangumiWeekday, WEEKDAY_CN } from "./sort-collections";
import type { CollectionType, UserCollection } from "./api/types";

const LIMIT = 20;

const COLLECTION_TYPES: { label: string; value: string }[] = [
  { label: "想看", value: "1" },
  { label: "看过", value: "2" },
  { label: "在看", value: "3" },
  { label: "搁置", value: "4" },
  { label: "抛弃", value: "5" },
];

const RATE_COLORS: Record<number, Color> = {
  10: Color.Red,
  9: Color.Red,
  8: Color.Orange,
  7: Color.Yellow,
  6: Color.Yellow,
  5: Color.Green,
};

export default function Command() {
  const { authLoading, authenticated, loginFailed, handleLogin } = useAuth({ autoLogin: true });
  const [username, setUsername] = useState<string | null>(null);
  const [collectionType, setCollectionType] = useState("3");
  const [page, setPage] = useState(1);

  const isWatching = collectionType === "3";

  useEffect(() => {
    if (authenticated) {
      getUsername().then((u) => setUsername(u || ""));
    }
  }, [authenticated]);

  useEffect(() => {
    setPage(1);
  }, [collectionType]);

  const { isLoading: loadingCalendar, data: calendar } = useCachedPromise(
    isWatching ? getCalendar : () => Promise.resolve(null),
    [],
    {
      keepPreviousData: true,
      execute: authenticated && !!username && isWatching,
    },
  );

  const calendarData = calendar ?? null;

  const {
    isLoading: loadingCollections,
    data: result,
    error,
  } = useCachedPromise(
    async (type: string, pageNum: number, uname: string) => {
      if (type === "3") {
        return getAllUserCollections({
          username: uname,
          type: 3,
        });
      }
      return getUserCollections({
        username: uname,
        type: parseInt(type),
        limit: LIMIT,
        offset: (pageNum - 1) * LIMIT,
      });
    },
    [collectionType, page, username as string],
    {
      keepPreviousData: true,
      execute: authenticated && !!username,
    },
  );

  const rawCollections = result?.data ?? [];
  const apiTotal = result?.total ?? 0;

  const today = getTodayBangumiWeekday();

  let sorted: UserCollection[];
  let airingMap = new Map<number, number>();
  if (isWatching && calendarData) {
    for (const day of calendarData) {
      for (const item of day.items) {
        airingMap.set(item.id, day.weekday.id);
      }
    }
    sorted = sortCollections(rawCollections, calendarData, today);
  } else {
    sorted = rawCollections;
  }

  const totalPages = isWatching
    ? Math.max(1, Math.ceil(sorted.length / LIMIT))
    : Math.max(1, Math.ceil(apiTotal / LIMIT));

  const pageCollections = isWatching
    ? sorted.slice((page - 1) * LIMIT, page * LIMIT)
    : sorted;

  const displayLabels = new Map<number, string | null>();
  for (const c of sorted) {
    displayLabels.set(c.subject_id, getDisplayLabel(c, airingMap, today));
  }

  const typeLabel = CollectionTypeLabel[parseInt(collectionType) as CollectionType];

  function goNext() {
    setPage((p) => Math.min(p + 1, totalPages));
  }

  function goPrev() {
    setPage((p) => Math.max(p - 1, 1));
  }

  function goFirst() {
    setPage(1);
  }

  function goLast() {
    setPage(totalPages);
  }

  const showContent = authenticated && !!username && !error;
  const isLoading = isWatching ? loadingCollections || loadingCalendar : loadingCollections;

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder={`筛选${typeLabel}条目...`}
      searchBarAccessory={
        <List.Dropdown
          tooltip="收藏状态"
          onChange={setCollectionType}
          value={collectionType}
        >
          {COLLECTION_TYPES.map((opt) => (
            <List.Dropdown.Item
              key={opt.value}
              title={opt.label}
              value={opt.value}
            />
          ))}
        </List.Dropdown>
      }
    >
      {!authenticated && (loginFailed
        ? <LoginPrompt onLogin={handleLogin} message="登录失败，请检查网络后重试" />
        : <LoginLoading />
      )}
      {authenticated && !username && <LoginLoading />}
      {authenticated && username && error && (
        <List.EmptyView title="加载失败" description={error.message} />
      )}
      {authenticated && username && !error && !isLoading && pageCollections.length === 0 && page === 1 && (
        <List.EmptyView
          title="暂无数据"
          description={`没有${typeLabel}条目`}
        />
      )}
      {authenticated && username && !error && !isLoading && pageCollections.length === 0 && page > 1 && (
        <List.EmptyView
          title="翻过头了"
          description={`第 ${page} 页无数据，共 ${totalPages} 页`}
          actions={
            <ActionPanel>
              <Action
                title="前一页"
                shortcut={{ key: "arrowLeft", modifiers: [] }}
                onAction={goPrev}
              />
              <Action
                title="回到第 1 页"
                shortcut={{ key: "home", modifiers: [] }}
                onAction={goFirst}
              />
            </ActionPanel>
          }
        />
      )}
      {showContent && (
        <List.Section
          title={`${typeLabel} · 第 ${page} / ${totalPages} 页 · 共 ${sorted.length} 条`}
        >
          {pageCollections.map((item) => (
            <CollectionListItem
              key={item.subject_id}
              collection={item}
              page={page}
              totalPages={totalPages}
              onPrev={goPrev}
              onNext={goNext}
              onFirst={goFirst}
              onLast={goLast}
              showProgressLabel={isWatching}
              displayLabel={displayLabels.get(item.subject_id) ?? null}
            />
          ))}
        </List.Section>
      )}
    </List>
  );
}

function CollectionListItem({
  collection,
  page,
  totalPages,
  onPrev,
  onNext,
  onFirst,
  onLast,
  showProgressLabel,
  displayLabel,
}: {
  collection: UserCollection;
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  onFirst: () => void;
  onLast: () => void;
  showProgressLabel: boolean;
  displayLabel: string | null;
}) {
  const subject = collection.subject;
  const typeLabel = SubjectTypeLabel[subject.type] || "未知";
  const rateText = collection.rate ? `★ ${collection.rate}` : "";
  const rateColor = collection.rate ? RATE_COLORS[collection.rate] : undefined;

  const weekdayText = subject.air_weekday ? WEEKDAY_CN[subject.air_weekday] : undefined;

  const accessories = [];
  if (showProgressLabel && displayLabel) {
    accessories.push({ tag: { value: displayLabel } });
  }
  if (rateText) {
    accessories.push({ tag: { value: rateText, color: rateColor } });
  }
  if (weekdayText) {
    accessories.push({ text: weekdayText });
  }
  accessories.push({ text: typeLabel });

  return (
    <List.Item
      id={String(subject.id)}
      icon={{
        source: subject.images?.small || subject.images?.grid || "",
        mask: Image.Mask.RoundedRectangle,
      }}
      title={subject.name_cn || subject.name}
      subtitle={subject.name_cn ? subject.name : undefined}
      accessories={accessories}
      detail={
        <List.Item.Detail
          markdown={
            subject.images?.large
              ? `![${subject.name_cn || subject.name}](${subject.images.large}?raycast-width=280)`
              : ""
          }
          metadata={
            <List.Item.Detail.Metadata>
              <List.Item.Detail.Metadata.Label
                title="名称"
                text={subject.name_cn || subject.name}
              />
              {subject.name_cn && (
                <List.Item.Detail.Metadata.Label title="原文" text={subject.name} />
              )}
              <List.Item.Detail.Metadata.Label title="类型" text={typeLabel} />
              <List.Item.Detail.Metadata.Label
                title="Bangumi 评分"
                text={subject.rating?.score?.toFixed(1) || "暂无"}
              />
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Label
                title="我的评分"
                text={collection.rate ? `${collection.rate} / 10` : "未评分"}
              />
              <List.Item.Detail.Metadata.Label
                title="收藏状态"
                text={CollectionTypeLabel[collection.type]}
              />
              {collection.tags.length > 0 && (
                <List.Item.Detail.Metadata.TagList title="标签">
                  {collection.tags.map((tag) => (
                    <List.Item.Detail.Metadata.TagList.Item
                      key={tag}
                      text={tag}
                    />
                  ))}
                </List.Item.Detail.Metadata.TagList>
              )}
              {collection.ep_status > 0 && (
                <List.Item.Detail.Metadata.Label
                  title="观看进度"
                  text={`${collection.ep_status} / ${subject.total_episodes || subject.eps || "?"}`}
                />
              )}
              {collection.comment && (
                <>
                  <List.Item.Detail.Metadata.Separator />
                  <List.Item.Detail.Metadata.Label
                    title="短评"
                    text={collection.comment}
                  />
                </>
              )}
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Label
                title="更新时间"
                text={collection.updated_at?.slice(0, 10) || ""}
              />
            </List.Item.Detail.Metadata>
          }
        />
      }
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.Push
              title="查看详情"
              target={
                <SubjectDetail id={subject.id} />
              }
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
          <ActionPanel.Section>
            {page > 1 && (
              <Action
                title="前一页"
                shortcut={{ key: "arrowLeft", modifiers: [] }}
                onAction={onPrev}
              />
            )}
            {page < totalPages && (
              <Action
                title="后一页"
                shortcut={{ key: "arrowRight", modifiers: [] }}
                onAction={onNext}
              />
            )}
            {page !== 1 && (
              <Action
                title="回到第 1 页"
                shortcut={{ key: "home", modifiers: [] }}
                onAction={onFirst}
              />
            )}
            {page !== totalPages && totalPages > 1 && (
              <Action
                title="跳到最后页"
                shortcut={{ key: "end", modifiers: [] }}
                onAction={onLast}
              />
            )}
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
