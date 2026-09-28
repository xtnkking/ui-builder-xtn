import { createRef } from "react";
import {
  Skeleton,
  Spinner,
  Tag,
  type SkeletonProps,
  type SpinnerProps,
  type TagProps,
} from "../../src/personal-ui";

const skeletonProps: SkeletonProps = {
  width: "12rem",
  "aria-describedby": "loading-description",
  onAnimationEnd: () => undefined,
};
const spinnerProps: SpinnerProps = {
  label: "Loading accounts",
  "aria-live": "polite",
  onMouseEnter: () => undefined,
};
const tagProps: TagProps = {
  tone: "success",
  selected: true,
  "aria-label": "Active account",
  onMouseEnter: () => undefined,
};
void skeletonProps;
void spinnerProps;
void tagProps;

const allowedUsage = (
  <>
    <Skeleton width={160} aria-describedby="loading-description" data-track="skeleton" />
    <Spinner label="Loading accounts" aria-live="polite" data-track="spinner" />
    <Tag tone="success" onMouseEnter={() => undefined} data-track="tag">Active</Tag>
  </>
);
void allowedUsage;

// @ts-expect-error fixed controls do not expose className
const skeletonClassName = <Skeleton className="foreign" />;
// @ts-expect-error fixed controls do not expose style
const skeletonStyle = <Skeleton style={{ color: "red" }} />;
// @ts-expect-error fixed controls do not expose Emotion-style css props
const skeletonCss = <Skeleton css={{ color: "red" }} />;
// @ts-expect-error fixed controls do not expose sx props
const skeletonSx = <Skeleton sx={{ color: "red" }} />;
// @ts-expect-error fixed controls do not expose utility-class props
const skeletonTw = <Skeleton tw="text-red" />;
// @ts-expect-error fixed controls do not expose raw DOM refs
const skeletonRef = <Skeleton ref={createRef<HTMLSpanElement>()} />;
// @ts-expect-error fixed controls do not expose raw HTML injection
const skeletonHtml = <Skeleton dangerouslySetInnerHTML={{ __html: "unsafe" }} />;
// @ts-expect-error reserved ownership attributes are never public
const skeletonOwner = <Skeleton data-pui-owner="Consumer" />;
// @ts-expect-error every reserved data-pui attribute is never public
const skeletonSlot = <Skeleton data-pui-slot="foreign" />;
// @ts-expect-error the wildcard contract rejects unregistered reserved keys in Props objects
const skeletonPrivateData: SkeletonProps = { "data-pui-private": "foreign" };
// @ts-expect-error Skeleton is a decorative empty placeholder
const skeletonChildren = <Skeleton children="Hidden content" />;

// @ts-expect-error Spinner also uses the protected public-control contract
const spinnerClassName = <Spinner className="foreign" />;
// @ts-expect-error Spinner cannot accept known reserved internal markers in JSX
const spinnerOwner = <Spinner data-pui-floating-root="foreign" />;
// @ts-expect-error Spinner owns its status content
const spinnerChildren = <Spinner children="Hidden content" />;
// @ts-expect-error Tag also uses the protected public-control contract
const tagStyle = <Tag style={{ color: "red" }}>Active</Tag>;
// @ts-expect-error Tag cannot accept reserved ownership attributes
const tagOwner = <Tag data-pui-owner="Consumer">Active</Tag>;

void skeletonClassName;
void skeletonStyle;
void skeletonCss;
void skeletonSx;
void skeletonTw;
void skeletonRef;
void skeletonHtml;
void skeletonOwner;
void skeletonSlot;
void skeletonPrivateData;
void skeletonChildren;
void spinnerClassName;
void spinnerOwner;
void spinnerChildren;
void tagStyle;
void tagOwner;
