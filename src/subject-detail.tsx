import { Action, ActionPanel, Detail } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { getSubject, getSubjectCharacters, getSubjectPersons } from "./api/client";
import type { RelatedCharacter, RelatedPerson, Subject } from "./api/types";

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
              <Detail.Metadata.Label title="名称" text={truncate(subject.name_cn || subject.name, 20)} />
              <Detail.Metadata.Label title="评分" text={formatScore(subject.rating?.score)} />
              <Detail.Metadata.Label title="排名" text={subject.rank ? `#${subject.rank}` : "暂无"} />
              {subject.date && <Detail.Metadata.Label title="放送日期" text={subject.date} />}
              {subject.eps > 0 && (
                <Detail.Metadata.Label title="话数" text={String(subject.eps)} />
              )}
            </>
          )}
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.CopyToClipboard
              title="复制名称"
              content={subject?.name_cn || subject?.name || ""}
            />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action.OpenInBrowser
              title="在 Bangumi 中打开"
              shortcut={{ key: "enter", modifiers: ["cmd"] }}
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

  // ---------- Row 1: cover image ----------
  if (subject) {
    const img = subject.images?.large ?? subject.images?.common ?? "";
    if (img) {
      lines.push(`![cover](${img}?raycast-width=280)`);
      lines.push("");
    }
  }

  // ---------- Row 2: Staff ----------
  const staffLines = buildStaffSection(persons);
  if (staffLines.length > 1) {
    lines.push("## Staff");
    lines.push("");
    lines.push(...staffLines);
    lines.push("");
  }

  // ---------- Row 3: Cast ----------
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
