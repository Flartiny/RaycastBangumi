interface AniListMedia {
  id: number;
  nextAiringEpisode: {
    airingAt: number;
    episode: number;
  } | null;
}

interface AniListResponse {
  data: {
    Page: {
      media: AniListMedia[];
    };
  };
}

const ANILIST_URL = "https://graphql.anilist.co";

function buildQuery(title: string): string {
  const escaped = title.replace(/"/g, '\\"');
  return `{ Page(page: 1, perPage: 1) { media(search: "${escaped}", type: ANIME) { id nextAiringEpisode { airingAt episode } } } }`;
}

// ---------- Next Season ----------

export interface NextSeasonItem {
  id: number;
  title: { native: string; romaji: string };
  cover: string;
  startDate: { year: number; month: number; day: number | null };
  airingAt: number | null;
  episode: number | null;
  episodes: number | null;
  format: string;
}

interface PageInfo {
  hasNextPage: boolean;
}

interface NextSeasonResponse {
  data: {
    Page: {
      pageInfo: PageInfo;
      media: {
        id: number;
        title: { native: string; romaji: string };
        coverImage: { large: string };
        startDate: { year: number | null; month: number | null; day: number | null };
        nextAiringEpisode: { airingAt: number; episode: number } | null;
        episodes: number | null;
        format: string;
      }[];
    };
  };
}

export function getNextSeasonInfo(): { season: string; seasonYear: number; label: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  if (month <= 3) return { season: "SPRING", seasonYear: year, label: `${year} 春季` };
  if (month <= 6) return { season: "SUMMER", seasonYear: year, label: `${year} 夏季` };
  if (month <= 9) return { season: "FALL", seasonYear: year, label: `${year} 秋季` };
  return { season: "WINTER", seasonYear: year + 1, label: `${year + 1} 冬季` };
}

export async function getNextSeason(): Promise<NextSeasonItem[]> {
  const { season, seasonYear } = getNextSeasonInfo();

  const allItems: NextSeasonItem[] = [];
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    const query = `{ Page(page: ${page}, perPage: 50) { pageInfo { hasNextPage } media(season: ${season}, seasonYear: ${seasonYear}, type: ANIME, sort: POPULARITY_DESC) { id title { native romaji } coverImage { large } startDate { year month day } nextAiringEpisode { airingAt episode } episodes format } } }`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) break;

    const json = (await res.json()) as NextSeasonResponse;
    const media = json.data?.Page?.media ?? [];
    hasNext = json.data?.Page?.pageInfo?.hasNextPage ?? false;

    for (const m of media) {
      allItems.push({
        id: m.id,
        title: { native: m.title.native, romaji: m.title.romaji },
        cover: m.coverImage.large,
        startDate: {
          year: m.startDate.year ?? 0,
          month: m.startDate.month ?? 0,
          day: m.startDate.day,
        },
        airingAt: m.nextAiringEpisode?.airingAt ?? null,
        episode: m.nextAiringEpisode?.episode ?? null,
        episodes: m.episodes,
        format: m.format,
      });
    }

    page++;
  }

  return allItems;
}

export async function getAiringAt(title: string): Promise<{ airingAt: number; episode: number } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(ANILIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: buildQuery(title) }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const json = (await res.json()) as AniListResponse;
    const media = json.data?.Page?.media?.[0];
    if (!media?.nextAiringEpisode) return null;

    return {
      airingAt: media.nextAiringEpisode.airingAt,
      episode: media.nextAiringEpisode.episode,
    };
  } catch {
    return null;
  }
}
