import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  Download,
  Plus,
  Search,
  ShoppingCart,
  Upload,
  Warehouse,
} from "lucide-react";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { OptionManager } from "./components/OptionManager";
import { ProductForm } from "./components/ProductForm";
import { ProductList } from "./components/ProductList";
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
type SaleLine = { productId: string; quantity: number; price: number };
const currency = (amount: number) => `Rs. ${amount.toFixed(2)}`;

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
  const [saleLines, setSaleLines] = useState<SaleLine[]>([]);
  const [addingProductForOrder, setAddingProductForOrder] = useState(false);
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
        setTab("Sales");
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
        setTab("Sales");
      }
    }
    return true;
  }

  function addProductFromOrder() {
    setEditingProduct(undefined);
    setAddingProductForOrder(true);
    setTab("Inventory");
  }

  function returnToOrder() {
    setAddingProductForOrder(false);
    setTab("Sales");
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
        async () => {
          await inventoryDb.products.bulkPut(imported.products);
          await inventoryDb.productOptions.bulkPut(imported.productOptions);
          await inventoryDb.orders.bulkPut(imported.orders);
          await inventoryDb.orderItems.bulkPut(imported.orderItems);
        },
      );
      setBackupStatus(`Imported ${imported.products.length} products.`);
    } catch (error) {
      setBackupStatus(
        error instanceof Error ? error.message : "Could not import backup.",
      );
    } finally {
      event.target.value = "";
    }
  }
  function addSaleLine(productId: string) {
    const product = products.find((item) => item.id === productId);
    if (product && !saleLines.some((line) => line.productId === productId))
      setSaleLines([
        ...saleLines,
        {
          productId,
          quantity: 1,
          price: product.sellingPrice ?? product.price ?? 0,
        },
      ]);
  }
  async function submitSale() {
    if (!saleLines.length) return;
    const selected = saleLines
      .map((line) => ({
        line,
        product: products.find((product) => product.id === line.productId),
      }))
      .filter((entry): entry is { line: SaleLine; product: Product } =>
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
              quantity: product.quantity + item.quantitySold,
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
            category: product.category,
            quantitySold: line.quantity,
            unitCost: product.price ?? 0,
            unitSellingPrice: line.price,
            lineTotal: line.quantity * line.price,
          })),
        );
        for (const { line, product } of selected)
          await inventoryDb.products.update(product.id, {
            quantity: product.quantity - line.quantity,
            updatedAt: timestamp,
          });
      },
    );
    setSaleLines([]);
    setEditingOrder(undefined);
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
  }
  async function deleteOrder(order: SalesOrder) {
    if (!window.confirm(`Delete ${order.orderNumber} and restore its stock?`))
      return;
    const items = await inventoryDb.orderItems
      .where("orderId")
      .equals(order.id)
      .toArray();
    await inventoryDb.transaction(
      "rw",
      inventoryDb.products,
      inventoryDb.orders,
      inventoryDb.orderItems,
      async () => {
        for (const item of items) {
          const product = await inventoryDb.products.get(item.productId);
          if (product)
            await inventoryDb.products.update(product.id, {
              quantity: product.quantity + item.quantitySold,
              updatedAt: new Date().toISOString(),
            });
        }
        await inventoryDb.orderItems.where("orderId").equals(order.id).delete();
        await inventoryDb.orders.delete(order.id);
      },
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
  const salesTotal = saleLines.reduce(
    (sum, line) => sum + line.quantity * line.price,
    0,
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
              setEditingProduct(undefined);
              setSelectedProduct(undefined);
                setAddingProductForOrder(false);
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
                lowStock.map((product) => (
                  <p key={product.id}>
                    {product.name}
                    <span>
                      {product.quantity} {product.unit}
                    </span>
                  </p>
                ))
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
              onAdd={addOption}
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
                onSave={saveProduct}
                onCancel={() => setEditingProduct(undefined)}
              />
            </aside>
          </section>
        </section>
      )}
      {tab === "Sales" && (
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
          <section className="sales-grid">
            <div className="panel">
              <h2>
                {editingOrder
                  ? `Edit ${editingOrder.orderNumber}`
                  : "New order"}
              </h2>
              <select
                className="product-picker"
                defaultValue=""
                onChange={(event) => {
                  addSaleLine(event.target.value);
                  event.target.value = "";
                }}
              >
                <option value="" disabled>
                  Add a product
                </option>
                {products
                  .filter((product) => product.quantity > 0)
                  .map((product) => (
                    <option value={product.id} key={product.id}>
                      {product.name} ({product.quantity} {product.unit})
                    </option>
                  ))}
              </select>
              <button
                className="add-product-link"
                type="button"
                onClick={addProductFromOrder}
              >
                <Plus size={16} /> Add new product
              </button>
              {!products.length && (
                <p className="order-empty-note">
                  No products are available yet. Add one to continue this
                  order.
                </p>
              )}
              {saleLines.map((line) => {
                const product = products.find(
                  (item) => item.id === line.productId,
                );
                return (
                  product && (
                    <div className="sale-line" key={line.productId}>
                      <span>{product.name}</span>
                      <input
                        min="1"
                        max={product.quantity + (editingOrder ? 999999 : 0)}
                        type="number"
                        value={line.quantity}
                        onChange={(event) =>
                          setLine(
                            line.productId,
                            "quantity",
                            Number(event.target.value),
                          )
                        }
                      />
                      <input
                        min="0"
                        step="0.01"
                        type="number"
                        value={line.price}
                        onChange={(event) =>
                          setLine(
                            line.productId,
                            "price",
                            Number(event.target.value),
                          )
                        }
                      />
                      <button
                        onClick={() =>
                          setSaleLines((lines) =>
                            lines.filter(
                              (item) => item.productId !== line.productId,
                            ),
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  )
                );
              })}
              <div className="order-total">
                Order total <strong>{currency(salesTotal)}</strong>
              </div>
              <button
                className="save-button"
                disabled={!saleLines.length}
                onClick={submitSale}
              >
                <ShoppingCart size={18} />
                {editingOrder ? "Save order" : "Submit order"}
              </button>
            </div>
            <div className="panel">
              <h2>Recent orders</h2>
              {orders.length ? (
                orders.map((order) => (
                  <p className="order-row" key={order.id}>
                    <span>
                      {order.orderNumber}
                      <small>{new Date(order.soldAt).toLocaleString()}</small>
                    </span>
                    <strong>{currency(order.totalAmount)}</strong>
                    <button onClick={() => editOrder(order)}>Edit</button>
                    <button onClick={() => deleteOrder(order)}>Delete</button>
                  </p>
                ))
              ) : (
                <p className="muted">Orders will appear here.</p>
              )}
            </div>
          </section>
        </section>
      )}
    </main>
  );
}
export default App;
