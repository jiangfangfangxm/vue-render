<template>
  <div class="page-shell">
    <div class="container">
      <el-row :gutter="16">
        <el-col :xl="18" :lg="24" :md="24" :sm="24" :xs="24">
          <el-card shadow="never" class="main-card rounded-card">
            <template #header>
              <div class="header-bar">
                <div>
                  <div class="title">{{ envelope.title }}</div>
                  <div class="subtitle">{{ envelope.subtitle }}</div>
                </div>
                <div class="header-badges">
                  <el-tag round>session: {{ envelope.sessionId }}</el-tag>
                  <el-tag round>state: {{ envelope.state }}</el-tag>
                  <el-tag round :type="riskTagType(envelope.riskSummary?.riskLevel)">
                    {{ envelope.riskSummary?.riskLevel || 'N/A' }}
                  </el-tag>
                </div>
              </div>
            </template>

            <div class="agent-summary">
              <div class="agent-summary-title">Agent 解释摘要</div>
              <div>{{ envelope.rationaleSummary }}</div>
            </div>

            <PageRenderer :envelope="envelope" :event-log="events" @emit-event="handleEvent" />
          </el-card>
        </el-col>

        <el-col :xl="6" :lg="24" :md="24" :sm="24" :xs="24">
          <el-card shadow="never" class="side-card rounded-card">
            <template #header>
              <div class="panel-title">Agent 消息</div>
            </template>
            <el-scrollbar height="280px">
              <div class="stack-gap">
                <div
                  v-for="msg in envelope.messages || []"
                  :key="msg.id"
                  class="message-card"
                >
                  <div class="meta-text">{{ msg.role }} · {{ msg.level || 'info' }}</div>
                  <div class="message-text">{{ msg.text }}</div>
                </div>
              </div>
            </el-scrollbar>
          </el-card>

          <el-card shadow="never" class="side-card rounded-card mt-16">
            <template #header>
              <div class="panel-title">前端捕获事件</div>
            </template>
            <el-scrollbar height="360px">
              <div class="stack-gap">
                <div v-if="events.length === 0" class="empty-text">尚无用户事件。</div>
                <div v-for="(evt, idx) in events" :key="idx" class="event-card">
                  <div class="event-title">{{ evt.eventType }}</div>
                  <div class="meta-text">source: {{ evt.metadata?.sourceComponentId || '-' }}</div>
                  <pre class="event-payload">{{ JSON.stringify(evt.payload ?? {}, null, 2) }}</pre>
                </div>
              </div>
            </el-scrollbar>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref } from 'vue'
import {
  ElAlert,
  ElButton,
  ElCard,
  ElCheckbox,
  ElCheckboxGroup,
  ElCol,
  ElDescriptions,
  ElDescriptionsItem,
  ElDivider,
  ElRow,
  ElScrollbar,
  ElTag,
  type TagProps,
} from 'element-plus'

type AppState =
  | 'idle'
  | 'collecting_intent'
  | 'collecting_application_form'
  | 'reviewing_initial_risks'
  | 'awaiting_human_decision'
  | 'need_clarification'
  | 'executing'
  | 'presenting_result'
  | 'completed'
  | 'failed'

type EventType =
  | 'START_TASK'
  | 'SELECT_TASK_TYPE'
  | 'SUBMIT_FORM'
  | 'REQUEST_CLARIFICATION'
  | 'PROVIDE_CLARIFICATION'
  | 'SELECT_RISK_ITEMS'
  | 'CONTINUE_EXECUTION'
  | 'REQUEST_MORE_INFO'
  | 'ASK_EXPLANATION'
  | 'APPROVE'
  | 'REJECT'
  | 'COMPLETE_TASK'
  | 'RESTART_TASK'

interface AgentMessage {
  id: string
  role: 'agent' | 'system'
  level?: 'info' | 'warning' | 'error'
  text: string
}

interface AuditEntry {
  id: string
  timestamp: string
  sessionId: string
  actorType: 'human' | 'agent' | 'system'
  eventType: string
  fromState?: AppState
  toState?: AppState
  summary: string
}

interface AllowedEvent {
  eventType: EventType
  label?: string
  requiresPayload?: boolean
}

