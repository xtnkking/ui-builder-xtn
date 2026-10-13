import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight, CheckCircle2, Heart, Headphones, Leaf, Maximize2, PackageCheck,
  RotateCcw, ShieldCheck, ShoppingBag, ShoppingCart, Star, Truck,
} from "lucide-react";
import {
  Accordion, Alert, Breadcrumbs, Button, Card, Checkbox, DescriptionList,
  EmptyState, Field, FilterBar, Gallery, IconButton, Inline, Lightbox, Link,
  Media, NumberInput, OverflowText, Rating, SearchInput, Select, Stack, Tabs,
  Tag, useToast,
} from "../../ui";
import { formatMoney, useCommerce, type Product } from "./commerce-store";
import "./shop-catalog.css";

const catalogHref = "#/examples/shop/products";
function productHref(id: string) { return `#/examples/shop/product/${encodeURIComponent(id)}`; }
const categoryCopy: Record<string, { title: string; copy: string }> = {
  数码配件: { title: "随身的好搭档", copy: "音乐、连接与记录，让每一次出发轻松一点。" },
  桌面办公: { title: "为专注留一点空间", copy: "让工作台整洁有序，让灵感自在发生。" },
  出行装备: { title: "轻装出发", copy: "从日常通勤到周末短途，装下你的每一种计划。" },
  居家生活: { title: "喜欢待在家的时刻", copy: "舒适的小物件，让平常的一天也值得期待。" },
};
const sortOptions = [
  { value: "recommended", label: "综合推荐" },
  { value: "price-low", label: "价格从低到高" },
  { value: "price-high", label: "价格从高到低" },
  { value: "rating", label: "评分优先" },
];

function useShopRequest() {
  const alive = useRef(true);
  const timers = useRef(new Map<ReturnType<typeof setTimeout>, () => void>());
  const cancel = useCallback(() => {
    timers.current.forEach((resolve, timer) => { clearTimeout(timer); resolve(); });
    timers.current.clear();
  }, []);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; cancel(); };
  }, [cancel]);
  const delay = useCallback((milliseconds: number) => new Promise<boolean>((resolve) => {
    if (!alive.current) { resolve(false); return; }
    const timer = setTimeout(() => { timers.current.delete(timer); resolve(alive.current); }, milliseconds);
    timers.current.set(timer, () => resolve(false));
  }), []);
  return { delay, cancel };
}

function ShopMerchandise({ product, onProduct }: { product: Product; onProduct?: (id: string) => void }) {
  const { favorites, toggleFavorite, cart, addToCart } = useCommerce();
  const { toast } = useToast();
  const { delay } = useShopRequest();
  const adding = useRef(false);
  const [pending, setPending] = useState(false);
  const favorite = favorites.includes(product.id);
  const available = product.stock - (cart.find((line) => line.productId === product.id)?.quantity ?? 0);
  async function add() {
    if (adding.current || available < 1) return;
    adding.current = true;
    setPending(true);
    if (!(await delay(400))) return;
    try {
      addToCart(product.id, 1);
      toast({ description: `${product.name}已加入购物车`, tone: "success", shape: "pill", position: "top-center" });
    } catch (error) {
      toast({ description: error instanceof Error ? error.message : "添加失败，请重试。", tone: "danger", position: "top-center" });
    } finally { adding.current = false; setPending(false); }
  }
  return (
    <Card padding="medium" aria-label={product.name}
      footer={<div className="shop-card__actions"><Button size="small" variant="primary" icon={<ShoppingCart />} loading={pending} loadingLabel="加入购物车" disabled={available < 1} onClick={() => void add()}>{product.stock === 0 ? "暂时售罄" : available < 1 ? "已达库存" : "加入购物车"}</Button><IconButton aria-label={`${favorite ? "取消收藏" : "收藏"}${product.name}`} aria-pressed={favorite} icon={<Heart fill={favorite ? "currentColor" : "none"} />} onClick={() => toggleFavorite(product.id)} /></div>}
    >
      <div className="shop-card__content">
        <Media src={product.image} alt={`${product.name}商品展示`} aspectRatio="4 / 3" objectFit="contain" />
        <div className="shop-card__meta"><span className="shop-card__category">{product.category}</span>{product.badge ? <Tag tone={product.badge === "新品" ? "blue" : "neutral"}>{product.badge}</Tag> : null}</div>
        <h3 className="shop-card__title"><Link href={productHref(product.id)} onClick={(event) => { if (onProduct) { event.preventDefault(); onProduct(product.id); } }}>{product.name}</Link></h3>
        <div className="shop-card__description"><OverflowText>{product.description}</OverflowText></div>
        <div className="shop-card__rating"><Star size={15} fill="currentColor" aria-hidden="true" /><span>{product.rating.toFixed(1)} · {product.reviewCount} 条评价</span></div>
        <div className="shop-card__prices"><strong>{formatMoney(product.price)}</strong>{product.comparePrice > product.price ? <del aria-label={`参考价 ${formatMoney(product.comparePrice)}`}>{formatMoney(product.comparePrice)}</del> : null}</div>
      </div>
    </Card>
  );
}

