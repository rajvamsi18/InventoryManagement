import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, Search, ShoppingCart, Upload, Warehouse } from 'lucide-react'
import { OfflineIndicator } from './components/OfflineIndicator'
import { ProductForm } from './components/ProductForm'
import { ProductList } from './components/ProductList'
import { downloadBackup, readBackup } from './services/backup'
import { inventoryDb, PRODUCT_CATEGORIES, type Product, type SalesOrder } from './services/database'
import './App.css'

type Tab = 'Home' | 'Products' | 'Inventory' | 'Sales'
type SaleLine = { productId: string; quantity: number; price: number }
const currency = (amount: number) => `Rs. ${amount.toFixed(2)}`

function App() {
  const [tab, setTab] = useState<Tab>('Home')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [backupStatus, setBackupStatus] = useState('')
  const [editingProduct, setEditingProduct] = useState<Product>()
  const [editingOrder, setEditingOrder] = useState<SalesOrder>()
  const [saleLines, setSaleLines] = useState<SaleLine[]>([])
  const importInput = useRef<HTMLInputElement>(null)
  const products = useLiveQuery(() => inventoryDb.products.orderBy('updatedAt').reverse().toArray(), []) ?? []
  const orders = useLiveQuery(() => inventoryDb.orders.orderBy('soldAt').reverse().toArray(), []) ?? []
  const orderItems = useLiveQuery(() => inventoryDb.orderItems.toArray(), []) ?? []
  const customCategories = useLiveQuery(() => inventoryDb.categories.orderBy('name').toArray(), []) ?? []

  useEffect(() => { const update = () => setIsOnline(navigator.onLine); window.addEventListener('online', update); window.addEventListener('offline', update); return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) } }, [])
    useEffect(() => { window.scrollTo(0, 0) }, [tab])
  const lowStock = products.filter((product) => product.quantity <= product.lowStockAt)
  const inventoryValue = products.reduce((total, product) => total + (product.price ?? 0) * product.quantity, 0)
  const today = new Date().toDateString()
  const todayOrders = orders.filter((order) => new Date(order.soldAt).toDateString() === today)
  const monthSales = orders.filter((order) => { const date = new Date(order.soldAt); const now = new Date(); return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear() }).reduce((sum, order) => sum + order.totalAmount, 0)
  const todaySales = todayOrders.reduce((sum, order) => sum + order.totalAmount, 0)
  const unitsSoldToday = orderItems.filter((item) => orders.some((order) => order.id === item.orderId && new Date(order.soldAt).toDateString() === today)).reduce((sum, item) => sum + item.quantitySold, 0)
  const shownProducts = products.filter((product) => (category === 'All' || product.category === category) && product.name.toLowerCase().includes(search.toLowerCase()))
  const categories = [...new Set([...PRODUCT_CATEGORIES, ...customCategories.map((item) => item.name)])]

  async function saveProduct(values: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) {
    const timestamp = new Date().toISOString()
    if (editingProduct) { await inventoryDb.products.update(editingProduct.id, { ...values, updatedAt: timestamp }); setEditingProduct(undefined) }
    else await inventoryDb.products.add({ ...values, id: crypto.randomUUID(), createdAt: timestamp, updatedAt: timestamp })
  }
  async function removeProduct(product: Product) { if (window.confirm(`Delete ${product.name}?`)) await inventoryDb.products.delete(product.id) }
  async function addCategory(name: string) { if (!categories.some((categoryName) => categoryName.toLowerCase() === name.toLowerCase())) await inventoryDb.categories.add({ id: crypto.randomUUID(), name, createdAt: new Date().toISOString() }) }
  async function renameCategory(categoryId: string, previousName: string) { const name = window.prompt('Category name', previousName)?.trim(); if (!name || name === previousName || categories.some((categoryName) => categoryName.toLowerCase() === name.toLowerCase())) return; await inventoryDb.transaction('rw', inventoryDb.categories, inventoryDb.products, async () => { await inventoryDb.categories.update(categoryId, { name }); const productsInCategory = await inventoryDb.products.where('category').equals(previousName).toArray(); await inventoryDb.products.bulkPut(productsInCategory.map((product) => ({ ...product, category: name, updatedAt: new Date().toISOString() }))) }) }
  async function removeCategory(categoryId: string, name: string) { if (products.some((product) => product.category === name)) return window.alert('Move products out of this category before removing it.'); if (window.confirm(`Remove the ${name} category?`)) await inventoryDb.categories.delete(categoryId) }
  async function importBackup(event: React.ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; try { const imported = await readBackup(file); await inventoryDb.products.bulkPut(imported); setBackupStatus(`Imported ${imported.length} products.`) } catch (error) { setBackupStatus(error instanceof Error ? error.message : 'Could not import backup.') } finally { event.target.value = '' } }
  function addSaleLine(productId: string) { const product = products.find((item) => item.id === productId); if (product && !saleLines.some((line) => line.productId === productId)) setSaleLines([...saleLines, { productId, quantity: 1, price: product.sellingPrice ?? product.price ?? 0 }]) }
  async function submitSale() {
    if (!saleLines.length) return
    const selected = saleLines.map((line) => ({ line, product: products.find((product) => product.id === line.productId) })).filter((entry): entry is { line: SaleLine; product: Product } => Boolean(entry.product))
    const originalItems = editingOrder ? await inventoryDb.orderItems.where('orderId').equals(editingOrder.id).toArray() : []
    const restoredStock = originalItems.reduce<Record<string, number>>((stock, item) => ({ ...stock, [item.productId]: (stock[item.productId] ?? 0) + item.quantitySold }), {})
    if (selected.some(({ line, product }) => line.quantity <= 0 || line.quantity > product.quantity + (restoredStock[product.id] ?? 0))) return window.alert('Check quantities. A sale cannot exceed available stock.')
    const timestamp = new Date().toISOString(); const orderId = editingOrder?.id ?? crypto.randomUUID(); const totalAmount = selected.reduce((sum, { line }) => sum + line.quantity * line.price, 0)
    await inventoryDb.transaction('rw', inventoryDb.products, inventoryDb.orders, inventoryDb.orderItems, async () => {
      for (const item of originalItems) { const product = await inventoryDb.products.get(item.productId); if (product) await inventoryDb.products.update(product.id, { quantity: product.quantity + item.quantitySold, updatedAt: timestamp }) }
      if (editingOrder) { await inventoryDb.orderItems.where('orderId').equals(orderId).delete(); await inventoryDb.orders.update(orderId, { totalAmount, updatedAt: timestamp }) }
      else await inventoryDb.orders.add({ id: orderId, orderNumber: `SMKG-${Date.now().toString().slice(-6)}`, soldAt: timestamp, totalAmount, createdAt: timestamp, updatedAt: timestamp })
      await inventoryDb.orderItems.bulkAdd(selected.map(({ line, product }) => ({ id: crypto.randomUUID(), orderId, productId: product.id, productName: product.name, category: product.category, quantitySold: line.quantity, unitSellingPrice: line.price, lineTotal: line.quantity * line.price })))
      for (const { line, product } of selected) await inventoryDb.products.update(product.id, { quantity: product.quantity - line.quantity, updatedAt: timestamp })
    })
    setSaleLines([])
    setEditingOrder(undefined)
  }
  async function editOrder(order: SalesOrder) { const items = await inventoryDb.orderItems.where('orderId').equals(order.id).toArray(); setEditingOrder(order); setSaleLines(items.map((item) => ({ productId: item.productId, quantity: item.quantitySold, price: item.unitSellingPrice }))) }
  async function deleteOrder(order: SalesOrder) { if (!window.confirm(`Delete ${order.orderNumber} and restore its stock?`)) return; const items = await inventoryDb.orderItems.where('orderId').equals(order.id).toArray(); await inventoryDb.transaction('rw', inventoryDb.products, inventoryDb.orders, inventoryDb.orderItems, async () => { for (const item of items) { const product = await inventoryDb.products.get(item.productId); if (product) await inventoryDb.products.update(product.id, { quantity: product.quantity + item.quantitySold, updatedAt: new Date().toISOString() }) } await inventoryDb.orderItems.where('orderId').equals(order.id).delete(); await inventoryDb.orders.delete(order.id) }) }
  const setLine = (productId: string, field: 'quantity' | 'price', value: number) => setSaleLines((lines) => lines.map((line) => line.productId === productId ? { ...line, [field]: value } : line))
  const salesTotal = saleLines.reduce((sum, line) => sum + line.quantity * line.price, 0)
  const topItem = orderItems.reduce<Record<string, number>>((counts, item) => ({ ...counts, [item.productName]: (counts[item.productName] ?? 0) + item.quantitySold }), {})
  const mostSold = Object.entries(topItem).sort((first, second) => second[1] - first[1])[0]?.[0] ?? 'No sales yet'

  return <main className="app-shell"><header className="topbar"><div className="brand"><Warehouse size={22} /> SMKG <small>Sri Mareswari Kinena General Stores</small></div><OfflineIndicator isOnline={isOnline} /></header><nav className="tabs">{(['Home', 'Products', 'Inventory', 'Sales'] as Tab[]).map((item) => <button className={tab === item ? 'active' : ''} onClick={() => { setTab(item); setEditingProduct(undefined) }} key={item}>{item}</button>)}</nav>
    {tab === 'Home' && <section><header className="page-heading"><div><p className="eyebrow">Today at SMKG</p><h1>Dashboard</h1></div></header><section className="metrics home-metrics"><div><span>Total products</span><strong>{products.length}</strong><button onClick={() => setTab('Products')}>View catalog</button></div><div><span>Units sold today</span><strong>{unitsSoldToday}</strong></div><div><span>Sales today</span><strong>{currency(todaySales)}</strong></div><div><span>Sales this month</span><strong>{currency(monthSales)}</strong></div></section><section className="dashboard-grid"><div className="panel"><h2>Products needing attention</h2>{lowStock.length ? lowStock.map((product) => <p key={product.id}>{product.name}<span>{product.quantity} {product.unit}</span></p>) : <p className="muted">No low-stock products.</p>}</div><div className="panel"><h2>Sales snapshot</h2><p>Orders today<span>{todayOrders.length}</span></p><p>Most sold<span>{mostSold}</span></p><p>Inventory value<span>{currency(inventoryValue)}</span></p></div></section></section>}
    {tab === 'Products' && <section><header className="page-heading"><div><p className="eyebrow">Product catalog</p><h1>Products</h1></div></header><div className="panel"><div className="catalog-tools"><label><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" /></label><select value={category} onChange={(event) => setCategory(event.target.value)}><option>All</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></div><ProductList products={shownProducts} onDelete={removeProduct} onEdit={(product) => { setEditingProduct(product); setTab('Inventory') }} /></div></section>}
    {tab === 'Inventory' && <section><header className="page-heading"><div><p className="eyebrow">Stockroom management</p><h1>Inventory</h1></div></header><section className="metrics"><div><span>Total products</span><strong>{products.length}</strong></div><div><span>Need attention</span><strong className="low-stock">{lowStock.length}</strong></div><div><span>Inventory value</span><strong>{currency(inventoryValue)}</strong></div></section><section className="backup-bar"><div><strong>Device backup</strong><span>{backupStatus || 'Export a copy regularly to keep outside the browser.'}</span></div><div className="backup-actions"><button onClick={() => downloadBackup(products)}><Download size={16} />Export</button><button onClick={() => importInput.current?.click()}><Upload size={16} />Import</button><input ref={importInput} type="file" accept="application/json" onChange={importBackup} hidden /></div></section><section className="workspace"><div className="catalog-panel"><div className="catalog-tools"><label><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search stock" /></label><select value={category} onChange={(event) => setCategory(event.target.value)}><option>All</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></div>{customCategories.length > 0 && <div className="category-manager"><span>Custom categories</span>{customCategories.map((item) => <span className="category-chip" key={item.id}>{item.name}<button onClick={() => renameCategory(item.id, item.name)}>Edit</button><button onClick={() => removeCategory(item.id, item.name)}>Remove</button></span>)}</div>}<ProductList products={shownProducts} onDelete={removeProduct} onEdit={setEditingProduct} /></div><aside className="form-panel"><ProductForm product={editingProduct} categories={categories} onAddCategory={addCategory} onSave={saveProduct} onCancel={() => setEditingProduct(undefined)} /></aside></section></section>}
    {tab === 'Sales' && <section><header className="page-heading"><div><p className="eyebrow">Point of sale</p><h1>Orders</h1></div></header><section className="metrics"><div><span>Orders</span><strong>{orders.length}</strong></div><div><span>Average order</span><strong>{currency(orders.length ? orders.reduce((sum, order) => sum + order.totalAmount, 0) / orders.length : 0)}</strong></div><div><span>Most sold</span><strong className="metric-text">{mostSold}</strong></div></section><section className="sales-grid"><div className="panel"><h2>{editingOrder ? `Edit ${editingOrder.orderNumber}` : 'New order'}</h2><select className="product-picker" defaultValue="" onChange={(event) => { addSaleLine(event.target.value); event.target.value = '' }}><option value="" disabled>Add a product</option>{products.filter((product) => product.quantity > 0).map((product) => <option value={product.id} key={product.id}>{product.name} ({product.quantity} {product.unit})</option>)}</select>{saleLines.map((line) => { const product = products.find((item) => item.id === line.productId); return product && <div className="sale-line" key={line.productId}><span>{product.name}</span><input min="1" max={product.quantity + (editingOrder ? 999999 : 0)} type="number" value={line.quantity} onChange={(event) => setLine(line.productId, 'quantity', Number(event.target.value))} /><input min="0" step="0.01" type="number" value={line.price} onChange={(event) => setLine(line.productId, 'price', Number(event.target.value))} /><button onClick={() => setSaleLines((lines) => lines.filter((item) => item.productId !== line.productId))}>Remove</button></div> })}<div className="order-total">Order total <strong>{currency(salesTotal)}</strong></div><button className="save-button" disabled={!saleLines.length} onClick={submitSale}><ShoppingCart size={18} />{editingOrder ? 'Save order' : 'Submit order'}</button></div><div className="panel"><h2>Recent orders</h2>{orders.length ? orders.map((order) => <p className="order-row" key={order.id}><span>{order.orderNumber}<small>{new Date(order.soldAt).toLocaleString()}</small></span><strong>{currency(order.totalAmount)}</strong><button onClick={() => editOrder(order)}>Edit</button><button onClick={() => deleteOrder(order)}>Delete</button></p>) : <p className="muted">Orders will appear here.</p>}</div></section></section>}
  </main>
}
export default App