interface UIAction {
  id: string
  label: string
  variant?: 'primary' | 'secondary' | 'danger' | 'link'
  eventType: EventType
  payloadTemplate?: Record<string, unknown>
}

interface UIEventBinding {
  trigger: 'onClick' | 'onSubmit' | 'onChange' | 'onSelect'
  eventType: EventType
  payloadFrom?: 'form' | 'selection' | 'component_state' | 'static'
  staticPayload?: Record<string, unknown>
}

interface UIComponentBase {
  id: string
  type: string
  visible?: boolean
  disabled?: boolean
  props?: Record<string, unknown>
  events?: UIEventBinding[]
}

interface UIText extends UIComponentBase {
  type: 'text'
  props: {
    content: string
    tone?: 'default' | 'muted' | 'positive' | 'warning' | 'danger'
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    weight?: 'normal' | 'medium' | 'bold'
  }
}

interface UIAlertComp extends UIComponentBase {
  type: 'alert'
  props: {
    level: 'info' | 'success' | 'warning' | 'error'
    title?: string
    message: string
  }
}

interface UIKeyValue extends UIComponentBase {
  type: 'key_value'
  props: {
    columns?: 1 | 2 | 3
    items: Array<{
      key: string
      label: string
      value: string | number | boolean | null
      valueType?: 'text' | 'money' | 'percent' | 'date' | 'tag'
    }>
  }
}

interface UIBadgeList extends UIComponentBase {
  type: 'badge_list'
  props: {
    items: Array<{
      label: string
      tone?: 'default' | 'info' | 'warning' | 'danger' | 'success'
    }>
  }
}

interface UIChecklist extends UIComponentBase {
  type: 'checklist'
  props: {
    items: Array<{
      id: string
      label: string
      description?: string
      checked?: boolean
      severity?: 'low' | 'medium' | 'high'
    }>
  }
}

interface UIButtonGroup extends UIComponentBase {
  type: 'button_group'
  props: {
    actions: UIAction[]
    direction?: 'horizontal' | 'vertical'
    align?: 'left' | 'center' | 'right'
  }
}

interface UIResultSummary extends UIComponentBase {
  type: 'result_summary'
  props: {
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
    recommendation: string
    summary: string
    majorFindings: string[]
    missingInformation?: string[]
    nextSteps?: string[]
  }
}

interface UIAuditPanel extends UIComponentBase {
  type: 'audit_panel'
  props: {
    entries: AuditEntry[]
    compact?: boolean
  }
}

interface UIDivider extends UIComponentBase {
  type: 'divider'
  props?: {
    label?: string
  }
}

type UIComponent =
  | UIText
  | UIAlertComp
  | UIKeyValue
  | UIBadgeList
  | UIChecklist
  | UIButtonGroup
  | UIResultSummary
  | UIAuditPanel
  | UIDivider

interface UISection {
  id: string
  type: 'section'
  visible?: boolean
  area?: 'left' | 'main' | 'right' | 'footer'
  title?: string
  subtitle?: string
  children: UIComponent[]
}

interface UIPageSchema {
  id: string
  type: 'page'
  layout?: 'single_column' | 'two_column' | 'three_panel'
  props?: {
    title?: string
    subtitle?: string
    mode?: 'view' | 'edit' | 'review' | 'result'
  }
  sections: UISection[]
  footerActions?: UIAction[]
}

interface WorkflowEnvelope {
  version: 'ui-schema/0.1'
  sessionId: string
  state: AppState
  title?: string
  subtitle?: string
  ui: UIPageSchema
  messages?: AgentMessage[]
  allowedEvents?: AllowedEvent[]
  rationaleSummary?: string
  riskSummary?: {
    riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH'
    recommendation?: string
  }
  auditPreview?: AuditEntry[]
}

interface WorkflowEvent {
  sessionId: string
  actor: 'human' | 'system'
  eventType: EventType
  payload?: Record<string, unknown>
  metadata?: {
    sourceComponentId?: string
    timestamp?: string
  }
}

function riskTagType(level?: 'LOW' | 'MEDIUM' | 'HIGH'): TagProps['type'] {
  if (level === 'HIGH') return 'danger'
  if (level === 'MEDIUM') return 'warning'
  return 'success'
}

