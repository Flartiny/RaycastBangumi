import { useEffect, useState } from "react";
import { Action, ActionPanel, Color, Image, List, getPreferenceValues } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { getUserCollections } from "./api/client";
import { SubjectDetail } from "./subject-detail";
import { CollectionTypeLabel, SubjectTypeLabel } from "./api/types";
import type { CollectionType, UserCollection } from "./api/types";

interface Preferences {
  accessToken: string;
  username: string;
}

const LIMIT = 20;

const COLLECTION_TYPES: { label: string; value: string }[] = [
  { label: "想看", value: "1" },
  { label: "看过", value: "2" },
  { label: "在看", value: "3" },
  { label: "搁置", value: "4" },
  { label: "抛弃", value: "5" },
];

const RATE_COLORS: Record<number, Color> = {
  10: Color.Red,
  9: Color.Red,
  8: Color.Orange,
  7: Color.Yellow,
  6: Color.Yellow,
  5: Color.Green,
};

export default function Command() {
  const { accessToken, username } = getPreferenceValues<Preferences>();
  const [collectionType, setCollectionType] = useState("3");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [collectionType]);

  const {
    isLoading,
    data: result,
    error,
  } = useCachedPromise(
    async (type: string, pageNum: number) => {
      return getUserCollections({
        username,
        type: parseInt(type),
        limit: LIMIT,
        offset: (pageNum - 1) * LIMIT,
      });
    },
    [collectionType, page],
    {
      keepPreviousData: true,
      execute: !!accessToken && !!username,
    },
  );

  const collections = result?.data ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const typeLabel = CollectionTypeLabel[parseInt(collectionType) as CollectionType];

  function goNext() {
    setPage((p) => Math.min(p + 1, totalPages));
  }

  function goPrev() {
    setPage((p) => Math.max(p - 1, 1));
  }

  function goFirst() {
    setPage(1);
  }

  function goLast() {
    setPage(totalPages);
  }

  const showContent = accessToken && username && !error;

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder={`筛选${typeLabel}条目...`}
      searchBarAccessory={
        <List.Dropdown
          tooltip="收藏状态"
          onChange={setCollectionType}
          value={collectionType}
        >
          {COLLECTION_TYPES.map((opt) => (
            <List.Dropdown.Item
              key={opt.value}
              title={opt.label}
              value={opt.value}
            />
          ))}
        </List.Dropdown>
      }
    >
      {!accessToken && (
        <List.EmptyView
          title="未配置 Access Token"
          description="请在扩展偏好设置中填入 Bangumi Access Token"
        />
      )}
      {accessToken && !username && (
        <List.EmptyView
          title="未配置用户名"
          description="请在扩展偏好设置中填入你的 Bangumi 用户名"
        />
      )}
      {error && (
        <List.EmptyView title="加载失败" description={error.message} />
      )}
      {!isLoading && showContent && collections.length === 0 && page === 1 && (
        <List.EmptyView
          title="暂无数据"
          description={`没有${typeLabel}条目`}
        />
      )}
      {!isLoading && showContent && collections.length === 0 && page > 1 && (
        <List.EmptyView
          title="翻过头了"
          description={`第 ${page} 页无数据，共 ${totalPages} 页`}
          actions={
            <ActionPanel>
              <Action
                title="前一页"
                shortcut={{ key: "arrowLeft", modifiers: [] }}
                onAction={goPrev}
              />
              <Action
                title="回到第 1 页"
                shortcut={{ key: "home", modifiers: [] }}
                onAction={goFirst}
              />
            </ActionPanel>
          }
        />
      )}
      {showContent && (
        <List.Section
          title={`${typeLabel} · 第 ${page} / ${totalPages} 页 · 共 ${total} 条`}
        >
          {collections.map((item) => (
            <CollectionListItem
              key={item.subject_id}
              collection={item}
              page={page}
              totalPages={totalPages}
              onPrev={goPrev}
              onNext={goNext}
              onFirst={goFirst}
              onLast={goLast}
            />
          ))}
        </List.Section>
      )}
    </List>
  );
}

function CollectionListItem({
  collection,
  page,
  totalPages,
  onPrev,
  onNext,
  onFirst,
  onLast,
}: {
  collection: UserCollection;
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  onFirst: () => void;
  onLast: () => void;
}) {
  const subject = collection.subject;
  const typeLabel = SubjectTypeLabel[subject.type] || "未知";
  const rateText = collection.rate ? `★ ${collection.rate}` : "";
  const rateColor = collection.rate ? RATE_COLORS[collection.rate] : undefined;

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
        ...(rateText ? [{ tag: { value: rateText, color: rateColor } }] : []),
        { text: typeLabel },
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
              <List.Item.Detail.Metadata.Label title="类型" text={typeLabel} />
              <List.Item.Detail.Metadata.Label
                title="Bangumi 评分"
                text={subject.rating?.score?.toFixed(1) || "暂无"}
              />
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Label
                title="我的评分"
                text={collection.rate ? `${collection.rate} / 10` : "未评分"}
              />
              <List.Item.Detail.Metadata.Label
                title="收藏状态"
                text={CollectionTypeLabel[collection.type]}
              />
              {collection.tags.length > 0 && (
                <List.Item.Detail.Metadata.TagList title="标签">
                  {collection.tags.map((tag) => (
                    <List.Item.Detail.Metadata.TagList.Item
                      key={tag}
                      text={tag}
                    />
                  ))}
                </List.Item.Detail.Metadata.TagList>
              )}
              {collection.ep_status > 0 && (
                <List.Item.Detail.Metadata.Label
                  title="观看进度"
                  text={`${collection.ep_status} / ${subject.eps || "?"} 话`}
                />
              )}
              {collection.comment && (
                <>
                  <List.Item.Detail.Metadata.Separator />
                  <List.Item.Detail.Metadata.Label
                    title="短评"
                    text={collection.comment}
                  />
                </>
              )}
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Label
                title="更新时间"
                text={collection.updated_at?.slice(0, 10) || ""}
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
              target={
                <SubjectDetail id={subject.id} />
              }
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
            {page > 1 && (
              <Action
                title="前一页"
                shortcut={{ key: "arrowLeft", modifiers: [] }}
                onAction={onPrev}
              />
            )}
            {page < totalPages && (
              <Action
                title="后一页"
                shortcut={{ key: "arrowRight", modifiers: [] }}
                onAction={onNext}
              />
            )}
            {page !== 1 && (
              <Action
                title="回到第 1 页"
                shortcut={{ key: "home", modifiers: [] }}
                onAction={onFirst}
              />
            )}
            {page !== totalPages && totalPages > 1 && (
              <Action
                title="跳到最后页"
                shortcut={{ key: "end", modifiers: [] }}
                onAction={onLast}
              />
            )}
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
