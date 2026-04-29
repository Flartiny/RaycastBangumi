import { useState } from "react";
import { Action, ActionPanel, Color, Image, List, getPreferenceValues } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { getUserCollections } from "./api/client";
import { CollectionTypeLabel, SubjectTypeLabel } from "./api/types";
import type { CollectionType, UserCollection } from "./api/types";

interface Preferences {
  accessToken: string;
  username: string;
}

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
  const [collectionType, setCollectionType] = useState("3"); // default: 在看

  const {
    isLoading,
    data: result,
    error,
    revalidate,
  } = useCachedPromise(
    async (type: string) => {
      return getUserCollections({
        username,
        type: parseInt(type),
        limit: 50,
      });
    },
    [collectionType],
    {
      keepPreviousData: true,
      execute: !!accessToken && !!username,
    },
  );

  const collections = result?.data ?? [];

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="筛选收藏条目..."
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
      {!isLoading && collections.length === 0 && accessToken && username && (
        <List.EmptyView
          title="暂无数据"
          description={`没有${CollectionTypeLabel[parseInt(collectionType) as CollectionType]}条目`}
        />
      )}
      {collections.map((item) => (
        <CollectionListItem
          key={item.subject_id}
          collection={item}
          onRevalidate={revalidate}
        />
      ))}
    </List>
  );
}

function CollectionListItem({
  collection,
}: {
  collection: UserCollection;
  onRevalidate: () => void;
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
