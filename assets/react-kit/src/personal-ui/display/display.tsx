import {
  Children,
  useEffect,
  useId,
  useRef,
  useState,
  type HTMLAttributes,
  type ImgHTMLAttributes,
  type MeterHTMLAttributes,
  type ReactNode,
  type VideoHTMLAttributes,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  Download,
  FileText,
  Minus,
  Trash2,
} from "lucide-react";
import { ClipboardButton } from "../action/actions";
import type { PublicControlProps } from "../foundation/contracts";
import { useControllableState } from "../internal/controllable-state";
import { InternalCollapse } from "../internal/collapse";
import { AspectRatio } from "../foundation/layout";
import { sanitizeFixedControlProps } from "../internal/fixed-control-props";
import { usePersonalUILocale } from "../foundation/locale";
import { IconButton } from "../foundation/primitives";
import { OverflowText, Tooltip } from "../overlay/overlays";
import { assertUniqueIdentities, cx, type CSSVariableProperties } from "../internal/utils";

export type ListProps<T> = PublicControlProps<Omit<
  HTMLAttributes<HTMLElement>,
  "aria-label" | "children"
>> & {
  items: readonly T[];
  itemKey: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  ariaLabel?: string;
  ordered?: boolean;
  divided?: boolean;
  density?: "compact" | "comfortable";
  empty?: ReactNode;
};

export function List<T>(rawProps: ListProps<T>) {
  const safeProps = sanitizeFixedControlProps(rawProps, ["aria-label", "children"]);
  const {
    items,
    itemKey,
    renderItem,
    ariaLabel,
    ordered = false,
    divided = true,
    density = "comfortable",
    empty,
    ...rootProps
  } = safeProps;
  const keys = items.map(itemKey);
  assertUniqueIdentities("List", "itemKey result", keys);
  if (!items.length) {
    return empty != null ? (
      <div {...rootProps} className="pui-list-empty" role="status" data-pui-owner="List">{empty}</div>
    ) : null;
  }
  const Component = ordered ? "ol" : "ul";
  return (
    <Component
      {...rootProps}
      data-pui-owner="List"
      className={cx("pui-list", divided && "pui-list--divided")}
      aria-label={ariaLabel}
      data-density={density}
    >
      {items.map((item, index) => (
        <li key={keys[index]} className="pui-list__item">{renderItem(item, index)}</li>
      ))}
    </Component>
  );
}

export interface DescriptionListItem {
  id: string;
  term: ReactNode;
  description: ReactNode;
}

export type DescriptionListProps = PublicControlProps<Omit<HTMLAttributes<HTMLDListElement>, "children">> & {
  items: readonly DescriptionListItem[];
  columns?: 1 | 2 | 3;
  divided?: boolean;
};

export function DescriptionList(rawProps: DescriptionListProps) {
  const safeProps = sanitizeFixedControlProps(rawProps, ["children"]);
  const { items, columns = 1, divided = true, ...rootProps } = safeProps;
  assertUniqueIdentities("DescriptionList", "item.id", items.map((item) => item.id));
  return (
    <dl
      {...rootProps}
      data-pui-owner="DescriptionList"
      className={cx("pui-description-list", divided && "pui-description-list--divided")}
      data-columns={columns}
    >
      {items.map((item) => (
        <div className="pui-description-list__item" key={item.id}>
          <dt>{item.term}</dt>
          <dd>{item.description}</dd>
        </div>
      ))}
    </dl>
  );
}

export type CardProps = PublicControlProps<Omit<HTMLAttributes<HTMLElement>, "title">> & {
  heading?: ReactNode;
  description?: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  variant?: "outlined" | "subtle" | "raised";
  padding?: "small" | "medium" | "large";
};

