import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Heart, MapPin, Plus, ShoppingBag } from "lucide-react";
import {
  Button, Card, Checkbox, ConfirmDialog, DescriptionList, Dialog,
  EmptyState, Field, Form, Inline, Input, PageHeading, Stack, Tag, useToast,
  type TextControlHandle,
} from "../../ui";
import { useCommerce, type Address } from "./commerce-store";
import "./shop-account.css";

type AddressDraft = Omit<Address, "id"> & { id?: string };
type AddressErrors = Partial<Record<"name" | "phone" | "address", string>>;
const blankAddress: AddressDraft = { name: "", phone: "", address: "", isDefault: false };

interface ShopAccountPageProps {
  onOrders: () => void;
  onFavorites: () => void;
  onLogin: () => void;
  onBrowse: () => void;
}

/** Account data and address book share the storefront's current in-memory session. */
export function ShopAccountPage({ onOrders, onFavorites, onLogin, onBrowse }: ShopAccountPageProps) {
  const { account, addresses, favorites, orders, saveAddress, removeAddress, setDefaultAddress, signOut } = useCommerce();
  const { toast } = useToast();
  const id = useId();
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<AddressDraft>(blankAddress);
  const [errors, setErrors] = useState<AddressErrors>({});
  const [saving, setSaving] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const savingLock = useRef(false);
  const mounted = useRef(true);
  const timers = useRef(new Map<ReturnType<typeof setTimeout>, () => void>());
  const nameRef = useRef<TextControlHandle>(null);
  const phoneRef = useRef<TextControlHandle>(null);
  const addressRef = useRef<TextControlHandle>(null);
  const removal = addresses.find((address) => address.id === removeId);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const [timer, cancel] of timers.current) { clearTimeout(timer); cancel(); }
      timers.current.clear();
    };
  }, []);

  function delay() {
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => { timers.current.delete(timer); resolve(mounted.current); }, 450);
      timers.current.set(timer, () => resolve(false));
    });
  }

  function openEditor(address?: Address) {
    setDraft(address ? { ...address } : { ...blankAddress, name: account?.name ?? "", isDefault: addresses.length === 0 });
    setErrors({});
    setEditorOpen(true);
  }

  function updateDraft(field: "name" | "phone" | "address", value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingLock.current) return;
    const nextErrors: AddressErrors = {};
    if (draft.name.trim().length < 2) nextErrors.name = "请输入至少两个字的收货人姓名。";
    if (!/^\+?\d{7,15}$/.test(draft.phone.replace(/[\s()-]/g, ""))) nextErrors.phone = "请输入有效的联系电话，可包含国家区号。";
    if (draft.address.trim().length < 8) nextErrors.address = "请填写至少 8 个字的完整收货地址。";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      if (nextErrors.name) nameRef.current?.focus();
      else if (nextErrors.phone) phoneRef.current?.focus();
      else addressRef.current?.focus();
      return;
    }
    savingLock.current = true;
    setSaving(true);
    try {
      if (!(await delay())) return;
      saveAddress({ ...draft, name: draft.name.trim(), phone: draft.phone.trim(), address: draft.address.trim() });
      setEditorOpen(false);
      toast({ description: draft.id ? "收货地址已更新" : "收货地址已添加", tone: "success", position: "top-center" });
    } catch (error) {
      if (mounted.current) toast({ tone: "danger", title: "地址未保存", description: error instanceof Error ? error.message : "地址保存失败，请重试。输入内容已保留。" });
    } finally {
      savingLock.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  if (!account) return (
    <div className="shop-account-page">
      <PageHeading title="个人中心" description="登录后查看账户资料、收藏与收货地址。" />
      <Card>
        <EmptyState icon={<ShoppingBag aria-hidden="true" />} title="欢迎来到青屿" description="登录已有账户或注册新账户，让心愿与订单都有自己的归处。" action={<Inline justify="center"><Button variant="primary" onClick={onLogin}>登录 / 注册</Button><Button onClick={onBrowse}>先去逛逛</Button></Inline>} />
      </Card>
    </div>
  );

  return (
    <div className="shop-account-page">
      <PageHeading title="个人中心" description={`你好，${account.name}。在这里管理你的日常好物与收货信息。`} />
      <div className="shop-account-overview">
        <Card heading="账户资料" description="青屿商城账户" footer={<Button variant="ghost" size="small" onClick={() => { signOut(); onLogin(); }}>退出登录</Button>}>
          <DescriptionList divided={false} items={[
            { id: "name", term: "姓名", description: account.name },
            { id: "email", term: "邮箱", description: account.email },
            { id: "session", term: "会话", description: "本次浏览有效，刷新页面后结束" },
          ]} />
        </Card>
        <Card heading="我的好物" description="订单与收藏，随时查看">
          <Stack gap="medium">
            <div className="shop-account-summary">
              <div><strong className="shop-account-count">{orders.length}</strong><span>笔订单</span></div>
              <div><strong className="shop-account-count">{favorites.length}</strong><span>件收藏</span></div>
            </div>
            <Inline><Button icon={<ShoppingBag aria-hidden="true" />} onClick={onOrders}>查看我的订单</Button><Button icon={<Heart aria-hidden="true" />} onClick={onFavorites}>我的收藏</Button></Inline>
          </Stack>
        </Card>
      </div>
      <section className="shop-account-address-section" aria-labelledby={`${id}-addresses-title`}>
        <div className="shop-account-section-heading">
          <div><h2 id={`${id}-addresses-title`}>收货地址</h2><p>设置默认地址，下单时更方便。</p></div>
          <Button variant="primary" icon={<Plus aria-hidden="true" />} onClick={() => openEditor()}>新增地址</Button>
        </div>
        {addresses.length === 0 ? <Card><EmptyState icon={<MapPin aria-hidden="true" />} title="还没有收货地址" description="添加一个常用地址，之后可直接在购物车中选择。" action={<Button onClick={() => openEditor()}>添加第一个地址</Button>} /></Card> : (
          <div className="shop-account-address-grid">
            {addresses.map((address) => <Card key={address.id} aria-label={`${address.name}的收货地址`} heading={<Inline><span>{address.name}</span>{address.isDefault ? <Tag tone="blue">默认地址</Tag> : null}</Inline>} footer={<Inline gap="small">
              <Button size="small" aria-label={`编辑${address.name}的收货地址`} onClick={() => openEditor(address)}>编辑</Button>
              <Button size="small" variant="ghost" aria-label={`删除${address.name}的收货地址`} onClick={() => setRemoveId(address.id)}>删除</Button>
              {!address.isDefault ? <Button size="small" variant="ghost" aria-label={`将${address.name}的地址设为默认`} onClick={() => {
                try { setDefaultAddress(address.id); toast({ tone: "success", description: "默认收货地址已更新", position: "top-center" }); }
                catch (error) { toast({ tone: "danger", description: error instanceof Error ? error.message : "设置失败，请重试。" }); }
              }}>设为默认</Button> : null}
            </Inline>}>
              <Stack gap="small"><p className="shop-account-phone">{address.phone}</p><p className="shop-account-address">{address.address}</p></Stack>
            </Card>)}
          </div>
        )}
      </section>
      <Dialog open={editorOpen} onOpenChange={(open) => { if (!savingLock.current) setEditorOpen(open); }} closable={!saving} closeOnBackdropClick={false} title={draft.id ? "编辑收货地址" : "新增收货地址"} description="请填写准确的收货人与联系电话。" width="small">
        <Form noValidate busy={saving} onSubmit={submit}>
          <Field label="收货人" htmlFor={`${id}-name`} required error={errors.name}>
            <Input id={`${id}-name`} name="recipient" value={draft.name} autoComplete="name" maxLength={40} disabled={saving} controlRef={nameRef} placeholder="请输入收货人姓名" onChange={(event) => updateDraft("name", event.currentTarget.value)} />
          </Field>
          <Field label="联系电话" htmlFor={`${id}-phone`} required error={errors.phone}>
            <Input id={`${id}-phone`} name="phone" type="tel" value={draft.phone} autoComplete="tel" maxLength={24} disabled={saving} controlRef={phoneRef} placeholder="例如：13800138000" onChange={(event) => updateDraft("phone", event.currentTarget.value)} />
          </Field>
          <Field label="详细地址" htmlFor={`${id}-address`} required error={errors.address} hint="请包含省市区、街道及门牌号。">
            <Input id={`${id}-address`} name="address" value={draft.address} autoComplete="street-address" maxLength={200} disabled={saving} controlRef={addressRef} placeholder="请输入完整收货地址" onChange={(event) => updateDraft("address", event.currentTarget.value)} />
          </Field>
          <Checkbox label="设为默认收货地址" checked={draft.isDefault} disabled={saving} onChange={(event) => { const checked = event.currentTarget.checked; setDraft((current) => ({ ...current, isDefault: checked })); }} />
          <Inline justify="end"><Button disabled={saving} onClick={() => setEditorOpen(false)}>取消</Button><Button type="submit" variant="primary" loading={saving} loadingLabel="保存中">保存地址</Button></Inline>
        </Form>
      </Dialog>
      <ConfirmDialog open={Boolean(removal)} onOpenChange={(open) => { if (!open) setRemoveId(null); }} title="删除收货地址？" description={`将删除${removal?.name ?? ""}的收货地址，已有订单中的地址不会改变。`} tone="danger" confirmLabel="确认删除" cancelLabel="保留地址" closeOnBackdropClick={false} onConfirm={async () => {
        const selectedId = removeId;
        if (selectedId && await delay()) {
          removeAddress(selectedId);
          toast({ tone: "success", description: "收货地址已删除", position: "top-center" });
        }
      }} errorMessage="删除失败，地址仍保留。请重试。" />
    </div>
  );
}
