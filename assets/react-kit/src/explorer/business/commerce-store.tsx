import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  description: string;
  image: string;
  images: string[];
  specs: { label: string; value: string }[];
  variants: string[];
  comparePrice: number;
  rating: number;
  reviewCount: number;
  badge?: string;
  tags: string[];
  reviews: { id: string; name: string; rating: number; content: string; date: string }[];
}
export interface CartLine { productId: string; quantity: number }
export type OrderStatus = "pending" | "paid" | "shipped" | "completed" | "cancelled";
export interface Order {
  id: string;
  createdAt: string;
  status: OrderStatus;
  customer: string;
  address: string;
  items: { productId: string; name: string; price: number; quantity: number; image: string }[];
  total: number;
  subtotal: number;
  shipping: number;
  discount: number;
  couponCode: string;
  receiver: string;
  phone: string;
  note: string;
  shippingMethod: "standard" | "express";
  events: { id: string; title: string; time: string }[];
}
export interface Address { id: string; name: string; phone: string; address: string; isDefault: boolean }
export interface Account { id: string; name: string; email: string }
interface CommerceState { products: Product[]; cart: CartLine[]; orders: Order[]; customerName: string; favorites: string[]; addresses: Address[]; account: Account | null }
interface OrderOptions { couponCode?: string; receiver?: string; phone?: string; note?: string; shippingMethod?: "standard" | "express" }
interface CommerceStore extends CommerceState {
  addToCart: (productId: string, quantity: number) => void;
  setCartQuantity: (productId: string, quantity: number) => void;
  placeOrder: (address: string, options?: OrderOptions) => Order;
  payOrder: (id: string) => void;
  cancelOrder: (id: string) => void;
  shipOrder: (id: string) => void;
  completeOrder: (id: string) => void;
  reset: () => void;
  setCustomerName: (name: string) => void;
  toggleFavorite: (productId: string) => void;
  saveAddress: (address: Omit<Address, "id"> & { id?: string }) => void;
  removeAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;
  signIn: (email: string, password: string) => void;
  registerAccount: (name: string, email: string, password: string) => void;
  signOut: () => void;
}