export function Card(rawProps: CardProps) {
  const safeProps = sanitizeFixedControlProps(rawProps, ["title"]);
  const {
    heading,
    description,
    header,
    footer,
    variant = "outlined",
    padding = "medium",
    children,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    ...rootProps
  } = safeProps;
  const headingId = useId();
  return (
    <article
      {...rootProps}
      data-pui-owner="Card"
      className={cx("pui-card", `pui-card--${variant}`)}
      data-padding={padding}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy ?? (heading != null && ariaLabel == null ? headingId : undefined)}
    >
      {header != null || heading != null || description != null ? (
        <header className="pui-card__header">
          <div className="pui-card__heading-copy">
            {heading != null ? <h3 id={headingId}>{heading}</h3> : null}
            {description != null ? <p>{description}</p> : null}
          </div>
          {header != null ? <div className="pui-card__header-content">{header}</div> : null}
        </header>
      ) : null}
      <div className="pui-card__body">{children}</div>
      {footer != null ? <footer className="pui-card__footer">{footer}</footer> : null}
    </article>
  );
}

export type AvatarSize = "small" | "medium" | "large" | "xlarge";

type AvatarImageProps = PublicControlProps<Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "alt" | "children" | "src"
>>;

export type AvatarProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLSpanElement>,
  "aria-label" | "children" | "title"
>> & {
  name: string;
  src?: string;
  alt?: string;
  fallback?: ReactNode;
  size?: AvatarSize;
  decorative?: boolean;
  imageProps?: AvatarImageProps;
};

function avatarInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const value = words.length > 1
    ? `${Array.from(words[0])[0] ?? ""}${Array.from(words[words.length - 1])[0] ?? ""}`
    : Array.from(words[0] ?? "").slice(0, 2).join("");
  return value.toLocaleUpperCase() || "?";
}

export function Avatar(rawProps: AvatarProps) {
  const safeProps = sanitizeFixedControlProps(rawProps, ["aria-label", "children", "title"]);
  const {
    name,
    src,
    alt,
    fallback,
    size = "medium",
    decorative = false,
    imageProps,
    ...rootProps
  } = safeProps;
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [src]);
  const safeImageProps = sanitizeFixedControlProps(imageProps ?? {}, ["alt", "children", "src"]);
  const { onError, ...resolvedImageProps } = safeImageProps;
  return (
    <span
      {...rootProps}
      data-pui-owner="Avatar"
      className="pui-avatar"
      data-size={size}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : (alt ?? name)}
      aria-hidden={decorative || undefined}
      title={decorative ? undefined : (alt ?? name)}
    >
      {src && !imageFailed ? (
        <img
          {...resolvedImageProps}
          src={src}
          alt=""
          draggable={false}
          onError={(event) => {
            onError?.(event);
            setImageFailed(true);
          }}
        />
      ) : <span aria-hidden="true">{fallback ?? avatarInitials(name)}</span>}
    </span>
  );
}

export type AvatarGroupProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLSpanElement>,
  "aria-label"
>> & {
  max?: number;
  ariaLabel: string;
};

export function AvatarGroup(rawProps: AvatarGroupProps) {
  const { plural } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps, ["aria-label"]);
  const { max = 4, ariaLabel, children, ...rootProps } = safeProps;
  if (!Number.isFinite(max) || max < 1) throw new RangeError("AvatarGroup max must be at least one.");
  const entries = Children.toArray(children);
  const visibleCount = Math.max(1, Math.trunc(max));
  const visible = entries.slice(0, visibleCount);
  const overflow = Math.max(0, entries.length - visible.length);
  return (
    <span
      {...rootProps}
      data-pui-owner="AvatarGroup"
      className="pui-avatar-group"
      role="group"
      aria-label={ariaLabel}
    >
      {visible}
      {overflow ? (
        <span className="pui-avatar pui-avatar-group__overflow" data-size="medium" aria-label={plural("avatar.otherItems", overflow)}>
          +{overflow}
        </span>
      ) : null}
    </span>
  );
}

export type BadgeTone = "neutral" | "blue" | "success" | "warning" | "danger";

export type BadgeProps = PublicControlProps<Omit<HTMLAttributes<HTMLSpanElement>, "content">> & {
  content?: ReactNode;
  count?: number;
  max?: number;
  dot?: boolean;
  showZero?: boolean;
  tone?: BadgeTone;
  label?: string;
};