function ShopServiceStrip() {
  const services = [
    { id: "shipping", icon: <Truck size={20} strokeWidth={1.7} />, title: "满 ¥199 包邮", copy: "小件好物，也值得认真送达" },
    { id: "return", icon: <RotateCcw size={20} strokeWidth={1.7} />, title: "7 天无理由退货", copy: "保留完好包装，轻松退换" },
    { id: "quality", icon: <ShieldCheck size={20} strokeWidth={1.7} />, title: "品质保障", copy: "每一件商品，都经过认真挑选" },
    { id: "care", icon: <Headphones size={20} strokeWidth={1.7} />, title: "用心售后", copy: "服务范围，以商品说明为准" },
  ];
  return <div className="shop-services">{services.map((service) => <div className="shop-services__item" key={service.id}><span className="shop-services__icon" aria-hidden="true">{service.icon}</span><div><strong>{service.title}</strong><p>{service.copy}</p></div></div>)}</div>;
}

export function ShopHomePage({ onBrowse, onProduct }: { onBrowse: (category?: string) => void; onProduct: (id: string) => void }) {
  const { products } = useCommerce();
  const categories = Array.from(new Set(products.map((product) => product.category)));
  const hero = products.find((product) => product.id === "p-headphones") ?? products[0];
  const recommendations = [...products].filter((product) => product.stock > 0).sort((left, right) => right.rating - left.rating).slice(0, 4);
  const newProducts = [...products].filter((product) => product.badge === "新品");
  const arrivals = (newProducts.length >= 4 ? newProducts : [...products].reverse()).slice(0, 4);
  const desktop = products.find((product) => product.category === "桌面办公") ?? products[1];
  const travel = products.find((product) => product.category === "出行装备") ?? products[4];
  return (
    <div className="shop-page shop-home">
      <section className="shop-hero" aria-labelledby="shop-home-heading">
        <div className="shop-hero__copy">
          <div className="shop-overline"><Leaf size={17} aria-hidden="true" /><span>青屿 · 日常精选</span></div>
          <h1 id="shop-home-heading">把喜欢的日常，<br />放进生活里。</h1>
          <p>不必很多，刚刚好就好。<br />从桌面的片刻专注，到出发路上的轻松自在。</p>
          <div className="shop-hero__actions"><Button variant="primary" trailingIcon={<ArrowRight />} onClick={() => onBrowse()}>探索全部好物</Button>{hero ? <Button variant="ghost" onClick={() => onProduct(hero.id)}>发现本期精选</Button> : null}</div>
          <div className="shop-hero__promise"><CheckCircle2 size={16} aria-hidden="true" /><span>用得顺手 · 放得好看 · 陪伴更久</span></div>
        </div>
        {hero ? <div className="shop-hero__visual"><Media src={hero.image} alt={`${hero.name}${hero.variants.join("、")}标准款`} aspectRatio="4 / 3" objectFit="contain" /><div className="shop-hero__product"><div><span className="shop-hero__product-label">本期精选</span><strong>{hero.name}</strong><p>{hero.tags.slice(0, 2).join(" · ")}</p></div><div className="shop-hero__product-price"><strong>{formatMoney(hero.price)}</strong><Link href={productHref(hero.id)} trailingIcon={<ArrowRight />} onClick={(event) => { event.preventDefault(); onProduct(hero.id); }}>查看详情</Link></div></div></div> : null}
      </section>

      <ShopServiceStrip />

      <section className="shop-section" aria-labelledby="shop-category-heading">
        <div className="shop-section__heading"><div><span className="shop-overline-text">按场景挑选</span><h2 id="shop-category-heading">日常的每一面，都有好物相伴</h2></div><Link href={catalogHref} trailingIcon={<ArrowRight />} onClick={(event) => { event.preventDefault(); onBrowse(); }}>全部分类</Link></div>
        <div className="shop-category-grid">{categories.map((category) => {
          const product = products.find((item) => item.category === category);
          const copy = categoryCopy[category] ?? { title: category, copy: "为你的每一天，挑选刚刚好的实用好物。" };
          return <Card key={category} padding="small" aria-label={category}><div className="shop-category__content">{product ? <Media src={product.image} alt={`${category}代表商品${product.name}`} aspectRatio="4 / 3" objectFit="contain" /> : null}<div><h3>{category}</h3><p>{copy.title}</p></div><Button variant="ghost" size="small" trailingIcon={<ArrowRight />} onClick={() => onBrowse(category)}>去看看</Button></div></Card>;
        })}</div>
      </section>

      <section className="shop-section" aria-labelledby="shop-popular-heading">
        <div className="shop-section__heading"><div><span className="shop-overline-text">值得反复使用的设计</span><h2 id="shop-popular-heading">大家喜欢的好物</h2></div><Link href={catalogHref} trailingIcon={<ArrowRight />} onClick={(event) => { event.preventDefault(); onBrowse(); }}>查看更多</Link></div>
        <div className="shop-product-grid">{recommendations.map((product) => <ShopMerchandise key={product.id} product={product} onProduct={onProduct} />)}</div>
      </section>

      <div className="shop-stories">
        {desktop ? <section className="shop-story"><div className="shop-story__copy"><span className="shop-overline-text">桌面生活提案</span><h2>整理桌面，<br />也整理一点心情。</h2><p>给工作台留下呼吸的空间，让每一个专注的时刻都更舒服。</p><Button variant="primary" size="small" trailingIcon={<ArrowRight />} onClick={() => onBrowse("桌面办公")}>发现桌面好物</Button></div><div className="shop-story__media"><Media src={desktop.image} alt={desktop.name} aspectRatio="1" objectFit="contain" /></div></section> : null}
        {travel ? <section className="shop-story shop-story--travel"><div className="shop-story__copy"><span className="shop-overline-text">周末出发计划</span><h2>少一点负担，<br />多一点自在。</h2><p>把日常需要的装好，带着喜欢的节奏，去看看不同的风景。</p><Button size="small" trailingIcon={<ArrowRight />} onClick={() => onBrowse("出行装备")}>准备下一次出发</Button></div><div className="shop-story__media"><Media src={travel.image} alt={travel.name} aspectRatio="1" objectFit="contain" /></div></section> : null}
      </div>

      <section className="shop-section" aria-labelledby="shop-arrivals-heading">
        <div className="shop-section__heading"><div><span className="shop-overline-text">新鲜到来</span><h2 id="shop-arrivals-heading">给生活一点新的灵感</h2></div><Link href={catalogHref} trailingIcon={<ArrowRight />} onClick={(event) => { event.preventDefault(); onBrowse(); }}>逛逛新品</Link></div>
        <div className="shop-product-grid">{arrivals.map((product) => <ShopMerchandise key={product.id} product={product} onProduct={onProduct} />)}</div>
      </section>

      <section className="shop-home-note"><span aria-hidden="true"><PackageCheck /></span><div><h2>好物不只是买下的那一刻</h2><p>真正喜欢的，是每一天都用得上的舒适与方便。青屿认真挑选，让简单的日常，多一点值得。</p></div><Button onClick={() => onBrowse()}>开始挑选</Button></section>
    </div>
  );
}

