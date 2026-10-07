import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  Download,
  Search,
  Upload,
  Warehouse,
} from "lucide-react";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { OptionManager } from "./components/OptionManager";
import { OrderRow } from "./components/OrderRow";
import { OrderHistoryHeader } from "./components/OrderHistoryHeader";
import { ProductForm } from "./components/ProductForm";
import { ProductList } from "./components/ProductList";
import { SalesBasket, type BasketLine } from "./components/SalesBasket";
import type { VoiceProductPrefill } from "./components/VoiceOrderAssistant";
import { downloadBackup, readBackup } from "./services/backup";
import {
  inventoryDb,
  type Product,
  type ProductOption,
  type ProductOptionType,
  type SalesOrder,
} from "./services/database";
import "./App.css";

type Tab = "Home" | "Products" | "Inventory" | "Sales";
const currency = (amount: number) => `Rs. ${amount.toFixed(2)}`;
const OrderReceipt = lazy(() => import("./components/OrderReceipt").then(module => ({ default: module.OrderReceipt })));
const OnlyOrdersPage = lazy(() => import("./components/OnlyOrdersPage").then(module => ({ default: module.OnlyOrdersPage })));

function App() {
  const [tab, setTab] = useState<Tab>("Home");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [backupStatus, setBackupStatus] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product>();
  const [selectedProduct, setSelectedProduct] = useState<Product>();
  const [currentPage, setCurrentPage] = useState(1);
  const [editingOrder, setEditingOrder] = useState<SalesOrder>();
  const [saleLines, setSaleLines] = useState<BasketLine[]>([]);
  const [showSalesBasket, setShowSalesBasket] = useState(false);
  const [addingProductForOrder, setAddingProductForOrder] = useState(false);
  const [newProductPrefill, setNewProductPrefill] = useState<VoiceProductPrefill>();
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [viewingOrder, setViewingOrder] = useState<SalesOrder>();
  const [salesMode, setSalesMode] = useState<'inventory' | 'only'>('inventory');
  const [requestedOptionType, setRequestedOptionType] =
    useState<ProductOptionType>();
  const [addedOption, setAddedOption] = useState<{
    type: ProductOptionType;
    name: string;
  }>();
  const importInput = useRef<HTMLInputElement>(null);
  const products =
    useLiveQuery(
      () => inventoryDb.products.orderBy("updatedAt").reverse().toArray(),
      [],
    ) ?? [];

  const orders =
    useLiveQuery(
      () => inventoryDb.orders.orderBy("soldAt").reverse().toArray(),
      [],
    ) ?? [];
  const orderItems =
    useLiveQuery(() => inventoryDb.orderItems.toArray(), []) ?? [];
  const productOptions =
    useLiveQuery(
      async () =>
        (await inventoryDb.productOptions.toArray()).sort((first, second) =>
          first.name.localeCompare(second.name),
        ),
      [],
    ) ?? [];

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab, selectedProduct]);
  useEffect(() => {
    setCurrentPage(1);
  }, [search, category]);
  const lowStock = products.filter(
    (product) => product.quantity <= product.lowStockAt,
  );
  const inventoryValue = products.reduce(
    (total, product) => total + (product.price ?? 0) * product.quantity,
    0,
  );
  const today = new Date().toDateString();
  const todayOrders = orders.filter(
    (order) => new Date(order.soldAt).toDateString() === today,
  );
  const monthSales = orders
    .filter((order) => {
      const date = new Date(order.soldAt);
      const now = new Date();
      return (
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    })
    .reduce((sum, order) => sum + order.totalAmount, 0);
  const todaySales = todayOrders.reduce(
    (sum, order) => sum + order.totalAmount,
    0,
  );
  const unitsSoldToday = orderItems
    .filter((item) =>
      orders.some(
        (order) =>
          order.id === item.orderId &&
          new Date(order.soldAt).toDateString() === today,
      ),
    )
    .reduce((sum, item) => sum + item.quantitySold, 0);
  const normalizedSearch = search.trim().toLowerCase();
  const shownProducts = products.filter(
    (product) =>
      (category === "All" ||
        category === "All categories" ||
        product.category === category) &&
      [
        product.name,
        product.brand,
        product.category,
        product.unit,
        product.packageType,
        product.sellingPrice?.toString(),
        `${product.measurementValue ?? ""} ${product.unit}`.trim(),
      ].some((value) => value?.toLowerCase().includes(normalizedSearch)),
  );
  const optionNames = (type: ProductOptionType) =>
    [
      ...new Set([
        ...productOptions
          .filter((option) => option.type === type)
          .map((option) => option.name),
        ...products
          .map((product) =>
            type === "category"
              ? product.category
              : type === "brand"
                ? product.brand
                : type === "measurementUnit"
                  ? product.unit
                  : product.packageType,
          )
          .filter((value): value is string => Boolean(value)),
      ]),
    ].sort();
  const categories = optionNames("category");
  const brands = optionNames("brand");
  const measurementUnits = optionNames("measurementUnit");
  const packageTypes = optionNames("packageType");
  const pageCount = Math.max(1, Math.ceil(shownProducts.length / 12));
  const pagedProducts = shownProducts.slice(
    (currentPage - 1) * 12,
    currentPage * 12,
  );

  async function saveProduct(
    values: Omit<Product, "id" | "createdAt" | "updatedAt">,
  ) {
    const timestamp = new Date().toISOString();
    const normalize = (value?: string) => value?.trim().toLowerCase() ?? "";
    const duplicate = products.find(
      (product) =>
        product.id !== editingProduct?.id &&
        normalize(product.name) === normalize(values.name) &&
        normalize(product.brand) === normalize(values.brand) &&
        normalize(product.category) === normalize(values.category) &&
        product.measurementValue === values.measurementValue &&
        normalize(product.unit) === normalize(values.unit) &&
        normalize(product.packageType) === normalize(values.packageType) &&
        normalize(product.expiryDate) === normalize(values.expiryDate) &&
        product.price === values.price &&
        product.sellingPrice === values.sellingPrice,
    );
    if (duplicate) {
      const supplier = values.supplier?.trim() ?? "";
      const batchNumber = values.batchNumber?.trim() ?? "";
      const existingLots = duplicate.stockLots ?? [];
      const lotIndex = existingLots.findIndex(
        (lot) =>
          normalize(lot.supplier) === normalize(supplier) &&
          normalize(lot.batchNumber) === normalize(batchNumber),
      );
      const nextLot = {
        id: lotIndex >= 0 ? existingLots[lotIndex].id : crypto.randomUUID(),
        supplier,
        batchNumber,
        expiryDate: values.expiryDate,
        quantity: values.quantity,
        updatedAt: timestamp,
      };
      const stockLots =
        lotIndex >= 0
          ? existingLots.map((lot, index) => (index === lotIndex ? nextLot : lot))
          : [...existingLots, nextLot];
      await inventoryDb.products.update(duplicate.id, {
        quantity: values.quantity,
        taxPercent: values.taxPercent,
        supplier,
        batchNumber,
        stockLots,
        imageDataUrl: values.imageDataUrl || duplicate.imageDataUrl,
        updatedAt: timestamp,
      });
      window.alert(
        "Matching product found. Stock, GST, and supplier-batch information were updated on the existing catalog product.",
      );
      if (addingProductForOrder) {
        setSaleLines((lines) =>
          lines.some((line) => line.productId === duplicate.id)
            ? lines
            : [
                ...lines,
                {
                  productId: duplicate.id,
                  quantity: 1,
                  price: values.sellingPrice ?? values.price ?? 0,
                },
              ],
        );
        setAddingProductForOrder(false);
        setNewProductPrefill(undefined);
        setTab("Sales");
        setShowSalesBasket(true);
      }
      return true;
    }
    if (editingProduct) {
      await inventoryDb.products.update(editingProduct.id, {
        ...values,
        updatedAt: timestamp,
      });
      setEditingProduct(undefined);
    } else {
      const productId = crypto.randomUUID();
      await inventoryDb.products.add({
        ...values,
        stockLots:
          values.supplier || values.batchNumber
            ? [
                {
                  id: crypto.randomUUID(),
                  supplier: values.supplier?.trim() ?? "",
                  batchNumber: values.batchNumber?.trim() ?? "",
                  expiryDate: values.expiryDate,
                  quantity: values.quantity,
                  updatedAt: timestamp,
                },
              ]
            : [],
        id: productId,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      if (addingProductForOrder) {
        setSaleLines((lines) => [
          ...lines,
          {
            productId,
            quantity: 1,
            price: values.sellingPrice ?? values.price ?? 0,
          },
        ]);
        setAddingProductForOrder(false);
        setNewProductPrefill(undefined);
        setTab("Sales");
      }
    }
    return true;
  }

  function addProductFromOrder(prefill?: VoiceProductPrefill) {
    setEditingProduct(undefined);
    setNewProductPrefill(prefill);
    setAddingProductForOrder(true);
    setShowSalesBasket(true);
    setTab("Inventory");
  }

  function returnToOrder() {
    setAddingProductForOrder(false);
    setNewProductPrefill(undefined);
    setTab("Sales");
    setShowSalesBasket(true);
  }
  async function removeProduct(product: Product) {
    const salesCount = await inventoryDb.orderItems
      .where("productId")
      .equals(product.id)
      .count();
    if (salesCount > 0) {
      window.alert(
        "This product has sales history and cannot be deleted. Edit it instead so past orders remain accurate.",
      );
      return;
    }
    if (window.confirm(`Delete ${product.name}?`))
      await inventoryDb.products.delete(product.id);
  }
  async function addOption(type: ProductOptionType, name: string) {
    if (
      !productOptions.some(
        (option) =>
          option.type === type &&
          option.name.toLowerCase() === name.toLowerCase(),
      )
    )
      await inventoryDb.productOptions.add({
        id: crypto.randomUUID(),
        type,
        name,
        createdAt: new Date().toISOString(),
      });
  }
  function productUsesOption(product: Product, option: ProductOption) {
    return option.type === "category"
      ? product.category === option.name
      : option.type === "brand"
        ? product.brand === option.name
        : option.type === "measurementUnit"
          ? product.unit === option.name
          : product.packageType === option.name;
  }
  async function renameOption(option: ProductOption) {
    const name = window.prompt(`Rename ${option.name}`, option.name)?.trim();
    if (
      !name ||
      name === option.name ||
      productOptions.some(
        (item) =>
          item.type === option.type &&
          item.name.toLowerCase() === name.toLowerCase(),
      )
    )
      return;
    await inventoryDb.transaction(
      "rw",
      inventoryDb.productOptions,
      inventoryDb.products,
      async () => {
        await inventoryDb.productOptions.update(option.id, { name });
        const affected = products.filter((product) =>
          productUsesOption(product, option),
        );
        await inventoryDb.products.bulkPut(
          affected.map((product) => ({
            ...product,
            ...(option.type === "category"
              ? { category: name }
              : option.type === "brand"
                ? { brand: name }
                : option.type === "measurementUnit"
                  ? { unit: name }
                  : { packageType: name }),
            updatedAt: new Date().toISOString(),
          })),
        );
      },
    );
  }
  async function deleteOption(option: ProductOption) {
    if (products.some((product) => productUsesOption(product, option)))
      return window.alert(
        `Move products away from ${option.name} before deleting it.`,
      );
    if (window.confirm(`Delete ${option.name}?`))
      await inventoryDb.productOptions.delete(option.id);
  }
  function openCatalog() {
    setSelectedProduct(undefined);
    setTab("Products");
  }
  function openProduct(product: Product) {
    setSelectedProduct(product);
    setTab("Products");
  }
  async function importBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = await readBackup(file);
      await inventoryDb.transaction(
        "rw",
        inventoryDb.products,
        inventoryDb.productOptions,
        inventoryDb.orders,
        inventoryDb.orderItems,
        inventoryDb.onlyOrders,
        async () => {
          await inventoryDb.products.bulkPut(imported.products);
          await inventoryDb.productOptions.bulkPut(imported.productOptions);
          await inventoryDb.orders.bulkPut(imported.orders);
          await inventoryDb.orderItems.bulkPut(imported.orderItems);
          await inventoryDb.onlyOrders.bulkPut(imported.onlyOrders);
        },
      );
      setBackupStatus(`Imported ${imported.products.length} products and ${imported.onlyOrders.length} Only Order records.`);
    } catch (error) {
      setBackupStatus(
        error instanceof Error ? error.message : "Could not import backup.",
      );
    } finally {
      event.target.value = "";
    }
  }
  function addSaleLine(productId: string, quantity = 1) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    const wholeQuantity = Math.max(1, Math.trunc(quantity));
    setSaleLines((lines) =>
      lines.some((line) => line.productId === productId)
        ? lines.map((line) =>
            line.productId === productId
              ? { ...line, quantity: wholeQuantity }
              : line,
          )
        : [
            ...lines,
            {
              productId,
              quantity: wholeQuantity,
              price: product.sellingPrice ?? product.price ?? 0,
            },
          ],
    );
  }
  async function submitSale() {
    if (!saleLines.length) return;
    const selected = saleLines
      .map((line) => ({
        line,
        product: products.find((product) => product.id === line.productId),
      }))
      .filter((entry): entry is { line: BasketLine; product: Product } =>
        Boolean(entry.product),
      );
    const originalItems = editingOrder
      ? await inventoryDb.orderItems
          .where("orderId")
          .equals(editingOrder.id)
          .toArray()
      : [];
    const restoredStock = originalItems.reduce<Record<string, number>>(
      (stock, item) => ({
        ...stock,
        [item.productId]: (stock[item.productId] ?? 0) + item.quantitySold,
      }),
      {},
    );
    if (
      selected.some(
        ({ line, product }) =>
          line.quantity <= 0 ||
          !Number.isInteger(line.quantity) ||
          line.quantity > product.quantity + (restoredStock[product.id] ?? 0),
      )
    )
      return window.alert(
        "Check quantities. A sale cannot exceed available stock.",
      );
    const timestamp = new Date().toISOString();
    const orderId = editingOrder?.id ?? crypto.randomUUID();
    const totalAmount = selected.reduce(
      (sum, { line }) => sum + line.quantity * line.price,
      0,
    );
      const nextOrderSequence = editingOrder
        ? 0
        : (await inventoryDb.orders.toArray()).reduce((highest, order) => {
            const sequence = Number(order.orderNumber.match(/(\d+)$/)?.[1] ?? 0);
            return Math.max(highest, sequence);
          }, 0) + 1;
    await inventoryDb.transaction(
      "rw",
      inventoryDb.products,
      inventoryDb.orders,
      inventoryDb.orderItems,
      async () => {
        for (const item of originalItems) {
          const product = await inventoryDb.products.get(item.productId);
          if (product)
            await inventoryDb.products.update(product.id, {
              quantity: Math.max(
                0,
                Math.round(product.quantity + item.quantitySold),
              ),
              updatedAt: timestamp,
            });
        }
        if (editingOrder) {
          await inventoryDb.orderItems
            .where("orderId")
            .equals(orderId)
            .delete();
          await inventoryDb.orders.update(orderId, {
            totalAmount,
            updatedAt: timestamp,
          });
        } else {
            await inventoryDb.orders.add({
              id: orderId,
              orderNumber: `SMKG-${String(nextOrderSequence).padStart(6, "0")}`,
              soldAt: timestamp,
              totalAmount,
              createdAt: timestamp,
              updatedAt: timestamp,
            });
        }
        await inventoryDb.orderItems.bulkAdd(
          selected.map(({ line, product }) => ({
            id: crypto.randomUUID(),
            orderId,
            productId: product.id,
            productName: product.name,
            measurementValue: originalItems.find(item => item.productId === product.id)?.measurementValue ?? product.measurementValue,
            unit: originalItems.find(item => item.productId === product.id)?.unit ?? product.unit,
            category: product.category,
            quantitySold: line.quantity,
            unitCost: product.price ?? 0,
            unitSellingPrice: line.price,
            lineTotal: line.quantity * line.price,
          })),
        );
        for (const { line, product } of selected)
          await inventoryDb.products.update(product.id, {
            quantity: Math.max(
              0,
              Math.round(product.quantity - line.quantity),
            ),
            updatedAt: timestamp,
          });
      },
    );
    setSaleLines([]);
    setEditingOrder(undefined);
    setShowSalesBasket(false);
    setViewingOrder(await inventoryDb.orders.get(orderId));
  }
  async function editOrder(order: SalesOrder) {
    const items = await inventoryDb.orderItems
      .where("orderId")
      .equals(order.id)
      .toArray();
    setEditingOrder(order);
    setSaleLines(
      items.map((item) => ({
        productId: item.productId,
        quantity: item.quantitySold,
        price: item.unitSellingPrice,
      })),
    );
    setShowSalesBasket(true);
  }
  async function deleteSelectedOrders() {
    const selectedOrders = orders.filter((order) =>
      selectedOrderIds.includes(order.id),
    );
    if (!selectedOrders.length) return;
    if (
      !window.confirm(
        `Delete ${selectedOrders.length} selected order${selectedOrders.length === 1 ? "" : "s"} and restore their stock?`,
      )
    )
      return;
    await inventoryDb.transaction(
      "rw",
      inventoryDb.products,
      inventoryDb.orders,
      inventoryDb.orderItems,
      async () => {
        for (const order of selectedOrders) {
          const items = await inventoryDb.orderItems
            .where("orderId")
            .equals(order.id)
            .toArray();
          for (const item of items) {
            const product = await inventoryDb.products.get(item.productId);
            if (product)
              await inventoryDb.products.update(product.id, {
                quantity: Math.max(
                  0,
                  Math.round(product.quantity + item.quantitySold),
                ),
                updatedAt: new Date().toISOString(),
              });
          }
          await inventoryDb.orderItems
            .where("orderId")
            .equals(order.id)
            .delete();
          await inventoryDb.orders.delete(order.id);
        }
      },
    );
    setSelectedOrderIds([]);
  }
  function toggleOrderSelection(orderId: string) {
    setSelectedOrderIds((selected) =>
      selected.includes(orderId)
        ? selected.filter((id) => id !== orderId)
        : [...selected, orderId],
    );
  }
  const setLine = (
    productId: string,
    field: "quantity" | "price",
    value: number,
  ) =>
    setSaleLines((lines) =>
      lines.map((line) =>
        line.productId === productId ? { ...line, [field]: value } : line,
      ),
    );
  const topItem = orderItems.reduce<Record<string, number>>(
    (counts, item) => ({
      ...counts,
      [item.productName]: (counts[item.productName] ?? 0) + item.quantitySold,
    }),
    {},
  );
  const mostSold =
    Object.entries(topItem).sort(
      (first, second) => second[1] - first[1],
    )[0]?.[0] ?? "No sales yet";
  const soldCounts = orderItems.reduce<Record<string, number>>(
    (counts, item) => ({
      ...counts,
      [item.productId]: (counts[item.productId] ?? 0) + item.quantitySold,
    }),
    {},
  );
  const nextOrderNumber = `SMKG-${String(
    orders.reduce((highest, order) => {
      const sequence = Number(order.orderNumber.match(/(\d+)$/)?.[1] ?? 0);
      return Math.max(highest, sequence);
    }, 0) + 1,
  ).padStart(6, "0")}`;
  const viewingOrderItems = viewingOrder
    ? orderItems.filter((item) => item.orderId === viewingOrder.id)
    : [];
  const viewingOrderUnits = viewingOrderItems.reduce(
    (sum, item) => sum + item.quantitySold,
    0,
  );

  function closeSalesBasket() {
    if (editingOrder) {
      setEditingOrder(undefined);
      setSaleLines([]);
    }
    setShowSalesBasket(false);
  }
  function discardSalesBasket() {
    setEditingOrder(undefined);
    setSaleLines([]);
    setShowSalesBasket(false);
  }
  const detailProduct = selectedProduct
    ? products.find((product) => product.id === selectedProduct.id)
    : undefined;
  const detailItems = detailProduct
    ? orderItems.filter((item) => item.productId === detailProduct.id)
    : [];
  const detailUnitsSold = detailItems.reduce(
    (sum, item) => sum + item.quantitySold,
    0,
  );
  const detailSales = detailItems.reduce(
    (sum, item) => sum + item.lineTotal,
    0,
  );
  const detailProfit = detailItems.reduce(
    (sum, item) =>
      sum +
      item.lineTotal -
      item.quantitySold * (item.unitCost ?? detailProduct?.price ?? 0),
    0,
  );
  const detailOrders = orders.filter((order) =>
    detailItems.some((item) => item.orderId === order.id),
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <Warehouse size={22} /> SMKG{" "}
          <small>Sri Mareswari Kinena General Stores</small>
        </div>
        <OfflineIndicator isOnline={isOnline} />
      </header>
      <nav className="tabs">
        {(["Home", "Products", "Inventory", "Sales"] as Tab[]).map((item) => (
          <button
            className={tab === item ? "active" : ""}
            onClick={() => {
              setTab(item);
              setSalesMode('inventory');
              setEditingProduct(undefined);
              setSelectedProduct(undefined);
              setAddingProductForOrder(false);
              setNewProductPrefill(undefined);
              setShowSalesBasket(false);
              if (editingOrder) {
                setEditingOrder(undefined);
                setSaleLines([]);
              }
              setSelectedOrderIds([]);
              setViewingOrder(undefined);
            }}
            key={item}
          >
            {item}
          </button>
        ))}
      </nav>
      {tab === "Home" && (
        <section>
          <header className="page-heading">
            <div>
              <p className="eyebrow">Today at SMKG</p>
              <h1>Dashboard</h1>
            </div>
          </header>
          <section className="metrics home-metrics">
            <div>
              <span>Total products</span>
              <strong>{products.length}</strong>
              <button onClick={() => setTab("Products")}>View catalog</button>
            </div>
            <div>
              <span>Units sold today</span>
              <strong>{unitsSoldToday}</strong>
            </div>
            <div>
              <span>Sales today</span>
              <strong>{currency(todaySales)}</strong>
            </div>
            <div>
              <span>Sales this month</span>
              <strong>{currency(monthSales)}</strong>
            </div>
          </section>
          <section className="dashboard-grid">
            <div className="panel">
              <h2>Products needing attention</h2>
              {lowStock.length ? (
                <div className="attention-table" role="table">
                  <div className="attention-header" role="row">
                    <span>Product name</span>
                    <span>Type</span>
                    <span>Brand</span>
                    <span>In stock</span>
                  </div>
                  {lowStock.map((product) => (
                    <button
                      className="attention-row"
                      type="button"
                      onClick={() => openProduct(product)}
                      key={product.id}
                    >
                      <strong>{product.name}</strong>
                      <span>
                        {product.measurementValue} {product.unit}
                      </span>
                      <span>{product.brand || "Unbranded"}</span>
                      <span>
                        {new Intl.NumberFormat("en-IN", {
                          maximumFractionDigits: 3,
                        }).format(product.quantity)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted">No low-stock products.</p>
              )}
            </div>
            <div className="panel">
              <h2>Sales snapshot</h2>
              <p>
                Orders today<span>{todayOrders.length}</span>
              </p>
              <p>
                Most sold<span>{mostSold}</span>
              </p>
              <p>
                Inventory value<span>{currency(inventoryValue)}</span>
              </p>
            </div>
          </section>
        </section>
      )}
      {tab === "Products" && (
        <section>
          {detailProduct ? (
            <>
              <header className="page-heading detail-heading">
                <div>
                  <button
                    className="back-button"
                    onClick={() => setSelectedProduct(undefined)}
                  >
                    Back to catalog
                  </button>
                  <p className="eyebrow">
                    {detailProduct.brand || "Unbranded"} ·{" "}
                    {detailProduct.category}
                  </p>
                  <h1>{detailProduct.name}</h1>
                  <p>
                    {detailProduct.measurementValue ?? ""} {detailProduct.unit}{" "}
                    · {detailProduct.packageType || "Item"}
                  </p>
                </div>
                {detailProduct.imageDataUrl && (
                  <img
                    className="product-detail-image"
                    src={detailProduct.imageDataUrl}
                    alt={detailProduct.name}
                  />
                )}
                <button
                  className="primary-button"
                  onClick={() => {
                    setEditingProduct(detailProduct);
                    setTab("Inventory");
                  }}
                >
                  Edit product
                </button>
              </header>
              <section className="metrics product-detail-metrics">
                <div>
                  <span>Units in stock</span>
                  <strong
                    className={
                      detailProduct.quantity <= detailProduct.lowStockAt
                        ? "low-stock"
                        : ""
                    }
                  >
                    {new Intl.NumberFormat("en-IN", {
                      maximumFractionDigits: 3,
                    }).format(detailProduct.quantity)}
                  </strong>
                </div>
                <div>
                  <span>Selling price (MRP)</span>
                  <strong>{currency(detailProduct.sellingPrice ?? 0)}</strong>
                </div>
                <div>
                  <span>Unit cost</span>
                  <strong>{currency(detailProduct.price ?? 0)}</strong>
                </div>
                <div>
                  <span>Profit margin</span>
                  <strong>{detailProduct.profitMarginPercent ?? 0}%</strong>
                </div>
              </section>
              <section className="dashboard-grid">
                <div className="panel">
                  <h2>Product performance</h2>
                  <p>
                    Units sold<span>{detailUnitsSold}</span>
                  </p>
                  <p>
                    Total sales<span>{currency(detailSales)}</span>
                  </p>
                  <p>
                    Profit<span>{currency(detailProfit)}</span>
                  </p>
                  <p>
                    Low-stock alert<span>{detailProduct.lowStockAt}</span>
                  </p>
                </div>
                <div className="panel">
                  <h2>Order history</h2>
                  {detailOrders.length ? (
                    detailOrders.map((order) => (
                      <p key={order.id}>
                        {order.orderNumber}
                        <span>
                          {new Date(order.soldAt).toLocaleDateString()} ·{" "}
                          {currency(order.totalAmount)}
                        </span>
                      </p>
                    ))
                  ) : (
                    <p className="muted">This product has not been sold yet.</p>
                  )}
                </div>
                <div className="panel product-lots">
                  <h2>Supplier & batch lots</h2>
                  {detailProduct.stockLots?.length ? (
                    detailProduct.stockLots.map((lot) => (
                      <p key={lot.id}>
                        <span>
                          <strong>{lot.supplier || "Supplier not set"}</strong>
                          <small>Batch {lot.batchNumber || "not set"}</small>
                        </span>
                        <span>
                          {new Intl.NumberFormat("en-IN", {
                            maximumFractionDigits: 3,
                          }).format(lot.quantity)}
                          {lot.expiryDate ? ` · expires ${lot.expiryDate}` : ""}
                        </span>
                      </p>
                    ))
                  ) : (
                    <p className="muted">No supplier-batch lots recorded.</p>
                  )}
                </div>
              </section>
            </>
          ) : (
            <>
              <header className="page-heading">
                <div>
                  <p className="eyebrow">Product catalog</p>
                  <h1>Products</h1>
                </div>
                <span className="result-count">
                  {shownProducts.length} results
                </span>
              </header>
              <div className="panel">
                <div className="catalog-tools">
                  <label>
                    <Search size={17} />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search name, brand, MRP, size, category, unit"
                    />
                  </label>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                  >
                    <option>All categories</option>
                    {categories.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </div>
                <ProductList
                  products={pagedProducts}
                  onView={setSelectedProduct}
                  onDelete={removeProduct}
                  onEdit={(product) => {
                    setEditingProduct(product);
                    setTab("Inventory");
                  }}
                />
                <nav className="pagination" aria-label="Product pages">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((page) => page - 1)}
                  >
                    Previous
                  </button>
                  {Array.from({ length: pageCount }, (_, index) => (
                    <button
                      className={currentPage === index + 1 ? "active" : ""}
                      onClick={() => setCurrentPage(index + 1)}
                      key={index + 1}
                    >
                      {index + 1}
                    </button>
                  ))}
                  <button
                    disabled={currentPage === pageCount}
                    onClick={() => setCurrentPage((page) => page + 1)}
                  >
                    Next
                  </button>
                </nav>
              </div>
            </>
          )}
        </section>
      )}
      {tab === "Inventory" && (
        <section>
          <header className="page-heading">
            <div>
              <p className="eyebrow">Stockroom management</p>
              <h1>Inventory</h1>
            </div>
          </header>
          <section className="metrics">
            <div>
              <span>Total products</span>
              <strong>{products.length}</strong>
            </div>
            <div>
              <span>Need attention</span>
              <strong className="low-stock">{lowStock.length}</strong>
            </div>
            <div>
              <span>Inventory value</span>
              <strong>{currency(inventoryValue)}</strong>
            </div>
          </section>
          <section className="backup-bar">
            <div>
              <strong>Device backup</strong>
              <span>
                {backupStatus ||
                  "Export a copy regularly to keep outside the browser."}
              </span>
            </div>
            <div className="backup-actions">
              <button onClick={() => downloadBackup(products)}>
                <Download size={16} />
                Export
              </button>
              <button onClick={() => importInput.current?.click()}>
                <Upload size={16} />
                Import
              </button>
              <input
                ref={importInput}
                type="file"
                accept="application/json"
                onChange={importBackup}
                hidden
              />
            </div>
          </section>
          <button
            className="catalog-handoff"
            type="button"
            onClick={openCatalog}
          >
            <Search size={18} />
            <span>
              <strong>Search stock in Product catalog</strong>
              <small>
                Find products by name, brand, category, or measurement unit
              </small>
            </span>
          </button>
          <section className="inventory-layout">
            <OptionManager
              options={productOptions}
              requestedType={requestedOptionType}
              onAdd={addOption}
              onAdded={(type, name) => {
                setAddedOption({ type, name });
                setRequestedOptionType(undefined);
              }}
              onRename={renameOption}
              onDelete={deleteOption}
            />
            <aside className="form-panel">
              {addingProductForOrder && (
                <div className="order-return-banner">
                  <span>
                    <strong>Add a product for this order</strong>
                    <small>Your current order is saved as a draft.</small>
                  </span>
                  <button type="button" onClick={returnToOrder}>
                    <ArrowLeft size={15} /> Return to order
                  </button>
                </div>
              )}
              <ProductForm
                product={editingProduct}
                categories={categories}
                brands={brands}
                measurementUnits={measurementUnits}
                packageTypes={packageTypes}
                addedOption={addedOption}
                initialValues={newProductPrefill}
                onRequestOption={(type) => {
                  setRequestedOptionType(type);
                  setAddedOption(undefined);
                }}
                onSave={saveProduct}
                onCancel={() => setEditingProduct(undefined)}
              />
            </aside>
          </section>
        </section>
      )}
      {tab === "Sales" && (
        salesMode === 'only' ? (
          <Suspense fallback={<p role="status">Loading orders...</p>}>
            <OnlyOrdersPage onBack={() => setSalesMode('inventory')} />
          </Suspense>
        ) : showSalesBasket ? (
          <SalesBasket
            products={products}
            categories={categories}
            lines={saleLines}
            orderNumber={editingOrder?.orderNumber ?? nextOrderNumber}
            isEditing={Boolean(editingOrder)}
            soldCounts={soldCounts}
            onAdd={addSaleLine}
            onChange={setLine}
            onRemove={(productId) =>
              setSaleLines((lines) =>
                lines.filter((line) => line.productId !== productId),
              )
            }
            onAddNewProduct={addProductFromOrder}
            onCancel={closeSalesBasket}
            onDiscard={discardSalesBasket}
            onSubmit={submitSale}
          />
        ) : viewingOrder ? (
          <section className="order-detail-page">
            <header className="page-heading detail-heading">
              <div>
                <button
                  className="back-button"
                  onClick={() => setViewingOrder(undefined)}
                >
                  <ArrowLeft size={15} /> Back to orders
                </button>
                <p className="eyebrow">Order details</p>
                <h1>{viewingOrder.orderNumber}</h1>
                <p>{new Date(viewingOrder.soldAt).toLocaleString()}</p>
              </div>
              <button
                className="primary-button"
                onClick={() => {
                  setViewingOrder(undefined);
                  void editOrder(viewingOrder);
                }}
              >
                Edit order
              </button>
            </header>
            <section className="metrics">
              <div>
                <span>Products</span>
                <strong>{viewingOrderItems.length}</strong>
              </div>
              <div>
                <span>Units sold</span>
                <strong>{viewingOrderUnits}</strong>
              </div>
              <div>
                <span>Order amount</span>
                <strong>{currency(viewingOrder.totalAmount)}</strong>
              </div>
            </section>
            <section className="panel order-detail-items">
              <div className="order-detail-header">
                <span>Product</span>
                <span>Qty</span>
                <span>Price</span>
                <span>Total</span>
              </div>
              {viewingOrderItems.map((item) => (
                <div className="order-detail-row" key={item.id}>
                  <span>
                    <strong>{item.productName}</strong>
                    <small>{item.category}</small>
                  </span>
                  <span>{item.quantitySold}</span>
                  <span>{item.unitSellingPrice.toFixed(2)}</span>
                  <strong>{item.lineTotal.toFixed(2)}</strong>
                </div>
              ))}
            </section>
            <Suspense fallback={<p role="status">Loading receipt...</p>}>
              <OrderReceipt key={viewingOrder.id + viewingOrder.updatedAt} order={viewingOrder} items={viewingOrderItems.map(item => {
                const product = products.find(product => product.id === item.productId);
                return item.unit !== undefined ? item : { ...item, measurementValue: item.measurementValue ?? product?.measurementValue, unit: product?.unit };
              })} />
            </Suspense>
          </section>
        ) : (
        <section>
          <header className="page-heading">
            <div>
              <p className="eyebrow">Point of sale</p>
              <h1>Orders</h1>
            </div>
          </header>
          <section className="metrics">
            <div>
              <span>Orders</span>
              <strong>{orders.length}</strong>
            </div>
            <div>
              <span>Average order</span>
              <strong>
                {currency(
                  orders.length
                    ? orders.reduce(
                        (sum, order) => sum + order.totalAmount,
                        0,
                      ) / orders.length
                    : 0,
                )}
              </strong>
            </div>
            <div>
              <span>Most sold</span>
              <strong className="metric-text">{mostSold}</strong>
            </div>
          </section>
          <section className="orders-layout">
            <div className="panel">
              <OrderHistoryHeader mode="inventory" onSelectMode={mode => { setSalesMode(mode); setSelectedOrderIds([]); }} onNewOrder={() => setShowSalesBasket(true)} newOrderLabel={saleLines.length ? `Continue order (${saleLines.length})` : "New order"} />
              {!selectedOrderIds.length && orders.length > 0 && (
                <p className="selection-hint">
                  Tap an order for details · Long press to select
                </p>
              )}
              {orders.length ? (
                <div
                  className={`orders-table ${selectedOrderIds.length ? "selection-mode" : ""}`}
                >
                  <div className="orders-table-header">
                    {selectedOrderIds.length > 0 && (
                      <input
                        type="checkbox"
                        aria-label="Select all orders"
                        checked={selectedOrderIds.length === orders.length}
                        onChange={(event) =>
                          setSelectedOrderIds(
                            event.target.checked
                              ? orders.map((order) => order.id)
                              : [],
                          )
                        }
                      />
                    )}
                    <span>Order number</span>
                    <span>Amount</span>
                  </div>
                  {orders.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    selectionMode={selectedOrderIds.length > 0}
                    selected={selectedOrderIds.includes(order.id)}
                    onOpen={setViewingOrder}
                    onSelect={toggleOrderSelection}
                  />
                  ))}
                  {selectedOrderIds.length > 0 && (
                    <div className="selected-order-actions">
                      <span>
                        {selectedOrderIds.length} order
                        {selectedOrderIds.length === 1 ? "" : "s"} selected
                      </span>
                      <div>
                        {selectedOrderIds.length === 1 && (
                          <button
                            className="edit-selected-order"
                            onClick={() => {
                              const order = orders.find(
                                (item) => item.id === selectedOrderIds[0],
                              );
                              if (order) {
                                setSelectedOrderIds([]);
                                void editOrder(order);
                              }
                            }}
                          >
                            Edit
                          </button>
                        )}
                        <button
                          className="delete-selected-orders"
                          onClick={deleteSelectedOrders}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="muted">Orders will appear here.</p>
              )}
            </div>
          </section>
        </section>
        )
      )}
    </main>
  );
}
export default App;
