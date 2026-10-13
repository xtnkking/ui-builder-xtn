import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Code2, RotateCcw, Search, ShoppingBag, UserRound } from "lucide-react";
import { AppNavigation, Button, CodeBlock, ConfirmDialog, Dialog, Drawer, Form, Inline, Link, SearchInput, Stack, Tabs } from "../../ui";
import { BusinessAuthenticationExample } from "./authentication";
import { ShopAccountPage } from "./shop-account";
import { ShopHomePage, ShopCatalogPage, ShopProductPage } from "./shop-catalog";
import { ShopCartPage, ShopCheckoutPage } from "./shop-checkout";
import { ShopOrdersPage } from "./shop-orders";
import { useCommerce } from "./commerce-store";
import shellSource from "./BusinessExamples.tsx?raw";
import authSource from "./authentication.tsx?raw";
import accountSource from "./shop-account.tsx?raw";
import catalogSource from "./shop-catalog.tsx?raw";
import checkoutSource from "./shop-checkout.tsx?raw";
import orderSource from "./shop-orders.tsx?raw";
import storeSource from "./commerce-store.tsx?raw";
import shellStyles from "./business.css?raw";
import authStyles from "./authentication.css?raw";
import accountStyles from "./shop-account.css?raw";
import catalogStyles from "./shop-catalog.css?raw";
import checkoutStyles from "./shop-checkout.css?raw";
import orderStyles from "./shop-orders.css?raw";
import "./business.css";

