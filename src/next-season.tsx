import { useEffect, useState } from "react";
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
  weekday: number | null;
  nameCn: string | null;
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
  const { label } = getNextSeasonInfo();
  return label;
}

function formatTime(airingAt: number | null): string {
  if (!airingAt) return "";
  const d = new Date(airingAt * 1000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

type DayKey = number | "tba";

function earliestEntryDay(entries: SeasonEntry[]): DayKey {
  let earliestDay: DayKey = "tba";
  let earliestDate: Date | null = null;
  for (const e of entries) {
    if (e.airingAt) {
      const d = new Date(e.airingAt * 1000);
      if (!earliestDate || d < earliestDate) {
        earliestDate = d;
        earliestDay = e.weekday ?? "tba";
      }
    } else if (e.startDate.year && e.startDate.month && e.startDate.day) {
      const d = new Date(e.startDate.year, e.startDate.month - 1, e.startDate.day);
      if (!earliestDate || d < earliestDate) {
        earliestDate = d;
        earliestDay = e.weekday ?? "tba";
      }
    }
  }
  return earliestDay;
}

export default function Command() {
  const { season, seasonYear, label } = getNextSeasonInfo();
  const today = new Date().getDay(); // 0=Sun, 6=Sat
  const [currentDay, setCurrentDay] = useState<DayKey>(today);

  const { isLoading, data: entries } = useCachedPromise(
    async (s: string, y: number) => {
      const items = await getNextSeason();

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

  // Group by weekday
  const groups = new Map<DayKey, SeasonEntry[]>();
  for (const e of allEntries) {
    const key: DayKey = e.weekday ?? "tba";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }

  // Which weekdays have entries
  const availableDays = new Set<number>();
  for (const k of groups.keys()) {
    if (k !== "tba") availableDays.add(k);
  }
  const hasTba = groups.has("tba");

  // Default to the day of the earliest upcoming entry
  useEffect(() => {
    if (allEntries.length === 0) return;
    setCurrentDay(earliestEntryDay(allEntries));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEntries.length]);

  const currentItems = groups.get(currentDay) ?? [];
  const currentLabel = currentDay === "tba" ? "未定 (TBA)" : WEEKDAY_CN[currentDay];

  function goNext() {
    setCurrentDay((d) => {
      if (d === "tba") return "tba";
      const next = d >= 6 ? 0 : d + 1;
      // Skip empty days forward
      for (let offset = 0; offset < 14; offset++) {
        const candidate = (d + 1 + offset) % 7;
        if (availableDays.has(candidate)) return candidate;
        if (offset >= 6 && hasTba) return "tba";
      }
      return next;
    });
  }

  function goPrev() {
    setCurrentDay((d) => {
      if (d === "tba") {
        // Go to last available weekday
        for (let offset = 1; offset <= 7; offset++) {
          const candidate = (today - offset + 7) % 7;
          if (availableDays.has(candidate)) return candidate;
        }
        return "tba";
      }
      for (let offset = 1; offset < 14; offset++) {
        const candidate = (d - offset + 7) % 7;
        if (availableDays.has(candidate)) return candidate;
        if (offset >= 6 && hasTba) return "tba";
      }
      return d;
    });
  }

  const dayOptions: { label: string; value: string; count: number }[] = [];
  for (const d of [0, 1, 2, 3, 4, 5, 6]) {
    const count = (groups.get(d) ?? []).length;
    if (count > 0) {
      dayOptions.push({ label: WEEKDAY_CN[d], value: String(d), count });
    }
  }
  if (hasTba) {
    dayOptions.push({ label: "未定", value: "tba", count: groups.get("tba")!.length });
  }

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder={`筛选${currentLabel}新番...`}
      searchBarAccessory={
        <List.Dropdown
          tooltip="选择星期"
          value={String(currentDay)}
          onChange={(v) => setCurrentDay(v === "tba" ? "tba" : Number(v))}
        >
          {dayOptions.map((opt) => (
            <List.Dropdown.Item
              key={opt.value}
              title={`${opt.label} · ${opt.count}部`}
              value={opt.value}
            />
          ))}
        </List.Dropdown>
      }
    >
      {!isLoading && allEntries.length === 0 && (
        <List.EmptyView title="暂无数据" description={`无法获取 ${label} 新番信息`} />
      )}

      <List.Section title={currentLabel} subtitle={currentDay === "tba" ? "播出日期未定" : undefined}>
        {currentItems.length === 0 && !isLoading && (
          <List.Item
            title="暂无放送"
            actions={
              <ActionPanel>
                <Action title="前一天" shortcut={{ key: "arrowLeft", modifiers: [] }} onAction={goPrev} />
                <Action title="后一天" shortcut={{ key: "arrowRight", modifiers: [] }} onAction={goNext} />
              </ActionPanel>
            }
          />
        )}
        {currentItems.map((item) => (
          <SeasonItem key={item.id} item={item} onPrev={goPrev} onNext={goNext} />
        ))}
      </List.Section>
    </List>
  );
}

function SeasonItem({ item, onPrev, onNext }: { item: SeasonEntry; onPrev: () => void; onNext: () => void }) {
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
          <ActionPanel.Section>
            <Action.OpenInBrowser title="查看详情" url={url} />
            {item.bangumiId && (
              <Action.CopyToClipboard title="复制名称" content={displayName} />
            )}
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action
              title="前一天"
              shortcut={{ key: "arrowLeft", modifiers: [] }}
              onAction={onPrev}
            />
            <Action
              title="后一天"
              shortcut={{ key: "arrowRight", modifiers: [] }}
              onAction={onNext}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
