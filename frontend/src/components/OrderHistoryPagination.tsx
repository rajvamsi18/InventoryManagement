type PageSize = 5 | 10 | 20

type Props = {
  page: number
  pageSize: PageSize
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: PageSize) => void
  itemLabel?: string
  ariaLabel?: string
}

export function OrderHistoryPagination({ page, pageSize, total, onPageChange, onPageSizeChange, itemLabel = 'Orders', ariaLabel = 'Order history pages' }: Props) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const firstOrder = total ? (page - 1) * pageSize + 1 : 0
  const lastOrder = Math.min(page * pageSize, total)

  return <nav className="order-history-pagination" aria-label={ariaLabel}>
    <label>{itemLabel} per page
      <select aria-label={`${itemLabel} per page`} value={pageSize} onChange={event => onPageSizeChange(Number(event.target.value) as PageSize)}>
        <option value={5}>5</option><option value={10}>10</option><option value={20}>20</option>
      </select>
    </label>
    <span>Showing {firstOrder}-{lastOrder} of {total}</span>
    <div>
      <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</button>
      <span>Page {page} of {pageCount}</span>
      <button type="button" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>Next</button>
    </div>
  </nav>
}