import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ArrowRight, ShoppingBag, Trash2, Truck } from "lucide-react";
import {
  Alert, Button, Card, DescriptionList, DetailPage, EmptyState, Field, Form,
  IconButton, Inline, Input, Media, NumberInput, OverflowText, Select, Stack,
  Tag, Textarea, useToast, type TextControlHandle,
} from "../../ui";
import { calculateTotals, formatMoney, useCommerce } from "./commerce-store";
import "./shop-checkout.css";

function useShopDelay() {
  const mounted = useRef(true);
  const timers = useRef(new Map<ReturnType<typeof setTimeout>, () => void>());
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const [timer, cancel] of timers.current) { clearTimeout(timer); cancel(); }
      timers.current.clear();
    };
  }, []);
  return (milliseconds: number) => new Promise<boolean>((resolve) => {
    if (!mounted.current) { resolve(false); return; }
    const timer = setTimeout(() => { timers.current.delete(timer); resolve(mounted.current); }, milliseconds);
    timers.current.set(timer, () => resolve(false));
  });
}

function Totals({ subtotal, shipping, discount, total }: {
  subtotal: number; shipping: number; discount: number; total: number;
}) {
  return <div className="shop-checkout__totals">
    <DescriptionList items={[
      { id: "subtotal", term: "商品金额", description: formatMoney(subtotal) },
      { id: "shipping", term: "配送费用", description: shipping === 0 ? "免运费" : formatMoney(shipping) },
      { id: "discount", term: "优惠金额", description: discount > 0 ? `−${formatMoney(discount)}` : "暂无优惠" },
    ]} />
    <div className="shop-checkout__total"><span>合计</span><strong>{formatMoney(total)}</strong></div>
  </div>;
}

export function ShopCartPage({ onBrowse, onCheckout }: { onBrowse: () => void; onCheckout: () => void }) {
  const { products, cart, setCartQuantity } = useCommerce();
  const { toast } = useToast();
  const id = useId();
  const [error, setError] = useState("");
  const lines = cart.flatMap((line) => {
    const product = products.find((item) => item.id === line.productId);
    return product ? [{ ...line, product }] : [];
  });
  const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const totals = calculateTotals(subtotal);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const update = (productId: string, quantity: number) => {
    try { setCartQuantity(productId, quantity); setError(""); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "数量更新失败，请重试。"); }
  };

  return <div className="shop-checkout">
    <DetailPage title="购物车" description={count ? `${lines.length} 款好物，共 ${count} 件` : "把喜欢的好物放进购物车。"}
      onBack={onBrowse} backLabel="继续选购" actions={<Button variant="ghost" onClick={onBrowse}>继续选购</Button>}
      sections={[{ id: `${id}-cart-lines`, content: <Stack gap="medium">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {lines.length ? lines.map(({ product, quantity }) => <Card key={product.id} padding="medium">
          <div className="shop-checkout__cart-line">
            <div className="shop-checkout__cart-image"><Media src={product.image} alt={product.name} aspectRatio="1" objectFit="contain" /></div>
            <div className="shop-checkout__cart-copy">
              <strong><OverflowText>{product.name}</OverflowText></strong>
              <span className="shop-checkout__muted">{product.variants.join("、")} · {product.category}</span>
              <span>{formatMoney(product.price)} / 件</span>
              <span className="shop-checkout__muted">可售库存 {product.stock} 件</span>
            </div>
            <div className="shop-checkout__cart-remove"><IconButton aria-label={`移除${product.name}`} icon={<Trash2 />} onClick={() => {
              update(product.id, 0);
              toast({ tone: "info", description: `已移除${product.name}` });
            }} /></div>
            <div className="shop-checkout__cart-quantity"><Field label="数量" htmlFor={`${id}-${product.id}-quantity`}>
              <NumberInput id={`${id}-${product.id}-quantity`} ariaLabel={`${product.name}数量`} value={quantity} min={1} max={product.stock} step={1}
                onValueChange={(value) => { if (typeof value === "number" && Number.isInteger(value) && value > 0) update(product.id, value); }} />
            </Field></div>
            <strong className="shop-checkout__line-total">{formatMoney(product.price * quantity)}</strong>
          </div>
        </Card>) : <Card><EmptyState icon={<ShoppingBag />} title="购物车还是空的" description="耳机、背包、桌面灯……去发现适合你的日常好物。" action={<Button variant="primary" onClick={onBrowse}>去选购商品</Button>} /></Card>}
      </Stack> }]}
      aside={<Stack gap="medium">
        <Card heading="订单预估" padding="medium" footer={<Button variant="primary" icon={<ArrowRight />} disabled={!lines.length} onClick={onCheckout}>去结算</Button>}>
          <Totals subtotal={totals.subtotal} discount={totals.discount} shipping={lines.length ? totals.shipping : 0} total={lines.length ? totals.total : 0} />
        </Card>
        <Card heading="配送与优惠" variant="subtle" padding="medium">
          <Stack gap="small"><Inline gap="small"><Tag leading={<Truck />}>满 ¥199 标准配送免运费</Tag></Inline>
            <p className="shop-checkout__muted">标准配送未满 ¥199 收取 ¥10，快递配送 ¥20。结算时可选择配送方式。</p>
            <p className="shop-checkout__muted">商品金额满 ¥199，可在结算页使用优惠码 QINGYU20 减 ¥20。</p>
          </Stack>
        </Card>
      </Stack>} />
  </div>;
}

