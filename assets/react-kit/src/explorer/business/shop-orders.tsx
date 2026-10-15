import { useEffect, useId, useRef, useState } from "react";
import { CheckCheck, CreditCard, PackageCheck, ShoppingBag, Truck, X } from "lucide-react";
import {
  Button, Card, ConfirmDialog, DescriptionList, DetailPage, Dialog,
  EmptyState, Field, FilterBar, Inline, Link, Media, OverflowText, Pagination,
  SearchFilterPage, SearchInput, Select, Stack, Tabs, Tag, Timeline, useToast,
  type TagTone,
} from "../../ui";
import { formatMoney, useCommerce, type Order, type OrderStatus } from "./commerce-store";
import "./shop-orders.css";

const statusLabels: Record<OrderStatus, string> = {
  pending: "待付款", paid: "待发货", shipped: "待收货", completed: "已完成", cancelled: "已取消",
};
const statusTones: Record<OrderStatus, TagTone> = {
  pending: "warning", paid: "blue", shipped: "blue", completed: "success", cancelled: "neutral",
};
const dateLabel = (time: string) => new Intl.DateTimeFormat("zh-CN", {
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
}).format(new Date(time));

function OrderItems({ order }: { order: Order }) {
  return <Stack gap="small">{order.items.map((item) => <div key={item.productId} className="shop-orders__item">
    <div className="shop-orders__image"><Media src={item.image} alt={item.name} aspectRatio="1" objectFit="contain" /></div>
    <div className="shop-orders__item-copy"><strong><OverflowText>{item.name}</OverflowText></strong><span className="shop-orders__muted">{formatMoney(item.price)} × {item.quantity}</span></div>
    <strong className="shop-orders__item-total">{formatMoney(item.price * item.quantity)}</strong>
  </div>)}</Stack>;
}