function itemTagType(tone?: string): TagProps['type'] {
  if (tone === 'danger') return 'danger'
  if (tone === 'warning') return 'warning'
  if (tone === 'success') return 'success'
  if (tone === 'info') return 'info'
  return 'info'
}

function formatValue(value: string | number | boolean | null, valueType?: string) {
  if (value == null) return '-'
  if (valueType === 'money' && typeof value === 'number') return `¥${value.toLocaleString()}`
  if (valueType === 'percent' && typeof value === 'number') return `${value}%`
  return String(value)
}

function nowIso() {
  return new Date().toISOString()
}

const initialEnvelope: WorkflowEnvelope = {
  version: 'ui-schema/0.1',
  sessionId: 'sess_001',
  state: 'awaiting_human_decision',
  title: '贷款申请初步风险审查',
  subtitle: '请人工确认需继续核查的风险点',
  rationaleSummary:
    '基于申请金额、收入覆盖、行业属性与资料完整性，系统识别出若干需进一步确认的风险点。',
  riskSummary: {
    riskLevel: 'MEDIUM',
    recommendation: '建议人工确认后继续核查关键风险点。',
  },
  messages: [
    {
      id: 'm1',
      role: 'agent',
      level: 'info',
      text: '系统已识别 3 个需人工确认的风险点，请选择下一步动作。',
    },
  ],
  allowedEvents: [
    { eventType: 'SELECT_RISK_ITEMS', requiresPayload: true },
    { eventType: 'CONTINUE_EXECUTION' },
    { eventType: 'REQUEST_MORE_INFO' },
    { eventType: 'ASK_EXPLANATION', requiresPayload: true },
  ],
  ui: {
    id: 'page_risk_review',
    type: 'page',
    layout: 'three_panel',
    props: { title: '初步风险审查', mode: 'review' },
    sections: [
      {
        id: 'sec_left_context',
        type: 'section',
        area: 'left',
        title: '申请概览',
        children: [
          {
            id: 'kv_applicant',
            type: 'key_value',
            props: {
              columns: 1,
              items: [
                { key: 'name', label: '客户姓名', value: '张三' },
                { key: 'customerType', label: '客户类型', value: '个人' },
                { key: 'amount', label: '申请金额', value: 800000, valueType: 'money' },
                { key: 'industry', label: '行业', value: '钢铁贸易' },
              ],
            },
          },
          {
            id: 'badges_1',
            type: 'badge_list',
            props: {
              items: [
                { label: '申请金额偏高', tone: 'warning' },
                { label: '收入覆盖不足', tone: 'danger' },
                { label: '资料缺失', tone: 'warning' },
              ],
            },
          },
        ],
      },
      {
        id: 'sec_main_review',
        type: 'section',
        area: 'main',
        title: '风险点确认',
        children: [
          {
            id: 'alert_risk',
            type: 'alert',
            props: {
              level: 'warning',
              title: '请确认',
              message: '请选择需要继续核查的风险点，或要求客户补充资料。',
            },
          },
          {
            id: 'txt_rationale',
            type: 'text',
            props: {
              content:
                '系统建议优先核查收入覆盖不足与资料缺失项，因为这两项会显著影响初步判断结论。',
              tone: 'muted',
              size: 'sm',
            },
          },
          {
            id: 'check_risks',
            type: 'checklist',
            props: {
              items: [
                {
                  id: 'AMOUNT_HIGH',
                  label: '申请金额偏高',
                  description: '申请金额明显高于同类客户常见区间',
                  severity: 'medium',
                  checked: true,
                },
                {
                  id: 'INCOME_COVERAGE_LOW',
                  label: '收入覆盖不足',
                  description: '收入水平对贷款金额覆盖偏弱',
                  severity: 'high',
                  checked: true,
                },
                {
                  id: 'DOC_MISSING',
                  label: '资料缺失',
                  description: '收入证明与贷款用途说明不完整',
                  severity: 'medium',
                  checked: true,
                },
              ],
            },
            events: [
              {
                trigger: 'onSelect',
                eventType: 'SELECT_RISK_ITEMS',
                payloadFrom: 'selection',
              },
            ],
          },
          {
            id: 'btn_group_review',
            type: 'button_group',
            props: {
              actions: [
                {
                  id: 'act_continue',
                  label: '继续核查',
                  variant: 'primary',
                  eventType: 'CONTINUE_EXECUTION',
                },
                {
                  id: 'act_more_info',
                  label: '要求补充资料',
                  variant: 'secondary',
                  eventType: 'REQUEST_MORE_INFO',
                },
                {
                  id: 'act_explain',
                  label: '查看判断说明',
                  variant: 'link',
                  eventType: 'ASK_EXPLANATION',
                  payloadTemplate: { topic: 'current_risk_summary' },
                },
              ],
            },
          },
        ],
      },
      {
        id: 'sec_right_audit',
        type: 'section',
        area: 'right',
        title: '审计轨迹',
        children: [
          {
            id: 'audit_panel_1',
            type: 'audit_panel',
            props: {
              compact: true,
              entries: [
                {
                  id: 'a1',
                  timestamp: '2026-04-22T10:00:00Z',
                  sessionId: 'sess_001',
                  actorType: 'system',
                  eventType: 'START_TASK',
                  fromState: 'idle',
                  toState: 'collecting_intent',
                  summary: '任务已创建',
                },
                {
                  id: 'a2',
                  timestamp: '2026-04-22T10:03:00Z',
                  sessionId: 'sess_001',
                  actorType: 'agent',
                  eventType: 'SUBMIT_FORM',
                  fromState: 'collecting_application_form',
                  toState: 'reviewing_initial_risks',
                  summary: '已生成初步风险点',
                },
              ],
            },
          },
        ],
      },
    ],
  },
}