export function Badge(rawProps: BadgeProps) {
  const { message, plural } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps);
  const {
    content,
    count,
    max = 99,
    dot = false,
    showZero = false,
    tone = "danger",
    label,
    children,
    ...rootProps
  } = safeProps;
  if (count !== undefined && (!Number.isFinite(count) || count < 0)) {
    throw new RangeError("Badge count must be a finite non-negative number.");
  }
  if (!Number.isFinite(max) || max < 0) throw new RangeError("Badge max must be non-negative.");
  const normalizedCount = count === undefined ? undefined : Math.trunc(count);
  const visibleCount = normalizedCount !== undefined && normalizedCount > Math.trunc(max)
    ? `${Math.trunc(max)}+`
    : normalizedCount;
  const indicatorContent = dot ? null : (content ?? visibleCount);
  const showIndicator = dot || content != null || (normalizedCount !== undefined && (normalizedCount > 0 || showZero));
  const accessibleLabel = label ?? (
    normalizedCount !== undefined ? plural("badge.notifications", normalizedCount) : dot ? message("badge.newNotification") : undefined
  );
  const indicator = showIndicator ? (
    <span
      className={cx("pui-badge__indicator", dot && "pui-badge__indicator--dot", `pui-badge__indicator--${tone}`)}
    >
      {accessibleLabel ? (
        <>
          {indicatorContent != null ? <span aria-hidden="true">{indicatorContent}</span> : null}
          <span className="pui-sr-only">{accessibleLabel}</span>
        </>
      ) : indicatorContent}
    </span>
  ) : null;
  if (children == null) {
    return indicator ? (
      <span {...rootProps} data-pui-owner="Badge" className="pui-badge">{indicator}</span>
    ) : null;
  }
  return (
    <span {...rootProps} data-pui-owner="Badge" className="pui-badge pui-badge--anchored">
      <span className="pui-badge__anchor">{children}</span>
      {indicator}
    </span>
  );
}

export type StatusIndicatorProps = PublicControlProps<Omit<HTMLAttributes<HTMLSpanElement>, "children">> & {
  tone?: BadgeTone;
  label: ReactNode;
  detail?: ReactNode;
};

export function StatusIndicator(rawProps: StatusIndicatorProps) {
  const safeProps = sanitizeFixedControlProps(rawProps, ["children"]);
  const { tone = "neutral", label, detail, ...rootProps } = safeProps;
  return (
    <span
      {...rootProps}
      data-pui-owner="StatusIndicator"
      className={cx("pui-status-indicator", `pui-status-indicator--${tone}`)}
    >
      <span className="pui-status-indicator__dot" aria-hidden="true" />
      <span className="pui-status-indicator__label">{label}</span>
      {detail != null ? <span className="pui-status-indicator__detail">{detail}</span> : null}
    </span>
  );
}

export interface StatisticTrend {
  direction: "up" | "down" | "flat";
  value: ReactNode;
  label?: string;
  tone?: "positive" | "negative" | "neutral";
}

export type StatisticProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | "prefix"
>> & {
  label: ReactNode;
  value: ReactNode;
  prefix?: ReactNode;
  suffix?: ReactNode;
  trend?: StatisticTrend;
  description?: ReactNode;
};

export function Statistic(rawProps: StatisticProps) {
  const safeProps = sanitizeFixedControlProps(rawProps, ["children"]);
  const { label, value, prefix, suffix, trend, description, ...rootProps } = safeProps;
  const TrendIcon = trend?.direction === "up" ? ArrowUp : trend?.direction === "down" ? ArrowDown : Minus;
  return (
    <div {...rootProps} data-pui-owner="Statistic" className="pui-statistic">
      <span className="pui-statistic__label">{label}</span>
      <div className="pui-statistic__value-row">
        <strong className="pui-statistic__value">
          {prefix != null ? <span>{prefix}</span> : null}
          <span>{value}</span>
          {suffix != null ? <span className="pui-statistic__suffix">{suffix}</span> : null}
        </strong>
        {trend ? (
          <span
            className={cx("pui-statistic__trend", `pui-statistic__trend--${trend.tone ?? "neutral"}`)}
            aria-label={trend.label}
          >
            <TrendIcon aria-hidden="true" />
            <span>{trend.value}</span>
          </span>
        ) : null}
      </div>
      {description != null ? <span className="pui-statistic__description">{description}</span> : null}
    </div>
  );
}

