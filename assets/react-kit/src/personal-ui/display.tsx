import {
  Children,
  useEffect,
  useId,
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
import { ClipboardButton } from "./actions";
import { AspectRatio, Collapse } from "./layout";
import { IconButton } from "./primitives";
import { OverflowText, Tooltip } from "./overlays";
import { assertUniqueIdentities, cx, type CSSVariableProperties } from "./utils";

export interface ListProps<T> extends Omit<HTMLAttributes<HTMLUListElement>, "children"> {
  items: readonly T[];
  itemKey: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  ariaLabel?: string;
  ordered?: boolean;
  divided?: boolean;
  density?: "compact" | "comfortable";
  empty?: ReactNode;
}

export function List<T>({
  items,
  itemKey,
  renderItem,
  ariaLabel,
  ordered = false,
  divided = true,
  density = "comfortable",
  empty,
  className,
  ...props
}: ListProps<T>) {
  const keys = items.map(itemKey);
  assertUniqueIdentities("List", "itemKey result", keys);
  if (!items.length) {
    return empty != null ? (
      <div className={cx("pui-list-empty", className)} role="status" data-pui-owner="List">{empty}</div>
    ) : null;
  }
  const Component = ordered ? "ol" : "ul";
  return (
    <Component
      {...props}
      data-pui-owner="List"
      className={cx("pui-list", divided && "pui-list--divided", className)}
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

export interface DescriptionListProps extends Omit<HTMLAttributes<HTMLDListElement>, "children"> {
  items: readonly DescriptionListItem[];
  columns?: 1 | 2 | 3;
  divided?: boolean;
}

export function DescriptionList({
  items,
  columns = 1,
  divided = true,
  className,
  ...props
}: DescriptionListProps) {
  assertUniqueIdentities("DescriptionList", "item.id", items.map((item) => item.id));
  return (
    <dl
      {...props}
      data-pui-owner="DescriptionList"
      className={cx("pui-description-list", divided && "pui-description-list--divided", className)}
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

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  heading?: ReactNode;
  description?: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  variant?: "outlined" | "subtle" | "raised";
  padding?: "small" | "medium" | "large";
}

export function Card({
  heading,
  description,
  header,
  footer,
  variant = "outlined",
  padding = "medium",
  className,
  children,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: CardProps) {
  const headingId = useId();
  return (
    <article
      {...props}
      data-pui-owner="Card"
      className={cx("pui-card", `pui-card--${variant}`, className)}
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

export interface AvatarProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  name: string;
  src?: string;
  alt?: string;
  fallback?: ReactNode;
  size?: AvatarSize;
  decorative?: boolean;
  imageProps?: Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt">;
}

function avatarInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const value = words.length > 1
    ? `${Array.from(words[0])[0] ?? ""}${Array.from(words[words.length - 1])[0] ?? ""}`
    : Array.from(words[0] ?? "").slice(0, 2).join("");
  return value.toLocaleUpperCase() || "?";
}

export function Avatar({
  name,
  src,
  alt,
  fallback,
  size = "medium",
  decorative = false,
  imageProps,
  className,
  ...props
}: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [src]);
  const { onError, ...resolvedImageProps } = imageProps ?? {};
  return (
    <span
      {...props}
      data-pui-owner="Avatar"
      className={cx("pui-avatar", className)}
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

export interface AvatarGroupProps extends HTMLAttributes<HTMLSpanElement> {
  max?: number;
  ariaLabel: string;
}

export function AvatarGroup({ max = 4, ariaLabel, className, children, ...props }: AvatarGroupProps) {
  if (!Number.isFinite(max) || max < 1) throw new RangeError("AvatarGroup max must be at least one.");
  const entries = Children.toArray(children);
  const visibleCount = Math.max(1, Math.trunc(max));
  const visible = entries.slice(0, visibleCount);
  const overflow = Math.max(0, entries.length - visible.length);
  return (
    <span
      {...props}
      data-pui-owner="AvatarGroup"
      className={cx("pui-avatar-group", className)}
      role="group"
      aria-label={ariaLabel}
    >
      {visible}
      {overflow ? (
        <span className="pui-avatar pui-avatar-group__overflow" data-size="medium" aria-label={`${overflow} 个其他项目`}>
          +{overflow}
        </span>
      ) : null}
    </span>
  );
}

export type BadgeTone = "neutral" | "blue" | "success" | "warning" | "danger";

export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, "content"> {
  content?: ReactNode;
  count?: number;
  max?: number;
  dot?: boolean;
  showZero?: boolean;
  tone?: BadgeTone;
  label?: string;
}

export function Badge({
  content,
  count,
  max = 99,
  dot = false,
  showZero = false,
  tone = "danger",
  label,
  className,
  children,
  ...props
}: BadgeProps) {
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
    normalizedCount !== undefined ? `${normalizedCount} 条通知` : dot ? "有新通知" : undefined
  );
  const indicator = showIndicator ? (
    <span
      className={cx("pui-badge__indicator", dot && "pui-badge__indicator--dot", `pui-badge__indicator--${tone}`)}
      aria-label={accessibleLabel}
    >
      {indicatorContent}
    </span>
  ) : null;
  if (children == null) {
    return indicator ? (
      <span {...props} data-pui-owner="Badge" className={cx("pui-badge", className)}>{indicator}</span>
    ) : null;
  }
  return (
    <span {...props} data-pui-owner="Badge" className={cx("pui-badge", "pui-badge--anchored", className)}>
      <span className="pui-badge__anchor">{children}</span>
      {indicator}
    </span>
  );
}

export interface StatusIndicatorProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  label: ReactNode;
  detail?: ReactNode;
}

export function StatusIndicator({
  tone = "neutral",
  label,
  detail,
  className,
  ...props
}: StatusIndicatorProps) {
  return (
    <span
      {...props}
      data-pui-owner="StatusIndicator"
      className={cx("pui-status-indicator", `pui-status-indicator--${tone}`, className)}
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

export interface StatisticProps extends Omit<HTMLAttributes<HTMLDivElement>, "prefix"> {
  label: ReactNode;
  value: ReactNode;
  prefix?: ReactNode;
  suffix?: ReactNode;
  trend?: StatisticTrend;
  description?: ReactNode;
}

export function Statistic({
  label,
  value,
  prefix,
  suffix,
  trend,
  description,
  className,
  ...props
}: StatisticProps) {
  const TrendIcon = trend?.direction === "up" ? ArrowUp : trend?.direction === "down" ? ArrowDown : Minus;
  return (
    <div {...props} data-pui-owner="Statistic" className={cx("pui-statistic", className)}>
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

export interface CodeBlockProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  code: string;
  language?: string;
  copyable?: boolean;
  copyLabel?: string;
  wrap?: boolean;
  maxHeight?: string | number;
}

export function CodeBlock({
  code,
  language,
  copyable = true,
  copyLabel = "复制代码",
  wrap = false,
  maxHeight,
  className,
  ...props
}: CodeBlockProps) {
  return (
    <div
      {...props}
      data-pui-owner="CodeBlock"
      className={cx("pui-code-block", wrap && "pui-code-block--wrap", className)}
    >
      {language || copyable ? (
        <div className="pui-code-block__toolbar">
          <span>{language}</span>
          {copyable ? <ClipboardButton text={code} label={copyLabel} iconOnly /> : null}
        </div>
      ) : null}
      <pre style={{ maxHeight }} tabIndex={0} aria-label={language ? `${language} 代码` : "代码"}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export interface MediaProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  kind?: "image" | "video";
  src: string;
  alt: string;
  caption?: ReactNode;
  aspectRatio?: number | string;
  objectFit?: "contain" | "cover";
  poster?: string;
  controls?: boolean;
  imageProps?: Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt">;
  videoProps?: Omit<VideoHTMLAttributes<HTMLVideoElement>, "src" | "poster" | "controls">;
}

export function Media({
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
  className,
  ...props
}: MediaProps) {
  return (
    <figure {...props} data-pui-owner="Media" className={cx("pui-media", className)} data-fit={objectFit}>
      <AspectRatio ratio={aspectRatio} className="pui-media__frame">
        {kind === "video" ? (
          <video {...videoProps} src={src} poster={poster} controls={controls} aria-label={alt} preload={videoProps?.preload ?? "metadata"} />
        ) : (
          <img {...imageProps} src={src} alt={alt} loading={imageProps?.loading ?? "lazy"} />
        )}
      </AspectRatio>
      {caption != null ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

export interface AttachmentProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
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
}

export function Attachment({
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
  downloadLabel = `下载 ${name}`,
  removeLabel = `移除 ${name}`,
  className,
  ...props
}: AttachmentProps) {
  return (
    <div {...props} data-pui-owner="Attachment" className={cx("pui-attachment", className)}>
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

export interface GalleryProps extends Omit<HTMLAttributes<HTMLUListElement>, "children" | "onSelect"> {
  items: readonly GalleryItem[];
  columns?: 2 | 3 | 4;
  aspectRatio?: number | string;
  selectedId?: string;
  onSelect?: (item: GalleryItem) => void;
  ariaLabel: string;
  empty?: ReactNode;
}

export function Gallery({
  items,
  columns = 3,
  aspectRatio = 1,
  selectedId,
  onSelect,
  ariaLabel,
  empty,
  className,
  style,
  ...props
}: GalleryProps) {
  assertUniqueIdentities("Gallery", "item.id", items.map((item) => item.id));
  if (selectedId !== undefined && !items.some((item) => item.id === selectedId)) {
    throw new RangeError(`Gallery received selectedId ${JSON.stringify(selectedId)}, but no item has that id.`);
  }
  if (!items.length) {
    return empty != null ? (
      <div className="pui-gallery-empty" role="status" data-pui-owner="Gallery">{empty}</div>
    ) : null;
  }
  const resolvedStyle = { "--pui-gallery-columns": columns, ...style } as CSSVariableProperties;
  return (
    <ul
      {...props}
      data-pui-owner="Gallery"
      className={cx("pui-gallery", className)}
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

export interface MeterProps extends Omit<
  MeterHTMLAttributes<HTMLMeterElement>,
  "children" | "className" | "aria-label" | "value" | "min" | "max" | "low" | "high" | "optimum"
> {
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
  className?: string;
}

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

export function Meter({
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
  className,
  ...props
}: MeterProps) {
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
    <div className={cx("pui-meter-group", className)} data-tone={resolvedTone} data-pui-owner="Meter">
      <div className="pui-meter-group__label">
        <span>{label}</span>
        {showValue ? <strong>{renderedValue}</strong> : null}
      </div>
      <meter
        {...props}
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

export interface TimelineProps extends Omit<HTMLAttributes<HTMLOListElement>, "children"> {
  items: readonly TimelineItem[];
  ariaLabel?: string;
}

export function Timeline({ items, ariaLabel, className, ...props }: TimelineProps) {
  assertUniqueIdentities("Timeline", "item.id", items.map((item) => item.id));
  return (
    <ol {...props} data-pui-owner="Timeline" className={cx("pui-timeline", className)} aria-label={ariaLabel}>
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

export interface AccordionProps extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "onChange"> {
  items: readonly AccordionItem[];
  type?: "single" | "multiple";
  value?: readonly string[];
  defaultValue?: readonly string[];
  onValueChange?: (value: string[]) => void;
  collapsible?: boolean;
  ariaLabel?: string;
}

export function Accordion({
  items,
  type = "multiple",
  value,
  defaultValue = [],
  onValueChange,
  collapsible = true,
  ariaLabel,
  className,
  ...props
}: AccordionProps) {
  assertUniqueIdentities("Accordion", "item.id", items.map((item) => item.id));
  const knownIds = new Set(items.map((item) => item.id));
  const assertKnownValues = (values: readonly string[], label: string) => {
    assertUniqueIdentities("Accordion", label, values);
    const unknown = values.find((entry) => !knownIds.has(entry));
    if (unknown !== undefined) {
      throw new RangeError(`Accordion received unknown ${label} ${JSON.stringify(unknown)}.`);
    }
    if (type === "single" && values.length > 1) {
      throw new RangeError(`Accordion type="single" accepts at most one ${label}.`);
    }
  };
  assertKnownValues(value ?? defaultValue, value === undefined ? "defaultValue" : "value");
  const [internalValue, setInternalValue] = useState<string[]>(() => Array.from(defaultValue));
  const controlled = value !== undefined;
  const openIds = controlled ? Array.from(value) : internalValue.filter((id) => knownIds.has(id));
  const update = (next: string[]) => {
    if (!controlled) setInternalValue(next);
    onValueChange?.(next);
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
    <div {...props} data-pui-owner="Accordion" className={cx("pui-accordion", className)} aria-label={ariaLabel}>
      {items.map((item) => {
        const open = openIds.includes(item.id);
        return (
          <Collapse
            key={item.id}
            title={item.title}
            open={open}
            disabled={item.disabled || (!collapsible && type === "single" && open)}
            onOpenChange={(nextOpen) => toggle(item.id, nextOpen)}
            className="pui-accordion__item"
          >
            {item.content}
          </Collapse>
        );
      })}
    </div>
  );
}
