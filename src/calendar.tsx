import { Action, ActionPanel, Color, Image, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { getCalendar } from "./api/client";
import type { SubjectSmall } from "./api/types";

const WEEKDAY_CN: Record<number, string> = {
  1: "星期一",
  2: "星期二",
  3: "星期三",
  4: "星期四",
  5: "星期五",
  6: "星期六",
  7: "星期日",
};

function getTodayWeekday(): number {
  const day = new Date().getDay();
  return day === 0 ? 7 : day; // JS: 0=Sun, Bangumi: 7=Sun
}

export default function Command() {
  const today = getTodayWeekday();

  const { isLoading, data: calendar } = useCachedPromise(
    getCalendar,
    [],
    { keepPreviousData: true },
  );

  const items = calendar ?? [];

  return (
    <List isLoading={isLoading} searchBarPlaceholder="筛选番剧...">
      {items.map((day) => {
        const isToday = day.weekday.id === today;
        return (
          <List.Section
            key={day.weekday.id}
            title={`${day.weekday.cn}${isToday ? " · 今天" : ""}`}
            subtitle={day.weekday.ja}
          >
            {day.items.length === 0 && (
              <List.Item title="暂无放送" />
            )}
            {day.items.map((subject) => (
              <CalendarSubjectItem
                key={subject.id}
                subject={subject}
                isToday={isToday}
              />
            ))}
          </List.Section>
        );
      })}
    </List>
  );
}

function CalendarSubjectItem({
  subject,
  isToday,
}: {
  subject: SubjectSmall;
  isToday: boolean;
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
                text={isToday ? `${WEEKDAY_CN[subject.air_weekday]} (今天)` : WEEKDAY_CN[subject.air_weekday] || ""}
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