const envelope = ref<WorkflowEnvelope>(structuredClone(initialEnvelope))
const events = ref<WorkflowEvent[]>([])

function prependMessage(message: AgentMessage) {
  envelope.value.messages = [message, ...(envelope.value.messages || [])]
}

function handleEvent(evt: WorkflowEvent) {
  events.value = [evt, ...events.value]

  if (evt.eventType === 'ASK_EXPLANATION') {
    prependMessage({
      id: crypto.randomUUID(),
      role: 'agent',
      level: 'info',
      text: '高风险判断主要来自收入覆盖不足与资料缺失两项。若后续补齐收入证明并核实用途说明，结论可能下调为中风险。',
    })
    return
  }

  if (evt.eventType === 'REQUEST_MORE_INFO') {
    envelope.value.state = 'need_clarification'
    prependMessage({
      id: crypto.randomUUID(),
      role: 'agent',
      level: 'warning',
      text: '请补充收入证明文件、贷款用途说明，以及最近 6 个月的银行流水。',
    })
    return
  }

  if (evt.eventType === 'CONTINUE_EXECUTION') {
    envelope.value = {
      ...envelope.value,
      state: 'presenting_result',
      title: '贷款申请审查结果',
      subtitle: '已完成初步核查',
      messages: [
        {
          id: crypto.randomUUID(),
          role: 'agent',
          level: 'info',
          text: '已完成初步核查，建议转人工复审并要求补件。',
        },
        ...(envelope.value.messages || []),
      ],
      ui: {
        ...envelope.value.ui,
        sections: [
          envelope.value.ui.sections[0],
          {
            id: 'sec_result',
            type: 'section',
            area: 'main',
            title: '审查结论',
            children: [
              {
                id: 'result_1',
                type: 'result_summary',
                props: {
                  riskLevel: 'HIGH',
                  summary: '系统认为该申请当前不宜直接通过，需补充材料并转人工复审。',
                  recommendation: '补件后复审',
                  majorFindings: ['收入覆盖不足', '资料缺失', '申请金额偏高'],
                  missingInformation: ['收入证明', '流水', '用途说明'],
                  nextSteps: ['转人工复审', '补充材料', '重新评估额度'],
                },
              },
              {
                id: 'btn_group_result',
                type: 'button_group',
                props: {
                  actions: [
                    {
                      id: 'act_complete',
                      label: '结束任务',
                      variant: 'primary',
                      eventType: 'COMPLETE_TASK',
                    },
                    {
                      id: 'act_restart',
                      label: '重新开始',
                      variant: 'secondary',
                      eventType: 'RESTART_TASK',
                    },
                  ],
                },
              },
            ],
          },
          envelope.value.ui.sections[2],
        ],
      },
      allowedEvents: [
        { eventType: 'COMPLETE_TASK' },
        { eventType: 'RESTART_TASK' },
        { eventType: 'ASK_EXPLANATION', requiresPayload: true },
      ],
      riskSummary: {
        riskLevel: 'HIGH',
        recommendation: '补件后复审',
      },
    }
    return
  }

  if (evt.eventType === 'COMPLETE_TASK') {
    envelope.value.state = 'completed'
    prependMessage({
      id: crypto.randomUUID(),
      role: 'system',
      level: 'info',
      text: '任务已结束，审计记录已保存。',
    })
    return
  }

  if (evt.eventType === 'RESTART_TASK') {
    envelope.value = structuredClone(initialEnvelope)
    events.value = []
  }
}

