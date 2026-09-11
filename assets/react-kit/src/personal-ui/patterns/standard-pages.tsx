import type { FormEvent, ReactNode } from "react";
import { ArrowLeft, Download, Upload } from "lucide-react";
import { Button, IconButton } from "../primitives";
import { EmptyState } from "../feedback";
import { ErrorState } from "../feedback-extra";
import { Stepper, type StepperItem } from "../navigation-extra";
import { assertUniqueIdentities, cx } from "../utils";

export interface PageHeadingProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
}

export function PageHeading({ title, description, eyebrow, actions, onBack, backLabel = "返回" }: PageHeadingProps) {
  return (
    <header className="pui-page-heading" data-pui-owner="PageHeading">
      {onBack ? <IconButton aria-label={backLabel} icon={<ArrowLeft />} onClick={onBack} /> : null}
      <div className="pui-page-heading__copy">
        {eyebrow != null ? <span>{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description != null ? <p>{description}</p> : null}
      </div>
      {actions != null ? <div className="pui-page-heading__actions">{actions}</div> : null}
    </header>
  );
}

export interface ListManagementPageProps extends PageHeadingProps {
  filters?: ReactNode;
  bulkActions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

type ListManagementPageRootProps = ListManagementPageProps & {
  owner: "ListManagementPage" | "SearchFilterPage";
  variantClassName?: string;
};

function ListManagementPageRoot({ filters, bulkActions, children, footer, className, owner, variantClassName, ...heading }: ListManagementPageRootProps) {
  return (
    <main className={cx("pui-page", "pui-list-page", variantClassName, className)} data-pui-owner={owner}>
      <PageHeading {...heading} />
      {filters != null ? <section className="pui-list-page__filters" aria-label="筛选条件">{filters}</section> : null}
      {bulkActions != null ? <section className="pui-list-page__bulk" aria-label="批量操作">{bulkActions}</section> : null}
      <section className="pui-list-page__content">{children}</section>
      {footer != null ? <footer className="pui-list-page__footer">{footer}</footer> : null}
    </main>
  );
}

export function ListManagementPage(props: ListManagementPageProps) {
  return <ListManagementPageRoot {...props} owner="ListManagementPage" />;
}

export type SearchFilterPageProps = ListManagementPageProps;

export function SearchFilterPage(props: SearchFilterPageProps) {
  return <ListManagementPageRoot {...props} owner="SearchFilterPage" variantClassName="pui-search-filter-page" />;
}

export interface CreateEditPageProps extends PageHeadingProps {
  children: ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel?: ReactNode;
  cancelLabel?: ReactNode;
  onCancel?: () => void;
  submitting?: boolean;
  submitDisabled?: boolean;
  formId?: string;
  className?: string;
}

export function CreateEditPage({ children, onSubmit, submitLabel = "保存", cancelLabel = "取消", onCancel, submitting, submitDisabled, formId, className, ...heading }: CreateEditPageProps) {
  return (
    <main className={cx("pui-page", "pui-form-page", className)} data-pui-owner="CreateEditPage">
      <PageHeading {...heading} />
      <form id={formId} className="pui-form-page__form" onSubmit={onSubmit} noValidate>
        <div className="pui-form-page__content">{children}</div>
        <footer className="pui-form-page__actions">
          {onCancel ? <Button disabled={submitting} onClick={onCancel}>{cancelLabel}</Button> : null}
          <Button type="submit" variant="primary" loading={submitting} loadingLabel="保存中" disabled={submitDisabled}>{submitLabel}</Button>
        </footer>
      </form>
    </main>
  );
}

export interface DetailSection {
  id: string;
  title?: ReactNode;
  content: ReactNode;
  actions?: ReactNode;
}

export interface DetailPageProps extends PageHeadingProps {
  sections: readonly DetailSection[];
  aside?: ReactNode;
  className?: string;
}

export function DetailPage({ sections, aside, className, ...heading }: DetailPageProps) {
  assertUniqueIdentities("DetailPage", "section.id", sections.map((section) => section.id));
  return (
    <main className={cx("pui-page", "pui-detail-page", className)} data-pui-owner="DetailPage">
      <PageHeading {...heading} />
      <div className="pui-detail-page__layout">
        <div className="pui-detail-page__sections">
          {sections.map((section) => (
            <section key={section.id} id={section.id}>
              {section.title != null || section.actions != null ? <header>{section.title != null ? <h2>{section.title}</h2> : <span />}{section.actions}</header> : null}
              <div>{section.content}</div>
            </section>
          ))}
        </div>
        {aside != null ? <aside>{aside}</aside> : null}
      </div>
    </main>
  );
}

export interface SettingsSection extends DetailSection {
  label: ReactNode;
  disabled?: boolean;
}

export interface SettingsPageProps extends PageHeadingProps {
  sections: readonly SettingsSection[];
  currentId: string;
  onCurrentChange: (id: string) => void;
  className?: string;
}

export function SettingsPage({ sections, currentId, onCurrentChange, className, ...heading }: SettingsPageProps) {
  assertUniqueIdentities("SettingsPage", "section.id", sections.map((section) => section.id));
  const current = sections.find((section) => section.id === currentId);
  if (!current && sections.length) throw new RangeError(`SettingsPage cannot find currentId ${JSON.stringify(currentId)}.`);
  return (
    <main className={cx("pui-page", "pui-settings-page", className)} data-pui-owner="SettingsPage">
      <PageHeading {...heading} />
      <div className="pui-settings-page__layout">
        <nav aria-label="设置分类">
          {sections.map((section) => <button key={section.id} type="button" disabled={section.disabled} aria-current={section.id === currentId ? "page" : undefined} onClick={() => onCurrentChange(section.id)}>{section.label}</button>)}
        </nav>
        {current ? <section aria-labelledby={`pui-settings-${current.id}`}><header><h2 id={`pui-settings-${current.id}`}>{current.title ?? current.label}</h2>{current.actions}</header><div>{current.content}</div></section> : null}
      </div>
    </main>
  );
}

export interface WizardFlowProps extends PageHeadingProps {
  steps: readonly StepperItem[];
  currentId: string;
  children: ReactNode;
  onStepChange?: (id: string) => void;
  onPrevious?: () => void;
  onNext?: () => void | Promise<void>;
  previousLabel?: ReactNode;
  nextLabel?: ReactNode;
  nextLoading?: boolean;
  nextDisabled?: boolean;
  className?: string;
}

export function WizardFlow({ steps, currentId, children, onStepChange, onPrevious, onNext, previousLabel = "上一步", nextLabel = "下一步", nextLoading, nextDisabled, className, ...heading }: WizardFlowProps) {
  return (
    <main className={cx("pui-page", "pui-wizard-page", className)} data-pui-owner="WizardFlow">
      <PageHeading {...heading} />
      <Stepper steps={steps} currentId={currentId} ariaLabel="流程步骤" onStepChange={onStepChange} />
      <section className="pui-wizard-page__content">{children}</section>
      <footer className="pui-wizard-page__actions">
        <Button disabled={!onPrevious || nextLoading} onClick={onPrevious}>{previousLabel}</Button>
        <Button variant="primary" loading={nextLoading} loadingLabel="处理中" disabled={!onNext || nextDisabled} onClick={onNext}>{nextLabel}</Button>
      </footer>
    </main>
  );
}

export interface MasterDetailProps extends PageHeadingProps {
  master: ReactNode;
  detail: ReactNode;
  detailOpen?: boolean;
  emptyDetail?: ReactNode;
  className?: string;
}

export function MasterDetail({ master, detail, detailOpen = true, emptyDetail, className, ...heading }: MasterDetailProps) {
  return (
    <main className={cx("pui-page", "pui-master-detail", className)} data-pui-owner="MasterDetail">
      <PageHeading {...heading} />
      <div className="pui-master-detail__layout" data-detail-open={detailOpen || undefined}>
        <section className="pui-master-detail__master" aria-label="项目列表">{master}</section>
        <section className="pui-master-detail__detail" aria-label="项目详情">{detailOpen ? detail : emptyDetail}</section>
      </div>
    </main>
  );
}

export interface ImportExportPageProps extends PageHeadingProps {
  importContent: ReactNode;
  exportContent: ReactNode;
  onImport?: () => void | Promise<void>;
  onExport?: () => void | Promise<void>;
  importing?: boolean;
  exporting?: boolean;
  className?: string;
}

export function ImportExportPage({ importContent, exportContent, onImport, onExport, importing, exporting, className, ...heading }: ImportExportPageProps) {
  return (
    <main className={cx("pui-page", "pui-import-export-page", className)} data-pui-owner="ImportExportPage">
      <PageHeading {...heading} />
      <div className="pui-import-export-page__grid">
        <section><header><Upload aria-hidden="true" /><h2>导入</h2></header><div>{importContent}</div>{onImport ? <Button variant="primary" icon={<Upload />} loading={importing} loadingLabel="导入中" onClick={onImport}>开始导入</Button> : null}</section>
        <section><header><Download aria-hidden="true" /><h2>导出</h2></header><div>{exportContent}</div>{onExport ? <Button icon={<Download />} loading={exporting} loadingLabel="导出中" onClick={onExport}>导出文件</Button> : null}</section>
      </div>
    </main>
  );
}

export interface StatusPageProps extends PageHeadingProps {
  kind?: "empty" | "error" | "permission" | "offline";
  statusTitle: ReactNode;
  statusDescription?: ReactNode;
  action?: ReactNode;
  onRetry?: () => void | Promise<void>;
  className?: string;
}

export function StatusPage({ kind = "empty", statusTitle, statusDescription, action, onRetry, className, ...heading }: StatusPageProps) {
  return (
    <main className={cx("pui-page", "pui-status-page", className)} data-pui-owner="StatusPage">
      <PageHeading {...heading} />
      {kind === "empty" ? <EmptyState title={statusTitle} description={statusDescription} action={action} /> : <ErrorState kind={kind} title={statusTitle} description={statusDescription} onRetry={onRetry} />}
    </main>
  );
}

export interface AuthenticationPageProps {
  company: ReactNode;
  product?: ReactNode;
  visual?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function AuthenticationPage({ company, product, visual, title, description, children, footer, className }: AuthenticationPageProps) {
  return (
    <main className={cx("pui-auth-page", className)} data-pui-owner="AuthenticationPage">
      {visual != null ? <section className="pui-auth-page__visual">{visual}</section> : null}
      <section className="pui-auth-page__form">
        <header><div className="pui-auth-page__identity">{company}{product != null ? <span>{product}</span> : null}</div><h1>{title}</h1>{description != null ? <p>{description}</p> : null}</header>
        <div>{children}</div>
        {footer != null ? <footer>{footer}</footer> : null}
      </section>
    </main>
  );
}
