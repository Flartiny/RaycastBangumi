import { useState } from "react";
import { Action, ActionPanel, Color, Image, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { getCalendar } from "./api/client";
import { SubjectDetail } from "./subject-detail";
import { buildSubjectKeywords } from "./pinyin-keywords";
import type { CalendarItem, SubjectSmall } from "./api/types";

const WEEKDAY_CN: Record<number, string> = {
  1: "星期一",
  2: "星期二",
  3: "星期三",
  4: "星期四",
  5: "星期五",
  6: "星期六",
  7: "星期日",
};

function getTodayBangumiWeekday(): number {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 7 : jsDay;
}

export default function Command() {
  const today = getTodayBangumiWeekday();
  const [currentDay, setCurrentDay] = useState<number>(today);
  const [searchText, setSearchText] = useState("");

  const { isLoading, data: calendar } = useCachedPromise(
    getCalendar,
    [],
    { keepPreviousData: true },
  );

  const dayMap = new Map<number, CalendarItem>();
  if (calendar) {
    for (const day of calendar) {
      dayMap.set(day.weekday.id, day);
    }
  }

  const currentDayData = dayMap.get(currentDay);
  const isToday = currentDay === today;
  const dayLabel = WEEKDAY_CN[currentDay];
  const isSearching = searchText.length > 0;

  function goNext() {
    setCurrentDay((d) => (d >= 7 ? 1 : d + 1));
  }

  function goPrev() {
    setCurrentDay((d) => (d <= 1 ? 7 : d - 1));
  }

  const subjects = currentDayData?.items ?? [];

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder={`筛选${dayLabel}的番剧...`}
      onSearchTextChange={setSearchText}
      searchBarAccessory={
        <List.Dropdown
          tooltip="选择星期"
          value={String(currentDay)}
          onChange={(v) => setCurrentDay(Number(v))}
        >
          {[1, 2, 3, 4, 5, 6, 7].map((id) => (
            <List.Dropdown.Item
              key={id}
              title={`${WEEKDAY_CN[id]}${id === today ? " · 今天" : ""}`}
              value={String(id)}
            />
          ))}
        </List.Dropdown>
      }
    >
      {!isSearching && (
        <List.Section
          title={`${dayLabel}${isToday ? " · 今天" : ""}`}
          subtitle={currentDayData?.weekday.ja}
        >
          {subjects.length === 0 && !isLoading && (
            <List.Item
              title={isToday ? "今天暂无放送" : "暂无放送"}
              actions={
                <ActionPanel>
                  <Action
                    title="前一天"
                    shortcut={{ key: "arrowLeft", modifiers: [] }}
                    onAction={goPrev}
                  />
                  <Action
                    title="后一天"
                    shortcut={{ key: "arrowRight", modifiers: [] }}
                    onAction={goNext}
                  />
                  {!isToday && (
                    <Action
                      title="回到今天"
                      shortcut={{ key: "home", modifiers: [] }}
                      onAction={() => setCurrentDay(today)}
                    />
                  )}
                </ActionPanel>
              }
            />
          )}
          {subjects.map((subject) => (
            <CalendarSubjectItem
              key={subject.id}
              subject={subject}
              isToday={isToday}
              onPrev={goPrev}
              onNext={goNext}
              onToday={() => setCurrentDay(today)}
            />
          ))}
        </List.Section>
      )}
      {isSearching &&
        (calendar ?? []).map((day) => (
          <List.Section
            key={day.weekday.id}
            title={`${WEEKDAY_CN[day.weekday.id]}${day.weekday.id === today ? " · 今天" : ""}`}
            subtitle={day.weekday.ja}
          >
            {day.items.map((subject) => (
              <CalendarSubjectItem
                key={subject.id}
                subject={subject}
                isToday={day.weekday.id === today}
                onPrev={goPrev}
                onNext={goNext}
                onToday={() => setCurrentDay(today)}
              />
            ))}
          </List.Section>
        ))}
    </List>
  );
}

function CalendarSubjectItem({
  subject,
  isToday,
  onPrev,
  onNext,
  onToday,
}: {
  subject: SubjectSmall;
  isToday: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const rating = subject.rating?.score
    ? `★ ${subject.rating.score.toFixed(1)}`
    : "";

  return (
    <List.Item
      id={String(subject.id)}
      icon={{
        source: subject.images?.small || subject.images?.grid || "",
        mask: Image.Mask.RoundedRectangle,
      }}
      title={subject.name_cn || subject.name}
      subtitle={subject.name_cn ? subject.name : undefined}
      keywords={buildSubjectKeywords(subject.name_cn, subject.name)}
      accessories={[
        ...(rating ? [{ text: { value: rating, color: Color.Yellow } }] : []),
        ...(subject.rank ? [{ text: `#${subject.rank}` }] : []),
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
              <List.Item.Detail.Metadata.Label
                title="名称"
                text={subject.name_cn || subject.name}
              />
              {subject.name_cn && (
                <List.Item.Detail.Metadata.Label title="原文" text={subject.name} />
              )}
              <List.Item.Detail.Metadata.Label
                title="放送日"
                text={WEEKDAY_CN[subject.air_weekday] || ""}
              />
              {subject.air_date && (
                <List.Item.Detail.Metadata.Label title="首播日期" text={subject.air_date} />
              )}
              <List.Item.Detail.Metadata.Label
                title="评分"
                text={subject.rating?.score?.toFixed(1) || "暂无"}
              />
              <List.Item.Detail.Metadata.Label
                title="排名"
                text={subject.rank ? `#${subject.rank}` : "暂无"}
              />
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Label
                title="简介"
                text={subject.summary || "暂无简介"}
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
              target={<SubjectDetail id={subject.id} name={subject.name} nameCn={subject.name_cn} />}
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
            {!isToday && (
              <Action
                title="回到今天"
                shortcut={{ key: "home", modifiers: [] }}
                onAction={onToday}
              />
            )}
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
