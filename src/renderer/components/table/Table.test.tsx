import { renderToStaticMarkup } from 'react-dom/server'
import { IntlProvider } from 'react-intl'

import { AppColumnDef, Table } from './Table'

type Row = { id: string; name: string }

const columns: AppColumnDef<Row>[] = [
  { id: 'name', header: 'Name', accessorKey: 'name', cell: ({ row }: { row: { original: Row } }) => row.original.name }
]

const messages = { 'common.loading': 'Loading…', 'common.noData': 'No data' }

const data: Row[] = [
  { id: '1', name: 'BTC.BTC' },
  { id: '2', name: 'ETH.ETH' }
]

const render = (props: { data: Row[]; loading?: boolean }) =>
  renderToStaticMarkup(
    <IntlProvider locale="en" messages={messages}>
      <Table columns={columns} getRowId={(row) => row.id} {...props} />
    </IntlProvider>
  )

describe('components/table/Table', () => {
  it('renders rows and no loading state when idle', () => {
    const html = render({ data })
    expect(html).toContain('BTC.BTC')
    expect(html).toContain('ETH.ETH')
    expect(html).not.toContain('Loading…')
    expect(html).not.toContain('table-refreshing')
    expect(html).toContain('aria-busy="false"')
  })

  it('shows the spinner row only (no rows) when loading without data', () => {
    const html = render({ data: [], loading: true })
    expect(html).toContain('Loading…')
    expect(html).not.toContain('No data')
    expect(html).not.toContain('table-refreshing')
    expect(html).toContain('aria-busy="true"')
  })

  it('keeps existing rows while reloading, without replacing them by the spinner row', () => {
    const html = render({ data, loading: true })
    expect(html).toContain('BTC.BTC')
    expect(html).toContain('ETH.ETH')
    expect(html).not.toContain('Loading…')
    expect(html).not.toContain('No data')
    // refresh is signalled by progress bar, dimmed rows and aria-busy
    expect(html).toContain('table-refreshing')
    expect(html).toContain('opacity-50')
    // overlay bar must not take layout space: absolute, 2px, and no <caption>
    expect(html).toMatch(
      /<div[^>]*absolute[^>]*h-0\.5[^>]*data-testid="table-refreshing"|<div[^>]*data-testid="table-refreshing"[^>]*absolute/
    )
    expect(html).not.toContain('<caption')
    expect(html).toContain('aria-busy="true"')
  })

  it('shows "no data" when idle without rows', () => {
    const html = render({ data: [] })
    expect(html).toContain('No data')
    expect(html).not.toContain('Loading…')
    expect(html).toContain('aria-busy="false"')
  })
})