const root = "#/examples/shop";
function navigate(path = "", query?: { category?: string; q?: string }) {
  const params = new URLSearchParams();
  if (query?.category) params.set("category", query.category);
  if (query?.q) params.set("q", query.q);
  window.location.hash = `${root}${path ? `/${path}` : ""}${params.size ? `?${params}` : ""}`;
}
function readRoute(hash: string) {
  const url = new URL(hash.replace(/^#/, ""), "https://shop.example");
  const path = url.pathname.replace(/^\/examples\/?(?:shop\/?)?/, "");
  return { path, category: url.searchParams.get("category") ?? "", query: url.searchParams.get("q") ?? "" };
}
const serviceCopy = {
  delivery: { title: "配送与退换", text: "普通配送商品满 ¥199 免运费，未满收取 ¥10；加急配送 ¥20。商品支持 7 天无理由退货，非人为损坏享 1 年保修。这里是本地商城示例，订单与物流用于体验流程，不产生真实交易。" },
  contact: { title: "联系青屿", text: "售前选购、订单咨询与售后问题，欢迎联系 hello@qingyu.example。服务时间为周一至周日 09:00–20:00。本邮箱为案例中的虚构联系方式。" },
  about: { title: "关于青屿", text: "青屿专注于日常生活中实用、耐看的小物。从一张桌面到一次出行，我们希望每一件物品都能在生活里陪伴更久。青屿是本案例使用的虚构商城品牌。" },
};

export function BusinessExamples({ hash }: { hash: string }) {
  const { account, cart, reset } = useCommerce();
  const route = readRoute(hash);
  const [search, setSearch] = useState(route.query);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [service, setService] = useState<keyof typeof serviceCopy | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [compactNavigation, setCompactNavigation] = useState(() => window.matchMedia("(max-width: 480px)").matches);
  const quantity = cart.reduce((sum, line) => sum + line.quantity, 0);
  useEffect(() => { setSearch(route.query); window.scrollTo({ top: 0 }); }, [hash]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 480px)");
    const update = () => setCompactNavigation(media.matches);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "青屿商城 · 日常里的好物";
    return () => { document.title = previousTitle; };
  }, []);
  function searchProducts(event: FormEvent<HTMLFormElement>) { event.preventDefault(); navigate("products", { q: search.trim() }); }
  const onBrowse = () => navigate("products");
  const onProduct = (id: string) => navigate(`product/${id}`);
  const onOrder = (id: string) => navigate(`orders/${id}`);

  return <div className="demo-shell ui-root storefront-shell">
    <div className="storefront-announcement">日常里的好物 · 满 ¥199 普通配送免运费</div>
    <header className="storefront-header">
      <div className="storefront-header-main">
        <div className="storefront-brand"><Link href={root}>青屿</Link><span className="storefront-brand-english">QINGYU</span></div>
        <div className="storefront-header-search"><Form onSubmit={searchProducts}><div className="storefront-search-row">
          <SearchInput aria-label="搜索商城商品" value={search} onChange={(event) => setSearch(event.currentTarget.value)} onClear={() => setSearch("")} placeholder="寻找日常好物" />
          <Button type="submit" size="field" variant="primary" icon={<Search aria-hidden="true" />}>搜索</Button>
        </div></Form></div>
        <div className="storefront-account-actions">
          <Link href={`${root}/account`} icon={<UserRound aria-hidden="true" />}>{account?.name ?? "我的账户"}</Link>
          <Link href={`${root}/cart`} icon={<ShoppingBag aria-hidden="true" />}>{`购物车${quantity ? ` (${quantity})` : ""}`}</Link>
        </div>
      </div>
      <div className="storefront-navigation"><AppNavigation variant="top" ariaLabel="商城导航" items={[
        { id: "home", label: "首页", href: root, active: !route.path },
        { id: "products", label: compactNavigation ? "商品" : "全部商品", href: `${root}/products`, active: route.path === "products" || route.path.startsWith("product/") },
        { id: "favorites", label: compactNavigation ? "收藏" : "我的收藏", href: `${root}/favorites`, active: route.path === "favorites" },
        { id: "orders", label: compactNavigation ? "订单" : "我的订单", href: `${root}/orders`, active: route.path.startsWith("orders") },
      ]} /></div>
    </header>
    <main className="storefront-main" key={`${epoch}-${route.path}-${route.category}-${route.query}`}>
      {!route.path && <ShopHomePage onBrowse={(category) => navigate("products", { category })} onProduct={onProduct} />}
      {route.path === "products" && <ShopCatalogPage initialCategory={route.category} initialSearch={route.query} onProduct={onProduct} />}
      {route.path === "favorites" && <ShopCatalogPage favoritesOnly onProduct={onProduct} />}
      {route.path.startsWith("product/") && <ShopProductPage productId={route.path.slice(8)} onBrowse={onBrowse} onCart={() => navigate("cart")} />}
      {route.path === "cart" && <ShopCartPage onBrowse={onBrowse} onCheckout={() => navigate("checkout")} />}
      {route.path === "checkout" && <ShopCheckoutPage onBrowse={onBrowse} onCart={() => navigate("cart")} onOrderCreated={onOrder} />}
      {(route.path === "orders" || route.path.startsWith("orders/")) && <ShopOrdersPage orderId={route.path.startsWith("orders/") ? route.path.slice(7) : undefined} onBrowse={onBrowse} onOrder={onOrder} />}
      {route.path === "account" && <ShopAccountPage onOrders={() => navigate("orders")} onFavorites={() => navigate("favorites")} onLogin={() => navigate("login")} onBrowse={onBrowse} />}
      {(route.path === "login" || route.path === "authentication") && <BusinessAuthenticationExample onContinue={onBrowse} />}
      {route.path && !["products", "favorites", "cart", "checkout", "orders", "account", "login", "authentication"].includes(route.path) && !route.path.startsWith("product/") && !route.path.startsWith("orders/") && <Stack><h1>页面暂未找到</h1><Button onClick={() => navigate()}>返回商城首页</Button></Stack>}
    </main>
    <footer className="storefront-footer">
      <div className="storefront-footer-main">
        <div className="storefront-footer-story"><strong>青屿 QINGYU</strong><p>让喜欢的物品，成为生活的一部分。</p></div>
        <Inline gap="large"><Button variant="ghost" size="small" onClick={() => setService("delivery")}>配送与退换</Button><Button variant="ghost" size="small" onClick={() => setService("contact")}>联系我们</Button><Button variant="ghost" size="small" onClick={() => setService("about")}>关于青屿</Button></Inline>
      </div>
      <div className="storefront-demo-tools"><p>本地商城示例，不产生真实交易；刷新页面后数据重置。</p><Inline gap="small">
        <Link href="#/components/button" icon={<ArrowLeft aria-hidden="true" />}>组件目录</Link>
        <Button variant="ghost" size="small" icon={<Code2 aria-hidden="true" />} onClick={() => setSourceOpen(true)}>项目源码</Button>
        <Button variant="ghost" size="small" icon={<RotateCcw aria-hidden="true" />} onClick={() => setResetOpen(true)}>重置示例</Button>
      </Inline></div>
    </footer>
    <Dialog open={service !== null} onOpenChange={(open) => { if (!open) setService(null); }} title={service ? serviceCopy[service].title : "青屿商城"} width="small"><p className="storefront-service-copy">{service ? serviceCopy[service].text : ""}</p></Dialog>
    <ConfirmDialog open={resetOpen} onOpenChange={setResetOpen} title="重置商城示例？" description="将清空本次购物车、收藏与临时账户，并恢复初始商品、地址和订单数据。" confirmLabel="重置示例" cancelLabel="继续浏览" onConfirm={() => { reset(); setEpoch((value) => value + 1); navigate(); }} />
    <Drawer open={sourceOpen} onOpenChange={setSourceOpen} width="large" title="青屿商城 · 项目源码" description="一个连贯的商城前端项目，业务页面均组合官方组件；请求与数据当前在内存中模拟。">
      <Tabs ariaLabel="商城项目源码" items={[
        { id: "catalog", label: "首页与商品", content: <CodeBlock language="tsx" code={catalogSource} copyable /> },
        { id: "checkout", label: "购物与结算", content: <CodeBlock language="tsx" code={checkoutSource} copyable /> },
        { id: "orders", label: "订单", content: <CodeBlock language="tsx" code={orderSource} copyable /> },
        { id: "account", label: "账户", content: <CodeBlock language="tsx" code={`${authSource}\n\n${accountSource}`} copyable /> },
        { id: "store", label: "共享数据", content: <CodeBlock language="tsx" code={storeSource} copyable /> },
        { id: "shell", label: "导航与路由", content: <CodeBlock language="tsx" code={shellSource} copyable /> },
        { id: "layout", label: "布局", content: <CodeBlock language="css" code={[shellStyles, catalogStyles, checkoutStyles, orderStyles, authStyles, accountStyles].join("\n\n")} copyable /> },
      ]} />
    </Drawer>
  </div>;
}
