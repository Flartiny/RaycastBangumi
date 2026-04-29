import { Action, ActionPanel, Detail } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { getSubject, getSubjectCharacters, getSubjectPersons } from "./api/client";
import type { RelatedCharacter, RelatedPerson, Subject } from "./api/types";
import { SubjectTypeLabel } from "./api/types";

interface Props {
  id: number;
}

export function SubjectDetail({ id }: Props) {
  const { isLoading: loadingSubject, data: subject } = useCachedPromise(
    getSubject,
    [id],
    { keepPreviousData: true },
  );
  const { isLoading: loadingPersons, data: persons } = useCachedPromise(
    getSubjectPersons,
    [id],
    { keepPreviousData: true },
  );
  const { isLoading: loadingChars, data: characters } = useCachedPromise(
    getSubjectCharacters,
    [id],
    { keepPreviousData: true },
  );

  const isLoading = loadingSubject || loadingPersons || loadingChars;
  const markdown = buildMarkdown(subject ?? null, persons ?? null, characters ?? null);

  return (
    <Detail
      isLoading={isLoading}
      markdown={markdown}
      navigationTitle={subject?.name_cn || subject?.name || "条目详情"}
      metadata={
        <Detail.Metadata>
          {subject && (
            <>
              <Detail.Metadata.Label title="名称" text={subject.name_cn || subject.name} />
              {subject.name_cn && (
                <Detail.Metadata.Label title="原文" text={subject.name} />
              )}
              <Detail.Metadata.Label
                title="类型"
                text={SubjectTypeLabel[subject.type] || `#${subject.type}`}
              />
              <Detail.Metadata.Label
                title="评分"
                text={subject.rating?.score?.toFixed(1) ?? "暂无"}
              />
              <Detail.Metadata.Label
                title="评分人数"
                text={String(subject.rating?.total ?? 0)}
              />
              <Detail.Metadata.Label
                title="排名"
                text={subject.rank ? `#${subject.rank}` : "暂无"}
              />
              {subject.date && (
                <Detail.Metadata.Label title="日期" text={subject.date} />
              )}
              {subject.eps > 0 && (
                <Detail.Metadata.Label title="话数" text={String(subject.eps)} />
              )}
              {subject.tags && subject.tags.length > 0 && (
                <Detail.Metadata.TagList title="标签">
                  {subject.tags.slice(0, 6).map((t) => (
                    <Detail.Metadata.TagList.Item key={t.name} text={t.name} />
                  ))}
                </Detail.Metadata.TagList>
              )}
            </>
          )}
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action.OpenInBrowser
            title="在 Bangumi 中打开"
            url={`https://bgm.tv/subject/${id}`}
          />
          <Action.CopyToClipboard
            title="复制条目链接"
            content={`https://bgm.tv/subject/${id}`}
          />
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

  // Cover image
  if (subject?.images?.large) {
    lines.push(
      `![${subject.name_cn || subject.name}](${subject.images.large}?raycast-width=320)`,
    );
    lines.push("");
  }

  // Summary
  if (subject?.summary) {
    lines.push("## 简介");
    lines.push("");
    lines.push(subject.summary);
    lines.push("");
  }

  // Staff
  const staffLines = buildStaffSection(persons);
  if (staffLines.length > 1) {
    lines.push("## Staff");
    lines.push("");
    lines.push(...staffLines);
    lines.push("");
  }

  // Cast
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
