import type { NodeTypes } from 'reactflow'

// Legacy src/app PFD tree is not wired into the active app router.
// Keep a harmless stub here so TypeScript does not fail on missing old node files.
export const nodeTypes: NodeTypes = {}

export type { PfdData } from './types'
