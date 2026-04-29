import { getAccessToken } from "../oauth";
import type {
  CalendarItem,
  PagedResponse,
  RelatedCharacter,
  RelatedPerson,
  SearchResponse,
  Subject,
  User,
  UserCollection,
} from "./types";

const BASE_URL = "https://api.bgm.tv";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    "User-Agent": "RaycastBangumi/1.0",
    Accept: "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const authHeaders = await getAuthHeaders();
  const headers = { ...authHeaders, ...(options.headers || {}) };

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Bangumi API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

/** GET /calendar — 每日放送 */
export async function getCalendar(): Promise<CalendarItem[]> {
  return request<CalendarItem[]>("/calendar");
}

/** POST /v0/search/subjects — 条目搜索 */
export async function searchSubjects(params: {
  keyword: string;
  sort?: "match" | "rank" | "date";
  type?: number[];
  limit?: number;
  offset?: number;
}): Promise<SearchResponse> {
  const body: Record<string, unknown> = {
    keyword: params.keyword,
    sort: params.sort || "rank",
    limit: params.limit || 30,
  };

  if (params.type && params.type.length > 0) {
    body.filter = { type: params.type };
  }

  return request<SearchResponse>("/v0/search/subjects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** GET /v0/subjects/{id} — 获取条目详情 */
export async function getSubject(id: number): Promise<Subject> {
  return request<Subject>(`/v0/subjects/${id}`);
}

/** GET /v0/me — 获取当前用户信息 */
export async function getMyself(): Promise<User> {
  return request<User>("/v0/me");
}

/** GET /v0/users/{username}/collections — 获取用户收藏 */
export async function getUserCollections(params: {
  username: string;
  subjectType?: number;
  type?: number;
  limit?: number;
  offset?: number;
}): Promise<PagedResponse<UserCollection>> {
  const uname = params.username;

  const searchParams = new URLSearchParams();
  if (params.subjectType) searchParams.set("subject_type", String(params.subjectType));
  if (params.type) searchParams.set("type", String(params.type));
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.offset) searchParams.set("offset", String(params.offset));

  const qs = searchParams.toString();
  return request<PagedResponse<UserCollection>>(
    `/v0/users/${uname}/collections${qs ? `?${qs}` : ""}`,
  );
}

/** POST /v0/users/-/collections/{subject_id} — 新增或修改收藏 */
export async function postUserCollection(
  subjectId: number,
  data: {
    type?: number;
    rate?: number;
    comment?: string;
    tags?: string[];
    private?: boolean;
    ep_status?: number;
  },
): Promise<void> {
  await request(`/v0/users/-/collections/${subjectId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

/** GET /v0/users/{username}/collections/{subject_id} — 获取单个条目收藏状态 */
export async function getUserCollection(
  username: string,
  subjectId: number,
): Promise<UserCollection> {
  return request<UserCollection>(
    `/v0/users/${username}/collections/${subjectId}`,
  );
}

/** GET /v0/subjects/{id}/persons — 获取条目关联人物 */
export async function getSubjectPersons(
  subjectId: number,
): Promise<RelatedPerson[]> {
  return request<RelatedPerson[]>(`/v0/subjects/${subjectId}/persons`);
}

/** GET /v0/subjects/{id}/characters — 获取条目关联角色 */
export async function getSubjectCharacters(
  subjectId: number,
): Promise<RelatedCharacter[]> {
  return request<RelatedCharacter[]>(`/v0/subjects/${subjectId}/characters`);
}
