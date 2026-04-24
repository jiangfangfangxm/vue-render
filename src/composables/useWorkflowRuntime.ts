import { ref } from 'vue'
import type { Workflow } from '../types/workflow'

export function useWorkflowRuntime(initial: Workflow[] = []) {
  const workflows = ref<Workflow[]>(initial)

  return {
    workflows,
  }
}
