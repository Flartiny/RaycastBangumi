import { useState } from "react";
import { Action, ActionPanel, Image, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { getNextSeason, getNextSeasonInfo } from "./api/anilist";
import { searchAnimeSubject } from "./api/client";
import type { NextSeasonItem } from "./api/anilist";

const WEEKDAY_CN: Record<number, string> = {
  0: "星期日", 1: "星期一", 2: "星期二", 3: "星期三",
  4: "星期四", 5: "星期五", 6: "星期六",
};

interface SeasonEntry extends NextSeasonItem {
  weekday: number | null; // 0-6, null=TBA
  nameCn: string | null;  // Bangumi cross-matched name
  bangumiId: number | null;
}

function getWeekday(item: NextSeasonItem): number | null {
  if (item.airingAt) {
    return new Date(item.airingAt * 1000).getUTCDay();
  }
  const { year, month, day } = item.startDate;
  if (year && month && day) {
    return new Date(year, month - 1, day).getDay();
  }
  return null;
}

function formatDate(item: NextSeasonItem): string {
  const { year, month, day } = item.startDate;
  if (year && month && day) {
    return `${month}月${day}日`;
  }
  if (year && month) {
    return `${year}年${month}月`;
  }
  const { season, seasonYear, label } = getNextSeasonInfo();
  return label;
}

function formatTime(airingAt: number | null): string {
  if (!airingAt) return "";
  const d = new Date(airingAt * 1000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export default function Command() {
  const { season, seasonYear, label } = getNextSeasonInfo();
  const [dayFilter, setDayFilter] = useState("-1"); // -1 = all

  const { isLoading, data: entries } = useCachedPromise(
    async (s: string, y: number) => {
      const items = await getNextSeason();

      // Cross-match with Bangumi
      const results = await Promise.allSettled(
        items.map(async (item) => {
          const weekday = getWeekday(item);
          const bangumiMatch = await searchAnimeSubject(item.title.native);
          return {
            ...item,
            weekday,
            nameCn: bangumiMatch?.name_cn ?? null,
            bangumiId: bangumiMatch?.id ?? null,
          } as SeasonEntry;
        }),
      );

      return results
        .filter((r): r is PromiseFulfilledResult<SeasonEntry> => r.status === "fulfilled")
        .map((r) => r.value);
    },
    [season, seasonYear],
    { keepPreviousData: true },
  );

  const allEntries = entries ?? [];

  const displayed = dayFilter === "-1"
    ? allEntries
    : dayFilter === "-2"
    ? allEntries.filter((e) => e.weekday === null)
    : allEntries.filter((e) => e.weekday === Number(dayFilter));

  // Sort: by weekday, TBA last
  const sorted = [...displayed].sort((a, b) => {
    if (a.weekday === null && b.weekday === null) return 0;
    if (a.weekday === null) return 1;
    if (b.weekday === null) return -1;
    return a.weekday - b.weekday;
  });

  // Group by weekday
  const groups = new Map<number | "tba", SeasonEntry[]>();
  for (const e of sorted) {
    const key = e.weekday ?? "tba";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }

  const weekdays = [0, 1, 2, 3, 4, 5, 6];

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder={`筛选${label}新番...`}
      searchBarAccessory={
        <List.Dropdown
          tooltip="按放送日筛选"
          value={dayFilter}
          onChange={setDayFilter}
        >
          <List.Dropdown.Item title="全部" value="-1" />
          {weekdays.map((d) => (
            <List.Dropdown.Item
              key={d}
              title={WEEKDAY_CN[d]}
              value={String(d)}
            />
          ))}
          <List.Dropdown.Item title="未定" value="-2" />
        </List.Dropdown>
      }
    >
      {!isLoading && allEntries.length === 0 && (
        <List.EmptyView title="暂无数据" description={`无法获取 ${label} 新番信息`} />
      )}

      {/* Regular weekdays */}
      {weekdays.map((wd) => {
        const items = groups.get(wd);
        if (!items || items.length === 0) return null;
        return (
          <List.Section key={wd} title={WEEKDAY_CN[wd]}>
            {items.map((item) => (
              <SeasonItem key={item.id} item={item} />
            ))}
          </List.Section>
        );
      })}

      {/* TBA section */}
      {(() => {
        const tbaItems = groups.get("tba");
        if (!tbaItems || tbaItems.length === 0) return null;
        return (
          <List.Section key="tba" title="未定 (TBA)">
            {tbaItems.map((item) => (
              <SeasonItem key={item.id} item={item} />
            ))}
          </List.Section>
        );
      })()}
    </List>
  );
}

function SeasonItem({ item }: { item: SeasonEntry }) {
  const displayName = item.nameCn || item.title.native;
  const dateStr = formatDate(item);
  const timeStr = formatTime(item.airingAt);
  const subtitle = timeStr ? `${dateStr} ${timeStr}` : dateStr;

  const accessories = [];
  if (item.episodes) {
    accessories.push({ text: `${item.episodes}话` });
  }
  accessories.push({ text: item.format === "MOVIE" ? "剧场版" : item.format === "TV" ? "TV" : item.format });

  const url = item.bangumiId
    ? `https://bgm.tv/subject/${item.bangumiId}`
    : `https://anilist.co/anime/${item.id}`;

  return (
    <List.Item
      id={String(item.id)}
      icon={{ source: item.cover, mask: Image.Mask.RoundedRectangle }}
      title={displayName}
      subtitle={subtitle}
      accessories={accessories}
      actions={
        <ActionPanel>
          <Action.OpenInBrowser title="查看详情" url={url} />
          {item.bangumiId && (
            <Action.CopyToClipboard
              title="复制名称"
              content={displayName}
            />
          )}
        </ActionPanel>
      }
    />
  );
}
