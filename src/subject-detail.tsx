import { useState } from "react";
import { Action, ActionPanel, Detail, Keyboard, confirmAlert, getPreferenceValues } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import {
  getEpisodes,
  getSubject,
  getSubjectCharacters,
  getSubjectPersons,
  getUserCollection,
  patchSubjectEpisodes,
  postUserCollection,
} from "./api/client";
import { getUsername } from "./oauth";
import { CollectionTypeLabel } from "./api/types";
import type { CollectionType, RelatedCharacter, RelatedPerson, Subject } from "./api/types";

interface Preferences {
  confirmBeforeWatching: boolean;
  autoMarkWatched: boolean;
  confirmProgressUpdate: boolean;
}

interface Props {
  id: number;
}

export function SubjectDetail({ id }: Props) {
  const preferences = getPreferenceValues<Preferences>();

  const { isLoading: loadingSubject, data: subject } = useCachedPromise(getSubject, [id], {
    keepPreviousData: true,
  });
  const { isLoading: loadingPersons, data: persons } = useCachedPromise(getSubjectPersons, [id], {
    keepPreviousData: true,
  });
  const { isLoading: loadingChars, data: characters } = useCachedPromise(getSubjectCharacters, [id], {
    keepPreviousData: true,
  });
  const {
    data: collection,
    revalidate: revalidateCollection,
  } = useCachedPromise(
    async (subjectId: number) => {
      const uname = await getUsername();
      if (!uname) return null;
      try {
        return await getUserCollection(uname, subjectId);
      } catch {
        return null;
      }
    },
    [id],
    { keepPreviousData: true },
  );
  const { data: episodeData } = useCachedPromise(
    async (subjectId: number) => {
      try {
        return await getEpisodes(subjectId);
      } catch {
        return null;
      }
    },
    [id],
    { keepPreviousData: true },
  );

  const isLoading = loadingSubject || loadingPersons || loadingChars;
  const markdown = buildMarkdown(subject ?? null, persons ?? null, characters ?? null);

  const currentType = collection?.type;
  const currentEp = collection?.ep_status ?? 0;
  const totalEp = subject?.total_episodes ?? 0;
  const sortedEpisodes = episodeData?.data?.slice().sort((a, b) => a.sort - b.sort) ?? [];
  const mainEpisodes = sortedEpisodes.filter((e) => e.type === 0);

  const [targetEp, setTargetEp] = useState<number | null>(null);
  // The actual target: if user has adjusted, use targetEp; otherwise use currentEp
  const displayTarget = targetEp ?? currentEp;
  const isDirty = targetEp !== null && targetEp !== currentEp;

  function adjustTarget(delta: number) {
    setTargetEp((prev) => {
      const base = prev ?? currentEp;
      return Math.max(0, Math.min(totalEp, base + delta));
    });
  }

  async function mutateCollection(data: { type?: number }) {
    await postUserCollection(id, data);
        await revalidateCollection();
  }

  async function ensureCollected(): Promise<boolean> {
    if (!collection) {
      const confirmed = await confirmAlert({
        title: "收藏并切换到「在看」？",
        message: "更新观看进度需要先将条目以「在看」状态收藏",
        primaryAction: { title: "收藏" },
        dismissAction: { title: "取消" },
      });
      if (!confirmed) return false;
      await postUserCollection(id, { type: 3 });
      await revalidateCollection();
      return true;
    }
    if (currentType !== 3) {
      if (preferences.confirmBeforeWatching) {
        const confirmed = await confirmAlert({
          title: "切换到「在看」？",
          message: `当前收藏状态为「${CollectionTypeLabel[currentType as CollectionType] || "其他"}」，需要切换到「在看」才能更新进度`,
          primaryAction: { title: "切换" },
          dismissAction: { title: "取消" },
        });
        if (!confirmed) return false;
      }
      await mutateCollection({ type: 3 });
    }
    return true;
  }

  async function doMarkEpisodes(from: number, to: number, epType: number) {
    try {
      const ids = mainEpisodes.slice(from, to).map((e) => e.id);
      if (ids.length === 0) return;
      await patchSubjectEpisodes(id, { episode_id: ids, type: epType });
          } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("need to add subject")) {
        // API says not collected — retry with ensureCollected
        const ok = await ensureCollected();
        if (!ok) throw e;
        await patchSubjectEpisodes(id, { episode_id: mainEpisodes.slice(from, to).map((ep) => ep.id), type: epType });
      } else {
        throw e;
      }
    }
  }

  async function commitProgress() {
    if (!isDirty || targetEp === null) return;

    const ok = await ensureCollected();
    if (!ok) return;

    const from = Math.min(currentEp, targetEp);
    const to = Math.max(currentEp, targetEp);

    if (targetEp > currentEp) {
      await doMarkEpisodes(from, to, 2);
      // Handle reaching total
      if (targetEp >= totalEp) {
        if (preferences.autoMarkWatched) {
          await mutateCollection({ type: 2 });
        } else {
          const markWatched = await confirmAlert({
            title: "标记为「看过」？",
            message: `观看进度已达 ${totalEp} 集（总集数），是否标记为「看过」？`,
            primaryAction: { title: "标记" },
            dismissAction: { title: "暂不" },
          });
          if (markWatched) {
            await mutateCollection({ type: 2 });
          }
        }
      }
    } else if (targetEp < currentEp) {
      await doMarkEpisodes(from, to, 0);
    }

    setTargetEp(null);
    await revalidateCollection();
  }

  async function handleSetCollectionType(type: CollectionType) {
    // Ensure collection exists before progress operations
    if (!collection) {
      await postUserCollection(id, { type });
      await revalidateCollection();
      return;
    }

    if (type === 2 && totalEp > 0 && preferences.confirmProgressUpdate) {
      const shouldUpdate = await confirmAlert({
        title: "更新观看进度？",
        message: `是否将所有剧集标记为已看（共 ${totalEp} 集）？`,
        primaryAction: { title: "更新" },
        dismissAction: { title: "暂不更新" },
      });
      if (shouldUpdate) {
        await mutateCollection({ type });
        await doMarkEpisodes(0, mainEpisodes.length, 2);
        return;
      }
    }

    await mutateCollection({ type });
  }

  // Build progress display text
  function progressText() {
    if (totalEp <= 0) return null;
    if (isDirty) {
      return `${currentEp} → ${targetEp} / ${totalEp}`;
    }
    return `${currentEp} / ${totalEp}`;
  }

  const progressLabel = progressText();

  return (
    <Detail
      isLoading={isLoading}
      markdown={markdown}
      navigationTitle={subject?.name_cn || subject?.name || "条目详情"}
      metadata={
        <Detail.Metadata>
          {subject && (
            <>
              <Detail.Metadata.Label title="名称" text={truncate(subject.name_cn || subject.name, 20)} />
              <Detail.Metadata.Label title="评分" text={formatScore(subject.rating?.score)} />
              <Detail.Metadata.Label title="排名" text={subject.rank ? `#${subject.rank}` : "暂无"} />
              {subject.date && <Detail.Metadata.Label title="放送日期" text={subject.date} />}
              <Detail.Metadata.Label
                title="收藏状态"
                text={collection ? CollectionTypeLabel[collection.type] : "未收藏"}
              />
              {progressLabel && (
                <Detail.Metadata.Label title="观看进度" text={progressLabel} />
              )}
            </>
          )}
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            {isDirty && totalEp > 0 ? (
              <Action
                title={`提交进度: ${currentEp}→${targetEp}/${totalEp}`}
                onAction={commitProgress}
              />
            ) : (
              <Action.CopyToClipboard
                title="复制名称"
                content={subject?.name_cn || subject?.name || ""}
              />
            )}
          </ActionPanel.Section>

          {totalEp > 0 && (
            <ActionPanel.Section title="观看进度">
              <Action
                title="−1 集"
                shortcut={{ key: "arrowLeft", modifiers: [] }}
                onAction={() => adjustTarget(-1)}
              />
              <Action
                title="+1 集"
                shortcut={{ key: "arrowRight", modifiers: [] }}
                onAction={() => adjustTarget(1)}
              />
            </ActionPanel.Section>
          )}

          <ActionPanel.Section title="收藏状态">
            <ActionPanel.Submenu
              title={collection ? `当前: ${CollectionTypeLabel[collection.type]}` : "标记收藏状态"}
            >
              {([1, 2, 3, 4, 5] as CollectionType[]).map((type) => (
                <Action
                  key={type}
                  title={CollectionTypeLabel[type]}
                  onAction={() => handleSetCollectionType(type)}
                />
              ))}
            </ActionPanel.Submenu>
          </ActionPanel.Section>

          <ActionPanel.Section>
            <Action.OpenInBrowser
              title="在 Bangumi 中打开"
              shortcut={Keyboard.Shortcut.Common.Open}
              url={`https://bgm.tv/subject/${id}`}
            />
            <Action.CopyToClipboard
              title="复制条目链接"
              content={`https://bgm.tv/subject/${id}`}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

function buildMarkdown(
  subject: Subject | null,
  persons: RelatedPerson[] | null,
  characters: RelatedCharacter[] | null,
): string {
  const lines: string[] = [];

  if (subject?.images?.large) {
    lines.push(`![${subject.name_cn || subject.name}](${subject.images.large}?raycast-width=280)`);
    lines.push("");
  }

  const staffLines = buildStaffSection(persons);
  if (staffLines.length > 1) {
    lines.push("## Staff");
    lines.push("");
    lines.push(...staffLines);
    lines.push("");
  }

  const castLines = buildCastSection(characters);
  if (castLines.length > 1) {
    lines.push("## 角色 / Cast");
    lines.push("");
    lines.push(...castLines);
    lines.push("");
  }

  if (lines.length === 0) return "加载中...";
  return lines.join("\n");
}

function buildStaffSection(persons: RelatedPerson[] | null): string[] {
  if (!persons || persons.length === 0) return [];

  const grouped = new Map<string, string[]>();
  for (const p of persons) {
    const role = p.relation || "其他";
    const names = grouped.get(role) ?? [];
    names.push(p.name);
    grouped.set(role, names);
  }

  const lines: string[] = [];
  for (const [role, names] of grouped) {
    lines.push(`- **${role}**: ${names.join("、")}`);
  }
  return lines;
}

function buildCastSection(characters: RelatedCharacter[] | null): string[] {
  if (!characters || characters.length === 0) return [];

  const lines: string[] = [];
  for (const ch of characters) {
    const actorNames = ch.actors.map((a) => a.name).join("、");
    if (actorNames) {
      lines.push(`- ${ch.name} **CV:** ${actorNames}`);
    }
  }
  return lines;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function formatScore(score: number | undefined): string {
  if (score === undefined || score === null) return "暂无";
  return `${score.toFixed(1)} / 10`;
}