export type CodeBlockProps = PublicControlProps<Omit<HTMLAttributes<HTMLDivElement>, "children">> & {
  code: string;
  language?: string;
  copyable?: boolean;
  copyLabel?: string;
  wrap?: boolean;
  maxHeight?: string | number;
};

export function CodeBlock(rawProps: CodeBlockProps) {
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps, ["children"]);
  const {
    code,
    language,
    copyable = true,
    copyLabel = message("code.copy"),
    wrap = false,
    maxHeight,
    ...rootProps
  } = safeProps;
  return (
    <div
      {...rootProps}
      data-pui-owner="CodeBlock"
      className={cx("pui-code-block", wrap && "pui-code-block--wrap")}
    >
      {language || copyable ? (
        <div className="pui-code-block__toolbar">
          <span>{language}</span>
          {copyable ? <ClipboardButton text={code} label={copyLabel} iconOnly /> : null}
        </div>
      ) : null}
      <pre role="region" style={{ maxHeight }} tabIndex={0} aria-label={language ? message("code.labelWithLanguage", { language }) : message("code.label")}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

type MediaImageProps = PublicControlProps<Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "alt" | "children" | "src"
>>;

type MediaVideoProps = PublicControlProps<Omit<
  VideoHTMLAttributes<HTMLVideoElement>,
  "children" | "controls" | "poster" | "src"
>>;

export type MediaProps = PublicControlProps<Omit<HTMLAttributes<HTMLElement>, "children">> & {
  kind?: "image" | "video";
  src: string;
  alt: string;
  caption?: ReactNode;
  aspectRatio?: number | string;
  objectFit?: "contain" | "cover";
  poster?: string;
  controls?: boolean;
  imageProps?: MediaImageProps;
  videoProps?: MediaVideoProps;
};

export function Media(rawProps: MediaProps) {
  const safeProps = sanitizeFixedControlProps(rawProps, ["children"]);
  const {
    kind = "image",
    src,
    alt,
    caption,
    aspectRatio = "16 / 9",
    objectFit = "cover",
    poster,
    controls = true,
    imageProps,
    videoProps,
    ...rootProps
  } = safeProps;
  const safeImageProps = sanitizeFixedControlProps(imageProps ?? {}, ["alt", "children", "src"]);
  const safeVideoProps = sanitizeFixedControlProps(videoProps ?? {}, ["children", "controls", "poster", "src"]);
  return (
    <figure {...rootProps} data-pui-owner="Media" className="pui-media" data-fit={objectFit}>
      <AspectRatio ratio={aspectRatio} className="pui-media__frame">
        {kind === "video" ? (
          <video {...safeVideoProps} src={src} poster={poster} controls={controls} aria-label={alt} preload={safeVideoProps.preload ?? "metadata"} />
        ) : (
          <img {...safeImageProps} src={src} alt={alt} loading={safeImageProps.loading ?? "lazy"} />
        )}
      </AspectRatio>
      {caption != null ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

export type AttachmentProps = PublicControlProps<Omit<HTMLAttributes<HTMLDivElement>, "children">> & {
  name: string;
  description?: ReactNode;
  size?: ReactNode;
  icon?: ReactNode;
  href?: string;
  download?: boolean | string;
  onDownload?: () => void;
  downloading?: boolean;
  onRemove?: () => void;
  disabled?: boolean;
  downloadLabel?: string;
  removeLabel?: string;
};

export function Attachment(rawProps: AttachmentProps) {
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps, ["children"]);
  const {
    name,
    description,
    size,
    icon = <FileText aria-hidden="true" />,
    href,
    download,
    onDownload,
    downloading = false,
    onRemove,
    disabled = false,
    downloadLabel = message("attachment.download", { name }),
    removeLabel = message("attachment.remove", { name }),
    ...rootProps
  } = safeProps;
  return (
    <div {...rootProps} data-pui-owner="Attachment" className="pui-attachment">
      <span className="pui-attachment__icon" aria-hidden="true">{icon}</span>
      <div className="pui-attachment__copy">
        <OverflowText>{name}</OverflowText>
        {description != null || size != null ? (
          <span>{description}{description != null && size != null ? " · " : null}{size}</span>
        ) : null}
      </div>
      <div className="pui-attachment__actions">
        {onDownload ? (
          <Tooltip content={downloadLabel}>
            <IconButton
              aria-label={downloadLabel}
              icon={<Download aria-hidden="true" />}
              loading={downloading}
              disabled={disabled}
              onClick={onDownload}
            />
          </Tooltip>
        ) : href ? (
          <Tooltip content={downloadLabel}>
            <a
              className="pui-icon-button pui-attachment__link"
              href={href}
              download={download}
              aria-label={downloadLabel}
              aria-disabled={disabled || undefined}
              onClick={(event) => { if (disabled) event.preventDefault(); }}
            >
              <Download aria-hidden="true" />
            </a>
          </Tooltip>
        ) : null}
        {onRemove ? (
          <Tooltip content={removeLabel}>
            <IconButton
              aria-label={removeLabel}
              icon={<Trash2 aria-hidden="true" />}
              variant="danger"
              disabled={disabled || downloading}
              onClick={onRemove}
            />
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}

export interface GalleryItem {
  id: string;
  src: string;
  alt: string;
  caption?: ReactNode;
}

export type GalleryProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLElement>,
  "aria-label" | "children" | "onSelect"
>> & {
  items: readonly GalleryItem[];
  columns?: 2 | 3 | 4;
  aspectRatio?: number | string;
  selectedId?: string;
  onSelect?: (item: GalleryItem) => void;
  ariaLabel: string;
  empty?: ReactNode;
};

export function Gallery(rawProps: GalleryProps) {
  const safeProps = sanitizeFixedControlProps(rawProps, ["aria-label", "children"]);
  const {
    items,
    columns = 3,
    aspectRatio = 1,
    selectedId,
    onSelect,
    ariaLabel,
    empty,
    ...rootProps
  } = safeProps;
  assertUniqueIdentities("Gallery", "item.id", items.map((item) => item.id));
  if (selectedId !== undefined && !items.some((item) => item.id === selectedId)) {
    throw new RangeError(`Gallery received selectedId ${JSON.stringify(selectedId)}, but no item has that id.`);
  }
  if (!items.length) {
    return empty != null ? (
      <div {...rootProps} className="pui-gallery-empty" role="status" data-pui-owner="Gallery">{empty}</div>
    ) : null;
  }
  const resolvedStyle = { "--pui-gallery-columns": columns } as CSSVariableProperties;
  return (
    <ul
      {...rootProps}
      data-pui-owner="Gallery"
      className="pui-gallery"
      aria-label={ariaLabel}
      style={resolvedStyle}
    >
      {items.map((item) => {
        const content = (
          <>
            <AspectRatio ratio={aspectRatio} className="pui-gallery__frame">
              <img src={item.src} alt={item.alt} loading="lazy" />
            </AspectRatio>
            {item.caption != null ? <span className="pui-gallery__caption">{item.caption}</span> : null}
          </>
        );
        return (
          <li key={item.id} className="pui-gallery__item" data-selected={item.id === selectedId || undefined}>
            {onSelect ? (
              <button type="button" aria-pressed={item.id === selectedId} onClick={() => onSelect(item)}>{content}</button>
            ) : <figure>{content}</figure>}
          </li>
        );
      })}
    </ul>
  );
}

export type MeterTone = "auto" | "neutral" | "success" | "warning" | "danger";

export type MeterProps = PublicControlProps<Omit<
  MeterHTMLAttributes<HTMLMeterElement>,
  "children" | "className" | "aria-label" | "value" | "min" | "max" | "low" | "high" | "optimum"
>> & {
  label: ReactNode;
  ariaLabel: string;
  value: number;
  min?: number;
  max?: number;
  low?: number;
  high?: number;
  optimum?: number;
  showValue?: boolean;
  formatValue?: (value: number, min: number, max: number) => ReactNode;
  tone?: MeterTone;
};

function automaticMeterTone(
  value: number,
  min: number,
  max: number,
  low?: number,
  high?: number,
  optimum?: number,
): Exclude<MeterTone, "auto"> {
  const resolvedLow = low ?? min;
  const resolvedHigh = high ?? max;
  if (low === undefined && high === undefined) return "neutral";
  if (optimum !== undefined && optimum > resolvedHigh) {
    if (value >= resolvedHigh) return "success";
    return value >= resolvedLow ? "warning" : "danger";
  }
  if (optimum !== undefined && optimum >= resolvedLow && optimum <= resolvedHigh) {
    return value >= resolvedLow && value <= resolvedHigh ? "success" : "warning";
  }
  if (value <= resolvedLow) return "success";
  return value <= resolvedHigh ? "warning" : "danger";
}

export function Meter(rawProps: MeterProps) {
  const safeProps = sanitizeFixedControlProps(rawProps, ["aria-label", "children"]);
  const {
    label,
    ariaLabel,
    value,
    min = 0,
    max = 100,
    low,
    high,
    optimum,
    showValue = true,
    formatValue,
    tone = "auto",
    ...meterProps
  } = safeProps;
  const numbers = [value, min, max, low, high, optimum].filter((entry): entry is number => entry !== undefined);
  if (numbers.some((entry) => !Number.isFinite(entry))) throw new RangeError("Meter values must be finite numbers.");
  if (max <= min) throw new RangeError("Meter max must be greater than min.");
  if (low !== undefined && (low < min || low > max)) throw new RangeError("Meter low must be within its range.");
  if (high !== undefined && (high < min || high > max)) throw new RangeError("Meter high must be within its range.");
  if (low !== undefined && high !== undefined && low > high) throw new RangeError("Meter low cannot exceed high.");
  if (optimum !== undefined && (optimum < min || optimum > max)) throw new RangeError("Meter optimum must be within its range.");
  const normalizedValue = Math.min(max, Math.max(min, value));
  const resolvedTone = tone === "auto"
    ? automaticMeterTone(normalizedValue, min, max, low, high, optimum)
    : tone;
  const renderedValue = formatValue
    ? formatValue(normalizedValue, min, max)
    : `${Math.round(((normalizedValue - min) / (max - min)) * 100)}%`;
  return (
    <div className="pui-meter-group" data-tone={resolvedTone} data-pui-owner="Meter">
      <div className="pui-meter-group__label">
        <span>{label}</span>
        {showValue ? <strong>{renderedValue}</strong> : null}
      </div>
      <meter
        {...meterProps}
        className="pui-meter"
        aria-label={ariaLabel}
        value={normalizedValue}
        min={min}
        max={max}
        low={low}
        high={high}
        optimum={optimum}
      >
        {renderedValue}
      </meter>
    </div>
  );
}

export interface TimelineItem {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  time?: ReactNode;
  dateTime?: string;
  icon?: ReactNode;
  tone?: BadgeTone;
}

export type TimelineProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLOListElement>,
  "aria-label" | "children"
>> & {
  items: readonly TimelineItem[];
  ariaLabel?: string;
};

export function Timeline(rawProps: TimelineProps) {
  const safeProps = sanitizeFixedControlProps(rawProps, ["aria-label", "children"]);
  const { items, ariaLabel, ...rootProps } = safeProps;
  assertUniqueIdentities("Timeline", "item.id", items.map((item) => item.id));
  return (
    <ol {...rootProps} data-pui-owner="Timeline" className="pui-timeline" aria-label={ariaLabel}>
      {items.map((item) => (
        <li key={item.id} className="pui-timeline__item">
          <span className={cx("pui-timeline__marker", `pui-timeline__marker--${item.tone ?? "neutral"}`)} aria-hidden="true">
            {item.icon}
          </span>
          <div className="pui-timeline__copy">
            <strong>{item.title}</strong>
            {item.description != null ? <span>{item.description}</span> : null}
            {item.time != null ? <time dateTime={item.dateTime}>{item.time}</time> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export interface AccordionItem {
  id: string;
  title: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

type AccordionBaseProps = PublicControlProps<Omit<
  HTMLAttributes<HTMLDivElement>,
  "aria-label" | "children" | "defaultValue" | "onChange"
>> & {
  items: readonly AccordionItem[];
  type?: "single" | "multiple";
  collapsible?: boolean;
  ariaLabel?: string;
};

type AccordionValueProps =
  | {
      value: readonly string[];
      defaultValue?: never;
      onValueChange: (value: string[]) => void;
    }
  | {
      value?: never;
      defaultValue?: readonly string[];
      onValueChange?: (value: string[]) => void;
    };

export type AccordionProps = AccordionBaseProps & AccordionValueProps;

export function Accordion(rawProps: AccordionProps) {
  const controlled = rawProps.value !== undefined;
  const defaultValueProvided = rawProps.defaultValue !== undefined;
  const safeProps = sanitizeFixedControlProps(rawProps, ["aria-label", "children", "internalClassName", "onChange"]);
  const {
    items,
    type = "multiple",
    value,
    defaultValue,
    onValueChange,
    collapsible = true,
    ariaLabel,
    ...rootProps
  } = safeProps;
  assertUniqueIdentities("Accordion", "item.id", items.map((item) => item.id));
  const knownIds = new Set(items.map((item) => item.id));
  const seenIdsRef = useRef<Set<string>>(new Set());
  const assertKnownValues = (values: readonly string[], label: string) => {
    assertUniqueIdentities("Accordion", label, values);
    const unknown = values.find((entry) => !knownIds.has(entry) && !seenIdsRef.current.has(entry));
    if (unknown !== undefined) {
      throw new RangeError(`Accordion received unknown ${label} ${JSON.stringify(unknown)}.`);
    }
    if (type === "single" && values.length > 1) {
      throw new RangeError(`Accordion type="single" accepts at most one ${label}.`);
    }
  };
  const [resolvedValue, setResolvedValue] = useControllableState<string[]>({
    componentName: "Accordion",
    controlled,
    value: value === undefined ? undefined : Array.from(value),
    defaultValue: Array.from(defaultValue ?? []),
    defaultValueProvided,
    onChange: onValueChange,
  });
  assertKnownValues(resolvedValue, controlled ? "value" : "defaultValue");
  knownIds.forEach((id) => seenIdsRef.current.add(id));
  const openIds = resolvedValue.filter((id) => knownIds.has(id));
  useEffect(() => {
    if (!controlled && openIds.length !== resolvedValue.length) setResolvedValue(openIds);
  }, [controlled, openIds, resolvedValue, setResolvedValue]);
  const update = (next: string[]) => {
    setResolvedValue(next);
  };
  const toggle = (id: string, open: boolean) => {
    if (type === "single") {
      if (open) update([id]);
      else if (collapsible) update([]);
      return;
    }
    const next = open ? [...openIds, id] : openIds.filter((entry) => entry !== id);
    update(Array.from(new Set(next)));
  };
  return (
    <div {...rootProps} data-pui-owner="Accordion" className="pui-accordion" aria-label={ariaLabel}>
      {items.map((item) => {
        const open = openIds.includes(item.id);
        return (
          <InternalCollapse
            key={item.id}
            title={item.title}
            open={open}
            disabled={item.disabled || (!collapsible && type === "single" && open)}
            onOpenChange={(nextOpen) => toggle(item.id, nextOpen)}
            internalClassName="pui-accordion__item"
          >
            {item.content}
          </InternalCollapse>
        );
      })}
    </div>
  );
}