const SectionCard = defineComponent({
  name: 'SectionCard',
  props: {
    title: { type: String, required: true },
    subtitle: { type: String, default: '' },
  },
  setup(props, { slots }) {
    return () =>
      h(
        ElCard,
        { shadow: 'never', class: 'section-card rounded-card' },
        {
          header: () =>
            h('div', { class: 'panel-title-wrap' }, [
              h('div', { class: 'panel-title' }, props.title),
              props.subtitle ? h('div', { class: 'panel-subtitle' }, props.subtitle) : null,
            ]),
          default: () => h('div', { class: 'stack-gap' }, slots.default ? slots.default() : []),
        },
      )
  },
})

const TextRenderer = defineComponent({
  name: 'TextRenderer',
  props: { node: { type: Object as () => UIText, required: true } },
  setup(props) {
    const cls = computed(() => {
      const sizeMap: Record<string, string> = {
        xs: 'text-xs',
        sm: 'text-sm',
        md: 'text-md',
        lg: 'text-lg',
        xl: 'text-xl',
      }
      const toneMap: Record<string, string> = {
        default: 'tone-default',
        muted: 'tone-muted',
        positive: 'tone-positive',
        warning: 'tone-warning',
        danger: 'tone-danger',
      }
      const weightMap: Record<string, string> = {
        normal: 'weight-normal',
        medium: 'weight-medium',
        bold: 'weight-bold',
      }
      return [
        'plain-text',
        sizeMap[props.node.props.size || 'md'],
        toneMap[props.node.props.tone || 'default'],
        weightMap[props.node.props.weight || 'normal'],
      ]
    })
    return () => h('p', { class: cls.value }, props.node.props.content)
  },
})

const AlertRenderer = defineComponent({
  name: 'AlertRenderer',
  props: { node: { type: Object as () => UIAlertComp, required: true } },
  setup(props) {
    return () =>
      h(ElAlert, {
        title: props.node.props.title || '',
        description: props.node.props.message,
        type:
          props.node.props.level === 'error'
            ? 'error'
            : props.node.props.level === 'warning'
              ? 'warning'
              : props.node.props.level === 'success'
                ? 'success'
                : 'info',
        showIcon: true,
        closable: false,
      })
  },
})

const KeyValueRenderer = defineComponent({
  name: 'KeyValueRenderer',
  props: { node: { type: Object as () => UIKeyValue, required: true } },
  setup(props) {
    return () =>
      h(
        ElDescriptions,
        {
          column: props.node.props.columns || 1,
          border: true,
          class: 'kv-desc',
        },
        () =>
          props.node.props.items.map((item) =>
            h(
              ElDescriptionsItem,
              { key: item.key, label: item.label },
              { default: () => formatValue(item.value, item.valueType) },
            ),
          ),
      )
  },
})

const BadgeListRenderer = defineComponent({
  name: 'BadgeListRenderer',
  props: { node: { type: Object as () => UIBadgeList, required: true } },
  setup(props) {
    return () =>
      h(
        'div',
        { class: 'badge-list' },
        props.node.props.items.map((item, idx) =>
          h(
            ElTag,
            {
              key: `${item.label}-${idx}`,
              round: true,
              type: itemTagType(item.tone),
            },
            () => item.label,
          ),
        ),
      )
  },
})