type ShopQuery = { keyword: string; category: string; sort: string; inStock: boolean };

export function ShopCatalogPage({ initialCategory = "all", initialSearch = "", favoritesOnly = false, onProduct }: {
  initialCategory?: string; initialSearch?: string; favoritesOnly?: boolean; onProduct: (id: string) => void;
}) {
  const { products, favorites } = useCommerce();
  const { delay, cancel } = useShopRequest();
  const requestId = useRef(0);
  const pending = useRef(false);
  const safeInitialCategory = products.some((product) => product.category === initialCategory) ? initialCategory : "all";
  const initial: ShopQuery = { category: safeInitialCategory, keyword: initialSearch, sort: "recommended", inStock: false };
  const [draft, setDraft] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const [querying, setQuerying] = useState(false);
  const categories = Array.from(new Set(products.map((product) => product.category)));
  useEffect(() => {
    requestId.current += 1;
    cancel();
    pending.current = false;
    setQuerying(false);
    const next = { category: safeInitialCategory, keyword: initialSearch, sort: "recommended", inStock: false };
    setDraft(next); setApplied(next);
  }, [safeInitialCategory, initialSearch, favoritesOnly, cancel]);
  const filtered = products.filter((product) => (
    (!favoritesOnly || favorites.includes(product.id))
    && (applied.category === "all" || applied.category === product.category)
    && (!applied.inStock || product.stock > 0)
    && `${product.name} ${product.description} ${product.tags.join(" ")}`.toLocaleLowerCase().includes(applied.keyword.toLocaleLowerCase())
  ));
  const results = [...filtered].sort((left, right) => applied.sort === "price-low" ? left.price - right.price
    : applied.sort === "price-high" ? right.price - left.price
      : applied.sort === "rating" ? right.rating - left.rating : 0);
  async function apply(next: ShopQuery) {
    if (pending.current) return;
    pending.current = true;
    const token = ++requestId.current;
    const snapshot = { ...next, keyword: next.keyword.trim() };
    setQuerying(true);
    if (!(await delay(600)) || token !== requestId.current) return;
    setApplied(snapshot);
    pending.current = false;
    setQuerying(false);
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void apply(draft); }
  function clear() {
    const next = { keyword: "", category: "all", sort: "recommended", inStock: false };
    setDraft(next); void apply(next);
  }
  return (
    <div className="shop-page shop-catalog">
      <Breadcrumbs items={[{ id: "home", label: "首页", href: "#/examples" }, { id: "catalog", label: favoritesOnly ? "我的收藏" : "全部好物" }]} />
      <header className="shop-catalog__heading"><div><span className="shop-overline-text">{favoritesOnly ? "留给喜欢的好物" : "认真挑选，轻松使用"}</span><h1>{favoritesOnly ? "我的收藏" : applied.category === "all" ? "全部好物" : applied.category}</h1><p>{favoritesOnly ? "那些想再看一眼的设计，都替你留在这里。" : categoryCopy[applied.category]?.copy ?? "为桌面、出行和日常生活，找到刚刚好的陪伴。"}</p></div><Tag tone="blue">{products.length} 件精选好物</Tag></header>
      <div className="shop-catalog__filters">
        <FilterBar ariaLabel="商品搜索与筛选" onSubmit={submit}
          actions={<Inline><Button type="submit" size="field" variant="primary" loading={querying} loadingLabel="搜索">搜索</Button><Button size="field" variant="ghost" disabled={querying} onClick={clear}>重置</Button></Inline>}
          activeFilters={<Inline>{applied.keyword ? <Tag tone="blue">{`关键词：${applied.keyword}`}</Tag> : null}{applied.category !== "all" ? <Tag>{applied.category}</Tag> : null}{applied.inStock ? <Tag tone="success">仅看有货</Tag> : null}</Inline>}
        >
          <SearchInput aria-label="搜索好物" placeholder="商品名称、用途或关键词" value={draft.keyword} onChange={(event) => { const keyword = event.currentTarget.value; setDraft((current) => ({ ...current, keyword })); }} onClear={() => setDraft((current) => ({ ...current, keyword: "" }))} />
          <Select ariaLabel="商品分类" value={draft.category} options={[{ value: "all", label: "全部分类" }, ...categories.map((category) => ({ value: category, label: category }))]} onValueChange={(category) => setDraft((current) => ({ ...current, category }))} />
          <Select ariaLabel="商品排序" value={draft.sort} options={sortOptions} onValueChange={(sort) => setDraft((current) => ({ ...current, sort }))} />
          <Checkbox label="仅看有货" checked={draft.inStock} onChange={(event) => { const inStock = event.currentTarget.checked; setDraft((current) => ({ ...current, inStock })); }} />
        </FilterBar>
      </div>
      <div className="shop-catalog__result-heading"><p role="status">{querying ? "正在查找，保留当前商品…" : `找到 ${results.length} 件${favoritesOnly ? "收藏" : ""}好物`}</p><span>{sortOptions.find((option) => option.value === applied.sort)?.label}</span></div>
      <section className="shop-catalog__results" aria-label={favoritesOnly ? "收藏商品" : "商品列表"} aria-busy={querying}>
        {results.length ? <div className="shop-product-grid">{results.map((product) => <ShopMerchandise key={product.id} product={product} onProduct={onProduct} />)}</div> : <EmptyState icon={favoritesOnly ? <Heart /> : <ShoppingBag />} title={favoritesOnly && !favorites.length ? "还没有收藏好物" : "暂时没有找到相关商品"} description={favoritesOnly && !favorites.length ? "浏览商品时点击爱心，将喜欢的设计留在这里。" : "换一个关键词，或试试其他分类。"} action={favoritesOnly && !favorites.length ? <Link href={catalogHref} trailingIcon={<ArrowRight />}>去逛逛好物</Link> : <Button loading={querying} loadingLabel="清除筛选" onClick={clear}>清除筛选</Button>} />}
      </section>
      <div className="shop-catalog__end"><Leaf size={16} aria-hidden="true" /><p>{results.length ? "每一件，都是为日常认真挑选。" : "喜欢的好物，也许就在下一次发现里。"}</p></div>
      <ShopServiceStrip />
    </div>
  );
}

