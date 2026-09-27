import { createRef } from "react";
import {
  Attachment,
  Avatar,
  AvatarGroup,
  Badge,
  Card,
  CodeBlock,
  DescriptionList,
  Gallery,
  List,
  Media,
  Meter,
  Statistic,
  StatusIndicator,
  Timeline,
} from "../../src/personal-ui";

const allowedUsage = (
  <>
    <List items={[{ id: "one" }]} itemKey={(item) => item.id} renderItem={(item) => item.id} data-track="list" />
    <DescriptionList items={[{ id: "one", term: "Name", description: "Northstar" }]} title="Details" />
    <Card heading="Account" data-track="card">Content</Card>
    <Avatar name="Ada Lovelace" imageProps={{ loading: "eager" }} data-track="avatar" />
    <AvatarGroup ariaLabel="Team"><Avatar name="Ada Lovelace" /></AvatarGroup>
    <Badge count={3}><span>Inbox</span></Badge>
    <StatusIndicator label="Active" tone="success" title="Status" />
    <Statistic label="Revenue" value="42" data-track="statistic" />
    <CodeBlock code="const answer = 42;" language="ts" data-track="code" />
    <Media src="/photo.png" alt="Preview" imageProps={{ loading: "eager" }} data-track="media" />
    <Attachment name="report.pdf" data-track="attachment" />
    <Gallery items={[{ id: "one", src: "/photo.png", alt: "Preview" }]} ariaLabel="Gallery" data-track="gallery" />
    <Meter label="Storage" ariaLabel="Storage used" value={42} data-track="meter" />
    <Timeline items={[{ id: "one", title: "Created" }]} data-track="timeline" />
  </>
);
void allowedUsage;

// @ts-expect-error List keeps styling internal
const listClassName = <List items={[]} itemKey={() => "item"} renderItem={() => null} className="foreign" />;
// @ts-expect-error DescriptionList keeps styling internal
const descriptionClassName = <DescriptionList items={[]} className="foreign" />;
// @ts-expect-error Card keeps styling internal
const cardClassName = <Card className="foreign" />;
// @ts-expect-error Avatar keeps styling internal
const avatarClassName = <Avatar name="Ada" className="foreign" />;
// @ts-expect-error nested image props cannot restyle Avatar internals
const avatarImageStyle = <Avatar name="Ada" src="/ada.png" imageProps={{ style: { color: "red" } }} />;
// @ts-expect-error nested image props cannot receive raw refs
const avatarImageRef = <Avatar name="Ada" src="/ada.png" imageProps={{ ref: createRef<HTMLImageElement>() }} />;
// @ts-expect-error AvatarGroup keeps styling internal
const avatarGroupClassName = <AvatarGroup ariaLabel="Team" className="foreign" />;
// @ts-expect-error Badge keeps styling internal
const badgeClassName = <Badge count={1} className="foreign" />;
// @ts-expect-error StatusIndicator keeps styling internal
const statusClassName = <StatusIndicator label="Active" className="foreign" />;
// @ts-expect-error Statistic keeps styling internal
const statisticClassName = <Statistic label="Revenue" value="42" className="foreign" />;
// @ts-expect-error CodeBlock keeps styling internal
const codeBlockClassName = <CodeBlock code="42" className="foreign" />;
// @ts-expect-error Media keeps styling internal
const mediaClassName = <Media src="/photo.png" alt="Preview" className="foreign" />;
// @ts-expect-error nested media props cannot restyle the image
const mediaImageStyle = <Media src="/photo.png" alt="Preview" imageProps={{ className: "foreign" }} />;
// @ts-expect-error nested media props cannot restyle the video
const mediaVideoStyle = <Media kind="video" src="/clip.mp4" alt="Preview" videoProps={{ style: { color: "red" } }} />;
// @ts-expect-error Attachment keeps styling internal
const attachmentClassName = <Attachment name="report.pdf" className="foreign" />;
// @ts-expect-error Gallery keeps styling internal
const galleryStyle = <Gallery items={[]} ariaLabel="Gallery" style={{ color: "red" }} />;
// @ts-expect-error Meter keeps styling internal
const meterClassName = <Meter label="Storage" ariaLabel="Storage used" value={42} className="foreign" />;
// @ts-expect-error Timeline keeps styling internal
const timelineClassName = <Timeline items={[]} className="foreign" />;
// @ts-expect-error fixed controls never expose ownership attributes
const cardOwner = <Card data-pui-owner="Consumer" />;

void listClassName;
void descriptionClassName;
void cardClassName;
void avatarClassName;
void avatarImageStyle;
void avatarImageRef;
void avatarGroupClassName;
void badgeClassName;
void statusClassName;
void statisticClassName;
void codeBlockClassName;
void mediaClassName;
void mediaImageStyle;
void mediaVideoStyle;
void attachmentClassName;
void galleryStyle;
void meterClassName;
void timelineClassName;
void cardOwner;