const ChecklistRenderer = defineComponent({
  name: 'ChecklistRenderer',
  props: {
    node: { type: Object as () => UIChecklist, required: true },
    sessionId: { type: String, required: true },
  },
  emits: ['emit-event'],
  setup(props, { emit }) {
    const selected = ref(props.node.props.items.filter((item) => item.checked).map((item) => item.id))

    function onChange(values: string[]) {
      selected.value = values
      const binding = props.node.events?.find((e) => e.trigger === 'onSelect')
      if (!binding) return
      emit('emit-event', {
        sessionId: props.sessionId,
        actor: 'human',
        eventType: binding.eventType,
        payload: { selectedRiskItems: values },
        metadata: {
          sourceComponentId: props.node.id,
          timestamp: nowIso(),
        },
      } as WorkflowEvent)
    }

    return () =>
      h('div', { class: 'stack-gap' }, [
        h(
          ElCheckboxGroup,
          {
            modelValue: selected.value,
            'onUpdate:modelValue': onChange,
            class: 'checklist-group',
          },
          () =>
            props.node.props.items.map((item) =>
              h('div', { key: item.id, class: 'check-item' }, [
                h('div', { class: 'check-item-head' }, [
                  h(ElCheckbox, { label: item.id }, { default: () => item.label }),
                  h(
                    ElTag,
                    {
                      round: true,
                      type:
                        item.severity === 'high'
                          ? 'danger'
                          : item.severity === 'medium'
                            ? 'warning'
                            : 'info',
                      size: 'small',
                    },
                    () => item.severity || 'low',
                  ),
                ]),
                item.description ? h('div', { class: 'check-item-desc' }, item.description) : null,
              ]),
            ),
        ),
        h(
          'div',
          { class: 'selection-tip' },
          `当前已选择 ${selected.value.length} 项：${selected.value.join('、') || '无'}`,
        ),
      ])
  },
})

const ButtonGroupRenderer = defineComponent({
  name: 'ButtonGroupRenderer',
  props: {
    node: { type: Object as () => UIButtonGroup, required: true },
    allowedEvents: { type: Array as () => AllowedEvent[] | undefined, required: false },
    sessionId: { type: String, required: true },
  },
  emits: ['emit-event'],
  setup(props, { emit }) {
    const allowed = computed(() => new Set((props.allowedEvents || []).map((i) => i.eventType)))

    function buttonType(variant?: UIAction['variant']) {
      if (variant === 'secondary') return 'default'
      if (variant === 'danger') return 'danger'
      return 'primary'
    }

    function isLink(variant?: UIAction['variant']) {
      return variant === 'link'
    }

    function clickAction(action: UIAction) {
      emit('emit-event', {
        sessionId: props.sessionId,
        actor: 'human',
        eventType: action.eventType,
        payload: action.payloadTemplate,
        metadata: {
          sourceComponentId: props.node.id,
          timestamp: nowIso(),
        },
      } as WorkflowEvent)
    }

    return () =>
      h(
        'div',
        { class: 'button-group' },
        props.node.props.actions.map((action) =>
          h(
            ElButton,
            {
              key: action.id,
              type: buttonType(action.variant),
              link: isLink(action.variant),
              plain: action.variant === 'secondary',
              disabled: allowed.value.size > 0 && !allowed.value.has(action.eventType),
              onClick: () => clickAction(action),
            },
            () => action.label,
          ),
        ),
      )
  },
})

const ResultSummaryRenderer = defineComponent({
  name: 'ResultSummaryRenderer',
  props: { node: { type: Object as () => UIResultSummary, required: true } },
  setup(props) {
    return () =>
      h('div', { class: 'result-box' }, [
        h('div', { class: 'result-head' }, [
          h(ElTag, { type: riskTagType(props.node.props.riskLevel), round: true }, () =>
            props.node.props.riskLevel,
          ),
          h('span', { class: 'result-title' }, '初步结论'),
        ]),
        h('div', { class: 'result-summary' }, props.node.props.summary),
        h('div', { class: 'sub-title' }, '主要发现'),
        h(
          'ul',
          { class: 'result-list' },
          props.node.props.majorFindings.map((item, idx) => h('li', { key: idx }, item)),
        ),
        h('div', { class: 'recommend-box' }, `建议动作：${props.node.props.recommendation}`),
      ])
  },
})