/** Customer-facing order history and a routable order detail, without merchant commands. */
export function ShopOrdersPage({ orderId, onBrowse, onOrder }: {
  orderId?: string; onBrowse: () => void; onOrder: (id: string) => void;
}) {
  const { orders, payOrder, cancelOrder, completeOrder } = useCommerce();
  const { toast } = useToast();
  const id = useId();
  const [status, setStatus] = useState("all");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("wechat");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [pending, setPending] = useState<"pay" | "cancel" | "complete" | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const actionLock = useRef(false);
  const queryLock = useRef(false);
  const operationGeneration = useRef(0);
  const alive = useRef(true);
  const timers = useRef(new Map<ReturnType<typeof setTimeout>, () => void>());
  const currentOrders = useRef(orders);
  currentOrders.current = orders;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      for (const [timer, cancel] of timers.current) { clearTimeout(timer); cancel(); }
      timers.current.clear();
    };
  }, []);
  useEffect(() => {
    operationGeneration.current += 1;
    setPaymentId(null); setCancelId(null);
  }, [orderId]);
  const delay = (milliseconds: number) => new Promise<boolean>((resolve) => {
    if (!alive.current) { resolve(false); return; }
    const timer = setTimeout(() => { timers.current.delete(timer); resolve(alive.current); }, milliseconds);
    timers.current.set(timer, () => resolve(false));
  });

  async function perform(order: Order, action: "pay" | "cancel" | "complete") {
    if (actionLock.current) return;
    actionLock.current = true;
    const startedGeneration = operationGeneration.current;
    setPending(action); setPendingOrderId(order.id);
    if (!(await delay(650))) return;
    if (startedGeneration !== operationGeneration.current) {
      actionLock.current = false; setPending(null); setPendingOrderId(null);
      return;
    }
    try {
      const latest = currentOrders.current.find((item) => item.id === order.id);
      const required = action === "complete" ? "shipped" : "pending";
      if (!latest || latest.status !== required) throw new Error("订单状态已变化，请查看最新状态后再操作。");
      if (action === "pay") payOrder(order.id);
      if (action === "cancel") cancelOrder(order.id);
      if (action === "complete") completeOrder(order.id);
      if (action === "pay") setPaymentId(null);
      toast({
        tone: "success", position: "top-center", shape: "pill",
        description: action === "pay" ? "演示付款成功，正在为你准备发货。"
          : action === "cancel" ? "订单已取消，预留库存已返还。" : "收货确认成功，感谢选购青屿。",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "操作失败，请重试。";
      if (action === "cancel") throw error;
      toast({ tone: "danger", description: message });
    } finally { actionLock.current = false; setPending(null); setPendingOrderId(null); }
  }

  const openPayment = (order: Order) => { setPaymentId(order.id); setPaymentMethod("wechat"); };
  const buttons = (order: Order) => <Inline gap="small">
    {order.status === "pending" ? <>
      <Button size="small" disabled={pending !== null} onClick={() => setCancelId(order.id)}>取消订单</Button>
      <Button size="small" variant="primary" icon={<CreditCard />} disabled={pending !== null} onClick={() => openPayment(order)}>去付款</Button>
    </> : null}
    {order.status === "shipped" ? <Button size="small" variant="primary" icon={<CheckCheck />} loading={pending === "complete" && pendingOrderId === order.id} loadingLabel="确认收货" disabled={pending !== null && !(pending === "complete" && pendingOrderId === order.id)} onClick={() => { void perform(order, "complete"); }}>确认收货</Button> : null}
  </Inline>;
  const selected = orders.find((order) => order.id === orderId);
  const payment = orders.find((order) => order.id === paymentId);
  const cancellation = orders.find((order) => order.id === cancelId);
  const filtered = orders.filter((order) => (
    (status === "all" || order.status === status)
    && (!search || [order.id, ...order.items.map((item) => item.name)]
      .some((value) => value.toLocaleLowerCase().includes(search.toLocaleLowerCase())))
  )).sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const activePage = Math.min(page, pageCount);
  const listContent = <Stack gap="medium">
    {filtered.length ? filtered.slice((activePage - 1) * pageSize, activePage * pageSize).map((order) => <Card key={order.id} padding="medium"
      heading={<OverflowText>{order.id}</OverflowText>} description={dateLabel(order.createdAt)}
      header={<Tag tone={statusTones[order.status]}>{statusLabels[order.status]}</Tag>}
      footer={<Inline justify="between"><span className="shop-orders__amount">合计 <strong>{formatMoney(order.total)}</strong></span><Inline gap="small"><Button size="small" onClick={() => onOrder(order.id)}>查看详情</Button>{buttons(order)}</Inline></Inline>}>
      <OrderItems order={order} />
    </Card>) : <Card><EmptyState icon={<ShoppingBag />} title="这里还没有订单" description={search ? "没有匹配的订单，请尝试其他订单编号或商品名称。" : "订单提交后，会出现在对应的订单状态中。"} action={<Button variant="primary" onClick={onBrowse}>继续选购</Button>} /></Card>}
    <Pagination page={activePage} pageCount={pageCount} total={filtered.length} pageSize={pageSize} pageSizeOptions={[5, 10, 20]}
      onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
  </Stack>;

  const detailSections = selected ? [
    { id: `${id}-status`, content: <Card padding="large"><Stack gap="medium">
      <Inline justify="between"><Tag tone={statusTones[selected.status]}>{statusLabels[selected.status]}</Tag><strong className="shop-orders__price">{formatMoney(selected.total)}</strong></Inline>
      <p className="shop-orders__status-copy">{selected.status === "pending" ? "订单已创建，商品库存已为你预留。请完成付款，或在不需要时取消订单。"
        : selected.status === "paid" ? "付款已完成，商家正在备货。演示物流将自动更新为已发货，无需手动发货。"
        : selected.status === "shipped" ? "商品已经发出。收到商品并检查无误后，即可确认收货。"
        : selected.status === "completed" ? "订单已完成，感谢你把青屿好物带回家。" : "此订单已取消，预留的商品库存已返还。"}</p>
      {buttons(selected)}
    </Stack></Card> },
    { id: `${id}-items`, title: "商品明细", content: <Card><OrderItems order={selected} /></Card> },
    { id: `${id}-delivery`, title: "收货信息", content: <Card><DescriptionList items={[
      { id: "receiver", term: "收货人", description: selected.receiver },
      { id: "phone", term: "联系电话", description: selected.phone },
      { id: "address", term: "详细地址", description: selected.address },
      { id: "shipping", term: "配送方式", description: selected.shippingMethod === "express" ? "快递配送" : "标准配送" },
      { id: "note", term: "订单备注", description: selected.note || "无" },
    ]} /></Card> },
    { id: `${id}-timeline`, title: "订单与配送进度", content: <Card><Stack gap="medium">
      {selected.status === "shipped" || selected.status === "completed" ? <p className="shop-orders__muted">此处展示配送进度，未对接真实物流公司或运单。</p> : null}
      <Timeline ariaLabel="订单处理进度" items={selected.events.map((event) => ({
        id: event.id, title: event.title, time: dateLabel(event.time), dateTime: event.time,
        icon: event.title.includes("发货") ? <Truck /> : event.title.includes("付款") ? <CreditCard /> : event.title.includes("取消") ? <X /> : <PackageCheck />,
        tone: selected.status === "completed" ? "success" : "blue",
      }))} />
    </Stack></Card> },
  ] : [];

  return <div className="shop-orders">
    {orderId ? selected ? <>
      <div className="shop-orders__back"><Link href="#/examples/shop/orders">返回我的订单</Link></div>
      <DetailPage title="订单详情" description={`${selected.id} · ${dateLabel(selected.createdAt)}`} actions={<Button variant="ghost" onClick={onBrowse}>继续选购</Button>}
        sections={detailSections} aside={<Stack gap="medium">
          <Card heading="订单金额"><DescriptionList items={[
            { id: "subtotal", term: "商品金额", description: formatMoney(selected.subtotal) },
            { id: "shipping", term: "配送费用", description: selected.shipping === 0 ? "免运费" : formatMoney(selected.shipping) },
            { id: "discount", term: "优惠金额", description: selected.discount > 0 ? `−${formatMoney(selected.discount)}` : "暂无优惠" },
            { id: "total", term: selected.status === "pending" ? "应付金额" : selected.status === "cancelled" ? "订单合计" : "实付金额", description: <strong className="shop-orders__price">{formatMoney(selected.total)}</strong> },
          ]} /></Card>
          {selected.couponCode ? <Card heading="使用优惠"><Tag tone="success">{selected.couponCode}</Tag></Card> : null}
          <p className="shop-orders__muted">此商城使用本地演示数据，付款不产生真实扣款。离开页面后可继续查看本次订单；刷新页面会恢复初始数据。</p>
        </Stack>} />
    </> : <SearchFilterPage title="订单详情"><Card><EmptyState title="没有找到这笔订单" description="订单可能已随演示数据重置，返回订单列表查看现有订单。" action={<Link href="#/examples/shop/orders">返回我的订单</Link>} /></Card></SearchFilterPage>
      : <SearchFilterPage title="我的订单" description="查看订单状态与配送进度。" actions={<Button variant="ghost" onClick={onBrowse}>继续选购</Button>}
        filters={<FilterBar ariaLabel="查找我的订单" onSubmit={(event) => {
          event.preventDefault();
          if (queryLock.current) return;
          const next = searchDraft.trim();
          queryLock.current = true; setSearching(true);
          void delay(350).then((completed) => {
            if (!completed) return;
            setSearch(next); setPage(1); setSearching(false); queryLock.current = false;
          });
        }} actions={<Button type="submit" size="field" variant="primary" loading={searching} loadingLabel="搜索">搜索</Button>}>
          <SearchInput aria-label="搜索我的订单" placeholder="订单编号或商品名称" value={searchDraft} onChange={(event) => setSearchDraft(event.currentTarget.value)} onClear={() => setSearchDraft("")} />
        </FilterBar>}>
        <Tabs ariaLabel="订单状态" value={status} onValueChange={(value) => { setStatus(value); setPage(1); }} items={[
          { id: "all", label: `全部 ${orders.length}`, content: listContent },
          ...(["pending", "paid", "shipped", "completed", "cancelled"] as const).map((value) => ({
            id: value, label: `${statusLabels[value]} ${orders.filter((order) => order.status === value).length}`, content: listContent,
          })),
        ]} />
      </SearchFilterPage>}

    <Dialog open={payment !== undefined} onOpenChange={(open) => { if (!actionLock.current && !open) setPaymentId(null); }} closable={pending !== "pay"}
      title="订单支付" description="选择付款方式，体验完整支付流程。" width="small" closeOnBackdropClick={false}
      footer={<Inline justify="end"><Button disabled={pending !== null} onClick={() => setPaymentId(null)}>稍后付款</Button><Button variant="primary" icon={<CreditCard />} loading={pending === "pay"} loadingLabel="确认模拟付款" disabled={payment?.status !== "pending"} onClick={() => { if (payment) void perform(payment, "pay"); }}>确认模拟付款</Button></Inline>}>
      {payment ? <Stack gap="large">
        <DescriptionList items={[{ id: "order", term: "订单编号", description: payment.id }, { id: "amount", term: "付款金额", description: <strong className="shop-orders__price">{formatMoney(payment.total)}</strong> }]} />
        <Field htmlFor={`${id}-payment-method`} label="付款方式"><Select id={`${id}-payment-method`} ariaLabel="付款方式" value={paymentMethod} disabled={pending !== null} options={[{ value: "wechat", label: "微信支付（演示）" }, { value: "alipay", label: "支付宝（演示）" }]} onValueChange={setPaymentMethod} /></Field>
        <p className="shop-orders__muted">本次仅模拟支付成功，不会连接支付平台、打开二维码或产生真实扣款。</p>
      </Stack> : null}
    </Dialog>
    <ConfirmDialog open={cancellation !== undefined} onOpenChange={(open) => { if (!open) setCancelId(null); }} title="取消这笔订单？"
      description="取消后将释放预留库存，订单会保留在已取消列表中。" confirmLabel="确认取消" cancelLabel="保留订单" tone="danger" closeOnBackdropClick={false}
      onConfirm={async () => { if (cancellation) await perform(cancellation, "cancel"); }} errorMessage="取消失败，请检查最新订单状态后重试。" />
  </div>;
}
