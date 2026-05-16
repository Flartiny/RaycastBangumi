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