const AuditPanelRenderer = defineComponent({
  name: 'AuditPanelRenderer',
  props: { node: { type: Object as () => UIAuditPanel, required: true } },
  setup(props) {
    return () =>
      h(
        'div',
        { class: 'stack-gap' },
        props.node.props.entries.map((entry) =>
          h('div', { key: entry.id, class: 'audit-item' }, [
            h('div', { class: 'audit-top' }, [
              h('span', { class: 'meta-text' }, entry.timestamp),
              h(ElTag, { round: true, size: 'small' }, () => entry.actorType),
            ]),
            h('div', { class: 'audit-summary' }, entry.summary),
            h(
              'div',
              { class: 'meta-text' },
              `${entry.fromState || '-'} → ${entry.toState || '-'} · ${entry.eventType}`,
            ),
          ]),
        ),
      )
  },
})

const DividerRenderer = defineComponent({
  name: 'DividerRenderer',
  props: { node: { type: Object as () => UIDivider, required: true } },
  setup(props) {
    return () => h(ElDivider, {}, { default: () => props.node.props?.label || '' })
  },
})

const UnknownRenderer = defineComponent({
  name: 'UnknownRenderer',
  props: { typeName: { type: String, required: true } },
  setup(props) {
    return () => h('div', { class: 'unknown-box' }, `Unknown component: ${props.typeName}`)
  },
})

const ComponentRenderer = defineComponent({
  name: 'ComponentRenderer',
  props: {
    node: { type: Object as () => UIComponent, required: true },
    sessionId: { type: String, required: true },
    allowedEvents: { type: Array as () => AllowedEvent[] | undefined, required: false },
  },
  emits: ['emit-event'],
  setup(props, { emit }) {
    return () => {
      if (props.node.visible === false) return null
      switch (props.node.type) {
        case 'text':
          return h(TextRenderer, { node: props.node })
        case 'alert':
          return h(AlertRenderer, { node: props.node })
        case 'key_value':
          return h(KeyValueRenderer, { node: props.node })
        case 'badge_list':
          return h(BadgeListRenderer, { node: props.node })
        case 'checklist':
          return h(ChecklistRenderer, {
            node: props.node,
            sessionId: props.sessionId,
            onEmitEvent: (evt: WorkflowEvent) => emit('emit-event', evt),
          })
        case 'button_group':
          return h(ButtonGroupRenderer, {
            node: props.node,
            sessionId: props.sessionId,
            allowedEvents: props.allowedEvents,
            onEmitEvent: (evt: WorkflowEvent) => emit('emit-event', evt),
          })
        case 'result_summary':
          return h(ResultSummaryRenderer, { node: props.node })
        case 'audit_panel':
          return h(AuditPanelRenderer, { node: props.node })
        case 'divider':
          return h(DividerRenderer, { node: props.node })
        default:
          return h(UnknownRenderer, { typeName: props.node.type })
      }
    }
  },
})

const SectionRenderer = defineComponent({
  name: 'SectionRenderer',
  props: {
    section: { type: Object as () => UISection, required: true },
    sessionId: { type: String, required: true },
    allowedEvents: { type: Array as () => AllowedEvent[] | undefined, required: false },
  },
  emits: ['emit-event'],
  setup(props, { emit }) {
    return () => {
      if (props.section.visible === false) return null
      return h(
        SectionCard,
        { title: props.section.title || props.section.id, subtitle: props.section.subtitle || '' },
        {
          default: () =>
            props.section.children.map((child) =>
              h(ComponentRenderer, {
                key: child.id,
                node: child,
                sessionId: props.sessionId,
                allowedEvents: props.allowedEvents,
                onEmitEvent: (evt: WorkflowEvent) => emit('emit-event', evt),
              }),
            ),
        },
      )
    }
  },
})

