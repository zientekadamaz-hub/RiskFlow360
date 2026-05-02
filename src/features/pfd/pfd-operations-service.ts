import type { SupabaseClient } from '@supabase/supabase-js'
import type { OperationRow } from './types'

type OperationInsertParams = {
  projectId: string
  operationNumber: number
  name?: string
  machine?: string
  operation?: string
}

type OperationPatchParams = {
  operationNumber?: number
  name?: string
  machine?: string
  operation?: string
}

export async function patchOperationRecord(
  supabase: SupabaseClient,
  operationId: string,
  patch: OperationPatchParams
) {
  const res = await supabase.from('operations').update(patch).eq('id', operationId)
  if (res.error) throw new Error(res.error.message)
}

export async function createOperationRecord(
  supabase: SupabaseClient,
  params: OperationInsertParams
): Promise<Pick<OperationRow, 'id' | 'operation_number' | 'name' | 'machine' | 'operation'>> {
  const res = await supabase
    .from('operations')
    .insert([
      {
        project_id: params.projectId,
        operation_number: params.operationNumber,
        name: params.name ?? '',
        machine: params.machine ?? '',
        operation: params.operation ?? '',
        active: true,
      },
    ])
    .select('id,operation_number,name,machine,operation')
    .single()

  if (res.error) throw new Error(res.error.message)
  return res.data as Pick<OperationRow, 'id' | 'operation_number' | 'name' | 'machine' | 'operation'>
}

export async function renumberOperationRecords(
  supabase: SupabaseClient,
  renumberMap: Map<string, number>
) {
  if (renumberMap.size === 0) return

  await Promise.all(
    [...renumberMap.entries()].map(([id, operationNumber]) =>
      patchOperationRecord(supabase, id, { operationNumber })
    )
  )
}

export async function archiveOperationsAndDeletePfmea(
  supabase: SupabaseClient,
  operationIds: string[]
) {
  if (operationIds.length === 0) return

  await Promise.all(operationIds.map((id) => supabase.from('pfmea_rows').delete().eq('operation_id', id)))
  await Promise.all(operationIds.map((id) => supabase.from('operations').update({ active: false }).eq('id', id)))
}

export async function resequenceOperationRecords(
  supabase: SupabaseClient,
  operationIdsInOrder: string[]
) {
  const renumberMap = new Map<string, number>()
  operationIdsInOrder.forEach((id, index) => {
    renumberMap.set(id, (index + 1) * 10)
  })

  await renumberOperationRecords(supabase, renumberMap)
  return renumberMap
}