export function ShopCheckoutPage({ onBrowse, onCart, onOrderCreated }: {
  onBrowse: () => void; onCart: () => void; onOrderCreated: (id: string) => void;
}) {
  const { products, cart, addresses, account, placeOrder } = useCommerce();
  const { toast } = useToast();
  const id = useId();
  const delay = useShopDelay();
  const initialAddress = addresses.find((address) => address.isDefault) ?? addresses[0];
  const [addressId, setAddressId] = useState(initialAddress?.id ?? "manual");
  const [receiver, setReceiver] = useState(initialAddress?.name ?? account?.name ?? "");
  const [phone, setPhone] = useState(initialAddress?.phone ?? "");
  const [address, setAddress] = useState(initialAddress?.address ?? "");
  const [note, setNote] = useState("");
  const [shippingMethod, setShippingMethod] = useState<"standard" | "express">("standard");
  const [couponDraft, setCouponDraft] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ receiver?: string; phone?: string; address?: string }>({});
  const [submitError, setSubmitError] = useState("");
  const submitLock = useRef(false);
  const couponLock = useRef(false);
  const receiverControl = useRef<TextControlHandle>(null);
  const phoneControl = useRef<TextControlHandle>(null);
  const addressControl = useRef<TextControlHandle>(null);
  const lines = cart.flatMap((line) => {
    const product = products.find((item) => item.id === line.productId);
    return product ? [{ ...line, product }] : [];
  });
  const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const totals = calculateTotals(subtotal, couponCode, shippingMethod);
  const blocked = submitting || applyingCoupon;

  async function applyCoupon() {
    if (couponLock.current || submitLock.current) return;
    const value = couponDraft.trim().toUpperCase();
    couponLock.current = true;
    setApplyingCoupon(true);
    setCouponError("");
    if (!(await delay(350))) return;
    if (value !== "QINGYU20") setCouponError("此优惠码不可用，可输入 QINGYU20。已有优惠不会被移除。");
    else if (subtotal < 199) setCouponError("此优惠码要求商品金额满 ¥199，继续选购后再使用。");
    else { setCouponCode(value); setCouponDraft(value); toast({ tone: "success", description: "优惠码已应用，商品金额减 ¥20。" }); }
    couponLock.current = false;
    setApplyingCoupon(false);
  }

  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current || couponLock.current || !lines.length) return;
    const nextErrors: typeof errors = {};
    const cleanPhone = phone.trim();
    if (receiver.trim().length < 2) nextErrors.receiver = "请填写至少两个字的收货人姓名。";
    const phoneDigits = cleanPhone.replace(/\D/g, "");
    if (!/^\+?[\d ()-]+$/.test(cleanPhone) || phoneDigits.length < 7 || phoneDigits.length > 15) nextErrors.phone = "请填写有效的联系电话，支持国家区号。";
    if (address.trim().length < 8) nextErrors.address = "请填写省市区、街道和门牌号，至少 8 个字。";
    setErrors(nextErrors);
    setSubmitError("");
    if (Object.keys(nextErrors).length) {
      if (nextErrors.receiver) receiverControl.current?.focus();
      else if (nextErrors.phone) phoneControl.current?.focus();
      else addressControl.current?.focus();
      return;
    }
    if (couponCode && subtotal < 199) { setCouponError("当前商品金额不足 ¥199，请移除优惠码后再提交。" ); return; }
    submitLock.current = true;
    setSubmitting(true);
    if (!(await delay(700))) return;
    try {
      const order = placeOrder(address.trim(), { receiver: receiver.trim(), phone: cleanPhone, note: note.trim(), shippingMethod, couponCode });
      toast({ title: "订单已创建", description: "商品库存已预留，请继续完成付款。", tone: "success" });
      onOrderCreated(order.id);
    } catch (failure) {
      setSubmitError(failure instanceof Error ? failure.message : "订单提交失败，购物车已保留，请重试。");
    } finally { submitLock.current = false; setSubmitting(false); }
  }

  if (!lines.length) return <div className="shop-checkout"><DetailPage title="确认订单" onBack={onCart} backLabel="返回购物车"
    sections={[{ id: `${id}-empty`, content: <Card><EmptyState icon={<ShoppingBag />} title="还没有可结算的商品" description="请先选择喜欢的商品，再来确认配送信息。" action={<Button variant="primary" onClick={onBrowse}>去选购商品</Button>} /></Card> }]}
    aside={<Card heading="放心选购"><p className="shop-checkout__muted">7 天无理由退货 · 1 年保修。此商城为完整交互演示，不会产生真实交易。</p></Card>} /></div>;

  return <div className="shop-checkout"><DetailPage title="确认订单" description="核对商品，填写收货信息，再提交订单。" onBack={onCart} backLabel="返回购物车"
    actions={<Button variant="ghost" disabled={blocked} onClick={onCart}>修改购物车</Button>}
    sections={[
      { id: `${id}-delivery`, title: "收货与配送", content: <Card padding="large"><Form id={`${id}-form`} noValidate busy={submitting} onSubmit={(event) => { void checkout(event); }}>
        <Stack gap="large">
          <Field htmlFor={`${id}-saved-address`} label="选择收货地址"><Select id={`${id}-saved-address`} ariaLabel="选择收货地址" disabled={blocked} value={addressId}
            options={[...addresses.map((saved) => ({ value: saved.id, label: `${saved.name} · ${saved.address}${saved.isDefault ? "（默认）" : ""}` })), { value: "manual", label: "填写其他地址" }]}
            onValueChange={(value) => {
              setAddressId(value);
              const saved = addresses.find((item) => item.id === value);
              if (saved) { setReceiver(saved.name); setPhone(saved.phone); setAddress(saved.address); setErrors({}); }
              else { setReceiver(""); setPhone(""); setAddress(""); }
            }} /></Field>
          <div className="shop-checkout__field-pair">
            <Field htmlFor={`${id}-receiver`} label="收货人" required error={errors.receiver}><Input id={`${id}-receiver`} name="receiver" autoComplete="name" value={receiver} maxLength={40} disabled={blocked} controlRef={receiverControl} placeholder="姓名"
              onChange={(event) => { setReceiver(event.currentTarget.value); setAddressId("manual"); setErrors((current) => ({ ...current, receiver: undefined })); }} /></Field>
            <Field htmlFor={`${id}-phone`} label="联系电话" required error={errors.phone}><Input id={`${id}-phone`} name="phone" type="tel" autoComplete="tel" value={phone} maxLength={24} disabled={blocked} controlRef={phoneControl} placeholder="手机号或含区号的电话"
              onChange={(event) => { setPhone(event.currentTarget.value); setAddressId("manual"); setErrors((current) => ({ ...current, phone: undefined })); }} /></Field>
          </div>
          <Field htmlFor={`${id}-address`} label="详细地址" required error={errors.address} hint="请填写省市区、街道及门牌号。"><Input id={`${id}-address`} name="address" autoComplete="street-address" value={address} maxLength={180} disabled={blocked} controlRef={addressControl} placeholder="例如：上海市徐汇区青屿路 18 号 2 层"
            onChange={(event) => { setAddress(event.currentTarget.value); setAddressId("manual"); setErrors((current) => ({ ...current, address: undefined })); }} /></Field>
          <Field htmlFor={`${id}-shipping`} label="配送方式"><Select id={`${id}-shipping`} ariaLabel="配送方式" value={shippingMethod} disabled={blocked}
            options={[{ value: "standard", label: subtotal >= 199 ? "标准配送 · 免运费" : "标准配送 · ¥10" }, { value: "express", label: "快递配送 · ¥20" }]}
            onValueChange={(value) => setShippingMethod(value === "express" ? "express" : "standard")} /></Field>
          <Field htmlFor={`${id}-note`} label="订单备注（可选）" hint={`${note.length} / 200 字`}><Textarea id={`${id}-note`} name="note" value={note} maxLength={200} rows={3} disabled={blocked} placeholder="例如：工作日配送，请提前电话联系。" onChange={(event) => setNote(event.currentTarget.value)} /></Field>
        </Stack>
      </Form></Card> },
      { id: `${id}-products`, title: `商品清单（${lines.reduce((sum, line) => sum + line.quantity, 0)} 件）`, content: <Stack gap="small">
        {lines.map(({ product, quantity }) => <Card key={product.id} padding="small"><div className="shop-checkout__checkout-line">
          <div className="shop-checkout__small-image"><Media src={product.image} alt={product.name} aspectRatio="1" objectFit="contain" /></div>
          <div className="shop-checkout__cart-copy"><strong><OverflowText>{product.name}</OverflowText></strong><span className="shop-checkout__muted">{product.variants.join("、")} · {formatMoney(product.price)} × {quantity}</span></div>
          <strong>{formatMoney(product.price * quantity)}</strong>
        </div></Card>)}
      </Stack> },
    ]}
    aside={<Stack gap="medium">
      <Card heading="优惠码" padding="medium"><Stack gap="medium">
        <Field htmlFor={`${id}-coupon`} label="输入优惠码" error={couponError} hint="商品金额满 ¥199，使用 QINGYU20 减 ¥20。"><Input id={`${id}-coupon`} value={couponDraft} maxLength={20} disabled={blocked} placeholder="QINGYU20" onChange={(event) => { setCouponDraft(event.currentTarget.value); setCouponError(""); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void applyCoupon(); } }} /></Field>
        <Inline><Button size="small" loading={applyingCoupon} loadingLabel="应用优惠" disabled={submitting || !couponDraft.trim()} onClick={() => { void applyCoupon(); }}>应用优惠</Button>
          {couponCode ? <Tag tone="success" onRemove={() => { if (!blocked) { setCouponCode(""); setCouponDraft(""); setCouponError(""); } }} removeLabel="移除优惠码">{couponCode} 已应用</Tag> : null}
        </Inline>
      </Stack></Card>
      <Card heading="订单金额" padding="medium" footer={<Button form={`${id}-form`} type="submit" variant="primary" icon={<ArrowRight />} loading={submitting} loadingLabel="提交订单" disabled={applyingCoupon}>提交订单</Button>}>
        <Totals subtotal={totals.subtotal} shipping={totals.shipping} discount={totals.discount} total={totals.total} />
      </Card>
      {submitError ? <Alert tone="danger" title="提交未完成">{submitError}</Alert> : null}
      <p className="shop-checkout__muted">提交后预留库存，未付款时可取消。此商城为本地交互演示，不会发送真实订单或扣款。</p>
    </Stack>} /></div>;
}
