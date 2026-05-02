import { derivePfmeaGroupIds, type PfmeaHierarchyRow } from './pfmea-hierarchy-utils'
import { normalizePfmeaPcpValue } from './pfmea-value-utils'

export type PfmeaNormalizableRow = PfmeaHierarchyRow & {
  pcp?: unknown
}

export function hydratePfmeaGroupIds<Row extends PfmeaNormalizableRow>(rows: Row[]) {
  return rows.map((row) => ({
    ...row,
    pcp: normalizePfmeaPcpValue(row.pcp),
    ...derivePfmeaGroupIds(row),
  }))
}
