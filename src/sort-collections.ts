import type { CalendarItem, UserCollection } from "./api/types";

export function getTodayBangumiWeekday(): number {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 7 : jsDay;
}

function weekdayOffset(weekday: number, today: number): number {
  return (weekday - today + 7) % 7;
}

function getTotalEp(c: UserCollection): number {
  return c.subject.total_episodes || c.subject.eps || 0;
}

export type SortedGroup = "airing_not_caught" | "finished" | "airing_caught";

export interface CollectionMeta {
  group: SortedGroup;
  weekday: number;
  airedEp: number;
}

export function getCollectionMeta(
  c: UserCollection,
  airingMap: Map<number, number>,
  airedEpMap: Map<number, number>,
  today: number,
): CollectionMeta {
  const weekday = airingMap.get(c.subject_id) ?? c.subject.air_weekday ?? 0;
  const isAiring = airingMap.has(c.subject_id);
  const totalEp = getTotalEp(c);
  const airedEp = isAiring ? (airedEpMap.get(c.subject_id) ?? totalEp) : totalEp;

  let group: SortedGroup;
  if (isAiring && weekday === today) {
    group = "airing_caught";
  } else if (isAiring && c.ep_status < airedEp) {
    group = "airing_not_caught";
  } else if (isAiring && c.ep_status >= airedEp) {
    group = "airing_caught";
  } else {
    group = "finished";
  }

  return { group, weekday, airedEp };
}

export function sortCollections(
  collections: UserCollection[],
  calendar: CalendarItem[],
  today: number,
  airedEpMap: Map<number, number>,
): UserCollection[] {
  const airingMap = new Map<number, number>();
  for (const day of calendar) {
    for (const item of day.items) {
      airingMap.set(item.id, day.weekday.id);
    }
  }

  const groupI: UserCollection[] = [];
  const groupII: UserCollection[] = [];
  const groupIII: UserCollection[] = [];

  for (const c of collections) {
    const { group } = getCollectionMeta(c, airingMap, airedEpMap, today);

    if (group === "airing_not_caught") {
      groupI.push(c);
    } else if (group === "airing_caught") {
      groupIII.push(c);
    } else {
      groupII.push(c);
    }
  }

  groupI.sort((a, b) => {
    const wa = airingMap.get(a.subject_id) ?? 0;
    const wb = airingMap.get(b.subject_id) ?? 0;
    return weekdayOffset(wa, today) - weekdayOffset(wb, today);
  });

  groupIII.sort((a, b) => {
    const wa = airingMap.get(a.subject_id) ?? 0;
    const wb = airingMap.get(b.subject_id) ?? 0;
    return weekdayOffset(wa, today) - weekdayOffset(wb, today);
  });

  const groupIIa = groupII.filter((c) => c.ep_status > 0);
  const groupIIb = groupII.filter((c) => c.ep_status === 0);

  return [...groupI, ...groupIIa, ...groupIIb, ...groupIII];
}

export function getDisplayLabel(
  c: UserCollection,
  airingMap: Map<number, number>,
  airedEpMap: Map<number, number>,
  today: number,
): string | null {
  const { group, airedEp } = getCollectionMeta(c, airingMap, airedEpMap, today);

  if (group === "airing_caught") {
    return airedEp > 0 ? `已看 ${airedEp}` : "等待更新";
  }

  if (group === "airing_not_caught" || (group === "finished" && c.ep_status > 0)) {
    return `继续观看 ${c.ep_status + 1}`;
  }

  if (group === "finished" && c.ep_status === 0) {
    return "开始观看";
  }

  return null;
}

export { weekdayOffset };
export const WEEKDAY_CN: Record<number, string> = {
  1: "星期一",
  2: "星期二",
  3: "星期三",
  4: "星期四",
  5: "星期五",
  6: "星期六",
  7: "星期日",
};