const shapes = [
  '<path d="M106 132v-30a54 54 0 0 1 108 0v30" fill="none" stroke="COLOR" stroke-width="18"/><rect x="91" y="110" width="35" height="66" rx="16" fill="COLOR"/><rect x="194" y="110" width="35" height="66" rx="16" fill="COLOR"/>',
  '<rect x="69" y="90" width="182" height="92" rx="16" fill="COLOR"/><path d="M89 115h142M89 139h142M105 163h108" stroke="white" stroke-opacity=".65" stroke-width="8" stroke-linecap="round"/>',
  '<path d="M145 88h30l38 54H107z" fill="COLOR"/><path d="M160 142v49" stroke="COLOR" stroke-width="10"/><ellipse cx="160" cy="193" rx="42" ry="9" fill="COLOR"/>',
  '<rect x="114" y="60" width="92" height="146" rx="24" fill="COLOR"/><circle cx="160" cy="115" r="22" fill="white" fill-opacity=".3"/><circle cx="160" cy="172" r="16" fill="white" fill-opacity=".4"/>',
  '<path d="M134 70v-8a26 26 0 0 1 52 0v8" fill="none" stroke="COLOR" stroke-width="9"/><rect x="104" y="66" width="112" height="138" rx="29" fill="COLOR"/><rect x="124" y="132" width="72" height="51" rx="12" fill="white" fill-opacity=".3"/>',
  '<rect x="146" y="37" width="28" height="187" rx="14" fill="COLOR"/><rect x="117" y="88" width="86" height="92" rx="25" fill="COLOR" stroke="white" stroke-width="4"/><circle cx="160" cy="132" r="27" fill="white" fill-opacity=".3"/><path d="M160 114v18l14 9" stroke="white" stroke-width="5" fill="none" stroke-linecap="round"/>',
  '<rect x="111" y="71" width="98" height="129" rx="17" fill="COLOR"/><rect x="119" y="59" width="82" height="20" rx="8" fill="COLOR"/><path d="M141 58v-9h38v9" fill="none" stroke="COLOR" stroke-width="8"/><path d="M125 133h70" stroke="white" stroke-opacity=".35" stroke-width="8"/>',
  '<path d="M91 90h129l-9 111H102z" fill="COLOR"/><path d="M220 110h14a26 26 0 0 1 0 52h-18" fill="none" stroke="COLOR" stroke-width="12"/><path d="M117 115h68" stroke="white" stroke-opacity=".4" stroke-width="9" stroke-linecap="round"/>',
  '<rect x="82" y="76" width="157" height="122" rx="12" fill="COLOR"/><path d="M103 78v120M117 111h91M117 134h65" stroke="white" stroke-opacity=".4" stroke-width="5"/><path d="m215 63 7 7-60 90-12 5 2-13z" fill="#c69763"/>',
  '<path d="M95 141h135l-8 61H102z" fill="COLOR"/><rect x="112" y="74" width="37" height="69" rx="3" fill="#91a4ba"/><rect x="154" y="102" width="48" height="41" rx="3" fill="#c9bca8"/><path d="M103 170h119" stroke="white" stroke-opacity=".4" stroke-width="6"/>',
  '<rect x="107" y="56" width="105" height="149" rx="18" fill="COLOR"/><circle cx="160" cy="119" r="26" fill="white" fill-opacity=".3"/><path d="M140 168h40" stroke="white" stroke-width="6" stroke-linecap="round"/>',
  '<rect x="77" y="87" width="165" height="97" rx="22" fill="COLOR"/><path d="M97 132h125" stroke="white" stroke-opacity=".3" stroke-width="5"/><path d="M94 101h31" stroke="white" stroke-opacity=".5" stroke-width="5"/>',
];
function productMedia(index: number, alternate = false): string {
  const backgrounds = ["#eef2f8", "#eef2f0", "#f5eee5", "#eef1f6"];
  const colors = ["#355d8a", "#546b62", "#aa835c", "#5e6c80"];
  const background = alternate ? "#e9eef5" : backgrounds[index % 4];
  const color = alternate ? "#7b8ea6" : colors[index % 4];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 320 240"><defs><radialGradient id="shadow"><stop stop-color="#506078" stop-opacity=".25"/><stop offset="1" stop-color="#506078" stop-opacity="0"/></radialGradient><linearGradient id="light" x2="0" y2="1"><stop stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect width="320" height="240" fill="${background}"/><path d="M0 185h320v55H0z" fill="#fff" fill-opacity=".22"/><ellipse cx="160" cy="211" rx="92" ry="13" fill="url(#shadow)"/><g transform="${alternate ? "translate(25 2) rotate(9 160 130)" : "translate(0 0)"}">${shapes[index].split("COLOR").join(color)}</g><rect width="320" height="240" fill="url(#light)"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
function initialState(): CommerceState {
  const descriptions = [
    ["p-headphones", "云感无线耳机", "数码配件", 399, 18, "轻盈佩戴，主动降噪。让通勤、办公与音乐之间切换得更从容。", "续航", "32 小时"],
    ["p-keyboard", "轻触机械键盘", "桌面办公", 289, 24, "紧凑的桌面搭档，舒适敲击手感，支持双设备无线连接。", "连接", "蓝牙 / USB-C"],
    ["p-lamp", "暮光桌面灯", "居家生活", 179, 12, "柔和无频闪灯光，三档色温，给阅读与工作一盏刚刚好的光。", "色温", "3000 / 4000 / 5000 K"],
    ["p-speaker", "随行蓝牙音箱", "数码配件", 229, 9, "清晰人声与饱满低音，随手放进背包，让喜欢的音乐陪你出发。", "防护", "IPX5 防水"],
    ["p-bag", "城市通勤背包", "出行装备", 259, 15, "分区收纳日常物品，轻量防泼水面料，适合工作日与周末短途。", "容量", "18 L / 14 英寸电脑仓"],
    ["p-watch", "日常运动手表", "数码配件", 499, 0, "记录运动与睡眠，清晰查看通知。当前售罄，可浏览详情。", "续航", "约 10 天"],
    ["p-bottle", "轻行保温杯", "出行装备", 129, 36, "轻量不锈钢杯身，锁住温度也锁住日常的一点从容。", "容量", "420 mL / 316 不锈钢"],
    ["p-cup", "日光陶瓷杯", "居家生活", 89, 28, "细腻釉面与舒适杯柄，陪你喝完早晨的咖啡和傍晚的茶。", "容量", "350 mL / 可用洗碗机"],
    ["p-notebook", "纸间笔记套装", "桌面办公", 69, 40, "厚实纸张搭配自然握感签字笔，给想法留出一个安静的角落。", "规格", "A5 / 160 页 / 含签字笔"],
    ["p-organizer", "桌面收纳盒", "桌面办公", 99, 22, "分区整理小物，不用寻找就能让桌面保持清爽。", "尺寸", "24 × 16 × 12 cm"],
    ["p-power", "随身充电宝", "数码配件", 159, 17, "20W 双向快充与轻薄机身，让出行途中的电量更加安心。", "电量", "10000 mAh / 支持 PD 快充"],
    ["p-pouch", "旅途收纳包", "出行装备", 79, 25, "收好充电器、耳机与证件，放进背包就能开始下一段旅程。", "面料", "防泼水再生尼龙"],
  ] as const;
  const products: Product[] = descriptions.map((row, index) => ({
    id: row[0], name: row[1], category: row[2], price: row[3], stock: row[4], description: row[5],
    image: productMedia(index), images: [productMedia(index), productMedia(index, true)],
    specs: [{ label: row[6], value: row[7] }, { label: "服务", value: "7 天无理由退货 · 1 年保修" }],
    variants: [index % 4 === 2 ? "暖砂" : index % 4 === 1 ? "雾绿" : "雾蓝"],
    comparePrice: row[3] + (index % 2 ? 30 : 60), rating: 4.7, reviewCount: 3,
    badge: index < 2 ? "本周精选" : index >= 6 ? "新品" : undefined,
    tags: ["原创设计", index % 2 ? "轻量便携" : "日常实用"],
    reviews: [
      { id: `${row[0]}-r1`, name: "林小夏", rating: 5, content: "实物的颜色很耐看，用了一段时间，细节和手感都很满意。", date: "2026-10-10" },
      { id: `${row[0]}-r2`, name: "顾小满", rating: 5, content: "包装简单，东西实用，配送也很及时。是会经常用到的日常好物。", date: "2026-10-08" },
      { id: `${row[0]}-r3`, name: "陈沐", rating: 4, content: "整体符合预期，规格写得清楚，放在家里和工作时都很方便。", date: "2026-10-06" },
    ],
  }));
  const states: OrderStatus[] = ["pending", "paid", "shipped", "completed", "cancelled", "completed", "paid", "shipped"];
  const orders: Order[] = states.map((status, index) => {
    const product = products[index % 5];
    return { id: `QY202610${String(13001 - index).padStart(5, "0")}`, createdAt: `2026-10-${String(13 - index).padStart(2, "0")}T10:30:00+08:00`, status,
      customer: "林小夏", address: "上海市徐汇区青屿路 18 号 2 层",
      items: [{ productId: product.id, name: product.name, price: product.price, quantity: 1, image: product.image }],
      ...calculateTotals(product.price), receiver: "陈沐", phone: "13800138000", note: "", shippingMethod: "standard", events: [
        { id: "created", title: "订单已创建", time: `2026-10-${String(13 - index).padStart(2, "0")}T10:30:00+08:00` },
        ...(status !== "pending" && status !== "cancelled" ? [{ id: "paid", title: "付款成功，等待打包", time: `2026-10-${String(13 - index).padStart(2, "0")}T10:35:00+08:00` }] : []),
        ...(status === "shipped" || status === "completed" ? [{ id: "shipped", title: "已交付快递，正在运输", time: `2026-10-${String(13 - index).padStart(2, "0")}T14:00:00+08:00` }] : []),
        ...(status === "completed" ? [{ id: "completed", title: "已签收，订单完成", time: `2026-10-${String(14 - index).padStart(2, "0")}T12:00:00+08:00` }] : []),
        ...(status === "cancelled" ? [{ id: "cancelled", title: "订单已取消", time: `2026-10-${String(13 - index).padStart(2, "0")}T10:40:00+08:00` }] : []),
      ] };
  });
  return { products, cart: [], orders, customerName: "陈沐", favorites: [], account: null, addresses: [
    { id: "address-home", name: "陈沐", phone: "13800138000", address: "上海市徐汇区青屿路 18 号 2 层", isDefault: true },
    { id: "address-office", name: "陈沐", phone: "13800138000", address: "上海市静安区清和路 88 号 6 层", isDefault: false },
  ] };
}
export function calculateTotals(subtotal: number, couponCode = "", shippingMethod: "standard" | "express" = "standard") {
  const code = couponCode.trim().toUpperCase();
  const discount = code === "QINGYU20" && subtotal >= 199 ? 20 : 0;
  const shipping = subtotal === 0 ? 0 : shippingMethod === "express" ? 20 : subtotal >= 199 ? 0 : 10;
  return { subtotal, shipping, discount, total: Math.max(0, subtotal - discount + shipping), couponCode: discount ? code : "" };
}
export function formatMoney(value: number): string {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" }).format(value);
}
const CommerceContext = createContext<CommerceStore | null>(null);
export function CommerceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialState);
  const stateRef = useRef(state);
  const counter = useRef(0);
  const accounts = useRef([{ id: "account-demo", name: "林小夏", email: "demo@qingyu.example", password: "Qingyu2026!" }]);
  const deliveryTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const commit = (next: CommerceState) => { stateRef.current = next; setState(next); };
  const changeQuantity = (productId: string, quantity: number, add: boolean) => {
    const current = stateRef.current;
    const product = current.products.find((item) => item.id === productId);
    if (!product || !Number.isInteger(quantity) || quantity < 0) throw new Error("请输入有效的商品数量。");
    const existing = current.cart.find((line) => line.productId === productId)?.quantity ?? 0;
    const nextQuantity = add ? existing + quantity : quantity;
    if (nextQuantity > product.stock) throw new Error(`库存仅剩 ${product.stock} 件，请调整数量。`);
    const cart = nextQuantity === 0
      ? current.cart.filter((line) => line.productId !== productId)
      : existing
        ? current.cart.map((line) => line.productId === productId ? { ...line, quantity: nextQuantity } : line)
        : [...current.cart, { productId, quantity: nextQuantity }];
    commit({ ...current, cart });
  };
  const transition = (id: string, from: OrderStatus[], to: OrderStatus) => {
    const current = stateRef.current;
    const order = current.orders.find((item) => item.id === id);
    if (!order || !from.includes(order.status)) throw new Error("订单状态已变化，请确认后重试。");
    const products = to === "cancelled" ? current.products.map((product) => {
      const quantity = order.items.filter((item) => item.productId === product.id).reduce((sum, item) => sum + item.quantity, 0);
      return { ...product, stock: product.stock + quantity };
    }) : current.products;
    const eventTitle = { paid: "付款成功，等待打包", shipped: "已交付快递，正在运输", completed: "已签收，订单完成", cancelled: "订单已取消，预留库存已释放", pending: "订单已创建" };
    commit({ ...current, products, orders: current.orders.map((item) => item.id === id ? { ...item, status: to, events: [...item.events, { id: to, title: eventTitle[to], time: new Date().toISOString() }] } : item) });
  };
  useEffect(() => () => { deliveryTimers.current.forEach(clearTimeout); deliveryTimers.current.clear(); }, []);
  useEffect(() => {
    for (const order of state.orders) {
      if (order.status !== "paid" || deliveryTimers.current.has(order.id)) continue;
      const timer = setTimeout(() => {
        deliveryTimers.current.delete(order.id);
        if (stateRef.current.orders.find((current) => current.id === order.id)?.status === "paid") transition(order.id, ["paid"], "shipped");
      }, 4000);
      deliveryTimers.current.set(order.id, timer);
    }
  }, [state.orders]);
  const store: CommerceStore = {
    ...state,
    addToCart: (id, quantity) => changeQuantity(id, quantity, true),
    setCartQuantity: (id, quantity) => changeQuantity(id, quantity, false),
    placeOrder: (address, options = {}) => {
      const current = stateRef.current;
      if (!current.cart.length || !address.trim()) throw new Error("请添加商品并填写收货地址。");
      const items = current.cart.map((line) => {
        const product = current.products.find((item) => item.id === line.productId);
        if (!product || line.quantity > product.stock) throw new Error("商品库存发生变化，请重新确认购物车。");
        return { productId: product.id, name: product.name, price: product.price, quantity: line.quantity, image: product.image };
      });
      counter.current += 1;
      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const createdAt = new Date().toISOString();
      const order: Order = { id: `QY${Date.now()}${counter.current}`, createdAt, status: "pending", customer: current.customerName, address: address.trim(), items,
        ...calculateTotals(subtotal, options.couponCode, options.shippingMethod), receiver: options.receiver?.trim() || current.customerName,
        phone: options.phone?.trim() || "13800138000", note: options.note?.trim() || "", shippingMethod: options.shippingMethod ?? "standard", events: [{ id: "created", title: "订单已创建", time: createdAt }] };
      commit({ ...current, products: current.products.map((product) => ({ ...product, stock: product.stock - (current.cart.find((line) => line.productId === product.id)?.quantity ?? 0) })), cart: [], orders: [order, ...current.orders] });
      return order;
    },
    payOrder: (id) => transition(id, ["pending"], "paid"),
    cancelOrder: (id) => transition(id, ["pending"], "cancelled"),
    shipOrder: (id) => transition(id, ["paid"], "shipped"),
    completeOrder: (id) => transition(id, ["shipped"], "completed"),
    reset: () => { deliveryTimers.current.forEach(clearTimeout); deliveryTimers.current.clear(); accounts.current = [{ id: "account-demo", name: "林小夏", email: "demo@qingyu.example", password: "Qingyu2026!" }]; counter.current = 0; commit(initialState()); },
    setCustomerName: (name) => commit({ ...stateRef.current, customerName: name.trim() || "陈沐" }),
    toggleFavorite: (id) => {
      const current = stateRef.current;
      if (!current.products.some((product) => product.id === id)) return;
      commit({ ...current, favorites: current.favorites.includes(id) ? current.favorites.filter((value) => value !== id) : [...current.favorites, id] });
    },
    saveAddress: (address) => {
      const current = stateRef.current;
      const phone = address.phone.replace(/[\s()-]/g, "");
      if (!address.name.trim() || !/^\+?\d{7,15}$/.test(phone) || address.address.trim().length < 8) throw new Error("请填写姓名、有效联系电话和完整收货地址。");
      const id = address.id ?? `address-${Date.now()}-${++counter.current}`;
      if (address.id && !current.addresses.some((value) => value.id === address.id)) throw new Error("该地址已不存在，请重新添加。");
      const saved: Address = { ...address, id, phone, name: address.name.trim(), address: address.address.trim(), isDefault: address.isDefault || current.addresses.length === 0 };
      const addresses = current.addresses.some((value) => value.id === id) ? current.addresses.map((value) => value.id === id ? saved : value) : [...current.addresses, saved];
      const normalized = addresses.map((value) => saved.isDefault && value.id !== id ? { ...value, isDefault: false } : value);
      if (normalized.length && !normalized.some((value) => value.isDefault)) normalized[0] = { ...normalized[0], isDefault: true };
      commit({ ...current, addresses: normalized });
    },
    removeAddress: (id) => {
      const current = stateRef.current;
      const addresses = current.addresses.filter((value) => value.id !== id);
      if (addresses.length && !addresses.some((value) => value.isDefault)) addresses[0] = { ...addresses[0], isDefault: true };
      commit({ ...current, addresses });
    },
    setDefaultAddress: (id) => {
      const current = stateRef.current;
      if (current.addresses.some((value) => value.id === id)) commit({ ...current, addresses: current.addresses.map((value) => ({ ...value, isDefault: value.id === id })) });
    },
    signIn: (email, password) => {
      const found = accounts.current.find((value) => value.email === email.trim().toLowerCase() && value.password === password);
      if (!found) throw new Error("邮箱或密码不匹配，请检查后重试。");
      const { id, name, email: accountEmail } = found;
      commit({ ...stateRef.current, account: { id, name, email: accountEmail }, customerName: name });
    },
    registerAccount: (name, email, password) => {
      const cleanEmail = email.trim().toLowerCase();
      if (accounts.current.some((value) => value.email === cleanEmail)) throw new Error("此邮箱已注册，请直接登录。");
      if (name.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(cleanEmail) || !/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password)) throw new Error("请检查姓名、邮箱和密码格式。");
      accounts.current.push({ id: `account-${++counter.current}`, name: name.trim(), email: cleanEmail, password });
    },
    signOut: () => commit({ ...stateRef.current, account: null, customerName: "陈沐" }),
  };
  return <CommerceContext.Provider value={store}>{children}</CommerceContext.Provider>;
}
export function useCommerce(): CommerceStore {
  const store = useContext(CommerceContext);
  if (!store) throw new Error("Business examples require CommerceProvider.");
  return store;
}