export function ShopProductPage({ productId, onBrowse, onCart }: { productId: string; onBrowse: () => void; onCart: () => void }) {
  const { products } = useCommerce();
  const product = products.find((item) => item.id === productId);
  if (!product) return <div className="shop-page"><EmptyState title="这件商品暂时找不到了" description="返回商品列表，看看其他值得喜欢的好物。" action={<Button variant="primary" onClick={onBrowse}>返回全部好物</Button>} /></div>;
  return <ShopProductContent key={productId} product={product} onBrowse={onBrowse} onCart={onCart} />;
}

function ShopProductContent({ product, onBrowse, onCart }: { product: Product; onBrowse: () => void; onCart: () => void }) {
  const { favorites, toggleFavorite, cart, addToCart, products } = useCommerce();
  const { toast } = useToast();
  const { delay } = useShopRequest();
  const id = useId();
  const addPending = useRef(false);
  const [quantity, setQuantity] = useState<number | "">(1);
  const [pending, setPending] = useState(false);
  const [addError, setAddError] = useState("");
  const [selectedImage, setSelectedImage] = useState(`${product.id}-0`);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const favorite = favorites.includes(product.id);
  const inCart = cart.find((line) => line.productId === product.id)?.quantity ?? 0;
  const available = product.stock - inCart;
  const imageItems = product.images.map((src, index) => ({ id: `${product.id}-${index}`, src, alt: `${product.name}${index ? "补充展示图" : "商品展示图"}`, caption: index ? "补充展示" : "商品展示" }));
  const currentImage = imageItems.find((item) => item.id === selectedImage) ?? imageItems[0];
  const related = products.filter((item) => item.category === product.category && item.id !== product.id).slice(0, 4);
  const quantityValid = typeof quantity === "number" && Number.isInteger(quantity) && quantity >= 1 && quantity <= available;
  async function add() {
    if (addPending.current || !quantityValid || typeof quantity !== "number") return;
    addPending.current = true; setPending(true); setAddError("");
    const count = quantity;
    if (!(await delay(500))) return;
    try {
      addToCart(product.id, count);
      toast({ description: `已将 ${count} 件${product.name}加入购物车`, tone: "success", shape: "pill", position: "top-center" });
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "暂时无法添加，请重试。");
    } finally { addPending.current = false; setPending(false); }
  }
  const descriptionContent = <div className="shop-product__description-content"><section className="shop-product__story"><div><span className="shop-overline-text">{categoryCopy[product.category]?.title ?? "认真对待日常"}</span><h2>每一次使用，<br />都是刚刚好的体验。</h2><p>{product.description}</p><div className="shop-product__feature-list">{product.tags.map((feature) => <div key={feature}><CheckCircle2 size={17} aria-hidden="true" /><span>{feature}</span></div>)}</div></div>{product.images[1] ? <Media src={product.images[1]} alt={`${product.name}补充展示`} aspectRatio="4 / 3" objectFit="contain" /> : null}</section><div className="shop-product__detail-points">{product.specs.filter((spec) => spec.label !== "服务").map((spec) => <Card key={spec.label} padding="medium"><span className="shop-overline-text">{spec.label}</span><h3>{spec.value}</h3><p className="shop-muted">在每个普通的日常，为你提供稳定、实用的体验。</p></Card>)}</div></div>;
  const specificationContent = <div className="shop-product__tab-content"><DescriptionList columns={2} items={[{ id: "brand", term: "品牌", description: "青屿" }, { id: "category", term: "商品分类", description: product.category }, { id: "variant", term: "商品规格", description: product.variants.join("、") }, ...product.specs.map((spec, index) => ({ id: `spec-${index}`, term: spec.label, description: spec.value }))]} /><p className="shop-muted">图片为商品展示图，颜色可能因显示设备有所差异，请以商品规格为准。</p></div>;
  const reviewContent = <div className="shop-product__tab-content"><div className="shop-review-summary"><strong>{product.rating.toFixed(1)}</strong><div><Rating ariaLabel={`${product.name}平均评分`} value={Math.round(product.rating)} onValueChange={() => undefined} readOnly /><p>{product.reviewCount} 条商品评价</p></div></div><div className="shop-review-list">{product.reviews.map((review) => <Card key={review.id} padding="medium"><Stack><Inline justify="between"><strong>{review.name}</strong><span className="shop-muted">{review.date}</span></Inline><Rating ariaLabel={`${review.name}评分`} value={review.rating} onValueChange={() => undefined} readOnly /><p className="shop-review-copy">{review.content}</p><Tag>规格：{product.variants.join("、")}</Tag></Stack></Card>)}</div></div>;

  return (
    <div className="shop-page shop-product">
      <Breadcrumbs items={[{ id: "home", label: "首页", href: "#/examples" }, { id: "catalog", label: "全部好物", onClick: onBrowse }, { id: "category", label: product.category, href: `${catalogHref}?category=${encodeURIComponent(product.category)}` }, { id: "current", label: product.name }]} />
      <div className="shop-product__overview">
        <div className="shop-product__gallery">
          {currentImage ? <Media src={currentImage.src} alt={currentImage.alt} aspectRatio="4 / 3" objectFit="contain" /> : null}
          <div className="shop-product__zoom"><span className="shop-muted">{imageItems.findIndex((item) => item.id === currentImage?.id) + 1} / {imageItems.length} · 点击下方缩略图切换</span><Button variant="ghost" size="small" icon={<Maximize2 />} disabled={!imageItems.length} onClick={() => setLightboxOpen(true)}>放大查看</Button></div>
          <Gallery ariaLabel={`${product.name}商品缩略图`} columns={2} aspectRatio="4 / 3" items={imageItems} selectedId={selectedImage} onSelect={(item) => setSelectedImage(item.id)} />
        </div>
        <div className="shop-product__purchase">
          <Inline><Tag>{product.category}</Tag>{product.badge ? <Tag tone="blue">{product.badge}</Tag> : null}</Inline>
          <h1>{product.name}</h1>
          <p className="shop-product__lede">{product.description}</p>
          <div className="shop-product__rating"><Star size={15} fill="currentColor" aria-hidden="true" /><strong>{product.rating.toFixed(1)}</strong><span className="shop-muted">来自 {product.reviewCount} 条商品评价</span></div>
          <div className="shop-product__price-block"><div className="shop-product__price"><strong>{formatMoney(product.price)}</strong>{product.comparePrice > product.price ? <del>{formatMoney(product.comparePrice)}</del> : null}</div><p>{product.comparePrice > product.price ? `比参考价优惠 ${formatMoney(product.comparePrice - product.price)} · ` : ""}满 ¥199 包邮</p></div>
          <DescriptionList divided={false} items={[{ id: "variant", term: "规格", description: <Tag selected tone="blue">{product.variants.join("、")}</Tag> }, { id: "stock", term: "库存", description: product.stock ? <span>{product.stock} 件可售{inCart ? ` · 购物车已有 ${inCart} 件` : ""}</span> : <Tag>暂时售罄</Tag> }]} />
          <div className="shop-product__quantity"><Field label="数量" htmlFor={`${id}-quantity`} hint={available > 0 ? `还可添加 ${available} 件` : product.stock > 0 ? "购物车数量已达可售库存" : "到货后可继续购买"}><NumberInput id={`${id}-quantity`} ariaLabel="购买数量" value={quantity} onValueChange={(value) => { setQuantity(value); setAddError(""); }} min={1} max={Math.max(1, available)} step={1} disabled={available < 1 || pending} /></Field></div>
          {addError ? <Alert tone="danger">{addError}</Alert> : null}
          <div className="shop-product__buy-actions"><Button variant="primary" icon={<ShoppingCart />} loading={pending} loadingLabel="加入购物车" disabled={!quantityValid} onClick={() => void add()}>{product.stock === 0 ? "暂时售罄" : available < 1 ? "已达库存" : "加入购物车"}</Button><Button icon={<ShoppingBag />} onClick={onCart}>去购物车</Button><IconButton aria-label={`${favorite ? "取消收藏" : "收藏"}${product.name}`} aria-pressed={favorite} icon={<Heart fill={favorite ? "currentColor" : "none"} />} onClick={() => toggleFavorite(product.id)} /></div>
          <div className="shop-product__assurances"><span><Truck size={16} aria-hidden="true" />满 ¥199 包邮</span><span><RotateCcw size={16} aria-hidden="true" />7 天无理由退货</span><span><ShieldCheck size={16} aria-hidden="true" />品质售后保障</span></div>
          <Accordion ariaLabel="配送与售后说明" type="single" items={[{ id: "delivery", title: "配送说明", content: <p>青屿订单统一配送。商品合计满 ¥199 免配送费；未达到免运费门槛时，最终费用以结算页为准。可在订单详情中查看收货地址与配送状态。</p> }, { id: "return", title: "退换货与售后", content: <p>签收后 7 天内可申请无理由退货，请保持商品、配件与包装完好。商品服务范围以规格参数中的服务说明为准；遇到产品问题，请保留订单与购买凭证，方便后续核实。</p> }]} />
        </div>
      </div>
      <section className="shop-product__details" aria-label="商品详细信息"><Tabs defaultValue="description" ariaLabel="商品信息" items={[{ id: "description", label: "商品详情", content: descriptionContent }, { id: "specifications", label: "规格参数", content: specificationContent }, { id: "reviews", label: `商品评价（${product.reviewCount}）`, content: reviewContent }]} /></section>
      {related.length ? <section className="shop-section" aria-labelledby="shop-related-heading"><div className="shop-section__heading"><div><span className="shop-overline-text">也许你还会喜欢</span><h2 id="shop-related-heading">同一份日常，不同的好搭档</h2></div><Link href={`${catalogHref}?category=${encodeURIComponent(product.category)}`} trailingIcon={<ArrowRight />}>更多{product.category}</Link></div><div className="shop-product-grid">{related.map((item) => <ShopMerchandise key={item.id} product={item} />)}</div></section> : null}
      <ShopServiceStrip />
      <Lightbox open={lightboxOpen} onOpenChange={setLightboxOpen} items={imageItems} value={selectedImage} onValueChange={setSelectedImage} />
    </div>
  );
}