const PageRenderer = defineComponent({
  name: 'PageRenderer',
  props: {
    envelope: { type: Object as () => WorkflowEnvelope, required: true },
    eventLog: { type: Array as () => WorkflowEvent[], required: true },
  },
  emits: ['emit-event'],
  setup(props, { emit }) {
    const leftSections = computed(() => props.envelope.ui.sections.filter((s) => s.area === 'left'))
    const mainSections = computed(() =>
      props.envelope.ui.sections.filter((s) => !s.area || s.area === 'main'),
    )
    const rightSections = computed(() => props.envelope.ui.sections.filter((s) => s.area === 'right'))

    return () =>
      h(ElRow, { gutter: 16 }, () => [
        h(
          ElCol,
          { lg: 6, md: 24, sm: 24, xs: 24 },
          () =>
            leftSections.value.map((section) =>
              h(SectionRenderer, {
                key: section.id,
                section,
                sessionId: props.envelope.sessionId,
                allowedEvents: props.envelope.allowedEvents,
                onEmitEvent: (evt: WorkflowEvent) => emit('emit-event', evt),
              }),
            ),
        ),
        h(
          ElCol,
          { lg: 12, md: 24, sm: 24, xs: 24 },
          () =>
            mainSections.value.map((section) =>
              h(SectionRenderer, {
                key: section.id,
                section,
                sessionId: props.envelope.sessionId,
                allowedEvents: props.envelope.allowedEvents,
                onEmitEvent: (evt: WorkflowEvent) => emit('emit-event', evt),
              }),
            ),
        ),
        h(
          ElCol,
          { lg: 6, md: 24, sm: 24, xs: 24 },
          () =>
            rightSections.value.map((section) =>
              h(SectionRenderer, {
                key: section.id,
                section,
                sessionId: props.envelope.sessionId,
                allowedEvents: props.envelope.allowedEvents,
                onEmitEvent: (evt: WorkflowEvent) => emit('emit-event', evt),
              }),
            ),
        ),
      ])
  },
})
</script>

<style scoped>
.page-shell {
  min-height: 100vh;
  background: #f5f7fa;
  padding: 16px;
  box-sizing: border-box;
}

.container {
  max-width: 1440px;
  margin: 0 auto;
}

.rounded-card {
  border-radius: 16px;
}

.main-card,
.side-card,
.section-card {
  border: 1px solid #e4e7ed;
}

.mt-16 {
  margin-top: 16px;
}

.header-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}

.title {
  font-size: 22px;
  line-height: 30px;
  font-weight: 600;
  color: #303133;
}

.subtitle {
  margin-top: 4px;
  font-size: 13px;
  color: #909399;
}

.header-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.agent-summary {
  border: 1px solid #e4e7ed;
  background: #fff;
  border-radius: 14px;
  padding: 14px 16px;
  margin-bottom: 16px;
  color: #606266;
  font-size: 14px;
}

.agent-summary-title,
.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.panel-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.panel-subtitle {
  font-size: 12px;
  color: #909399;
}

.stack-gap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message-card,
.event-card,
.audit-item,
.result-box,
.check-item,
.selection-tip,
.unknown-box {
  border: 1px solid #e4e7ed;
  border-radius: 14px;
  background: #fff;
  padding: 12px;
}

.message-text,
.result-summary,
.plain-text {
  color: #606266;
}

.meta-text {
  font-size: 12px;
  color: #909399;
}

.event-title,
.audit-summary,
.result-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.event-payload {
  margin: 8px 0 0;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 12px;
  color: #606266;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.badge-list,
.button-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.check-item-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.check-item-desc {
  margin-top: 8px;
  margin-left: 4px;
  font-size: 13px;
  color: #909399;
}

.selection-tip,
.recommend-box {
  background: #f9fafc;
  color: #606266;
  font-size: 13px;
}

.result-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.sub-title {
  margin-top: 12px;
  margin-bottom: 8px;
  font-size: 12px;
  color: #909399;
}

.result-list {
  margin: 0;
  padding-left: 18px;
  color: #606266;
}

.audit-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.empty-text {
  color: #909399;
  font-size: 13px;
}

.kv-desc :deep(.el-descriptions__label) {
  width: 120px;
}

.text-xs {
  font-size: 12px;
}
.text-sm {
  font-size: 13px;
}
.text-md {
  font-size: 14px;
}
.text-lg {
  font-size: 16px;
}
.text-xl {
  font-size: 20px;
}

.tone-default {
  color: #606266;
}
.tone-muted {
  color: #909399;
}
.tone-positive {
  color: #67c23a;
}
.tone-warning {
  color: #e6a23c;
}
.tone-danger {
  color: #f56c6c;
}

.weight-normal {
  font-weight: 400;
}
.weight-medium {
  font-weight: 500;
}
.weight-bold {
  font-weight: 700;
}

@media (max-width: 992px) {
  .page-shell {
    padding: 12px;
  }
}
</style>
