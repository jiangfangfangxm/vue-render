<<<<<<< codex/establish-project-structure-for-vue-render-3qz6oq
# vue-render

项目基础结构已初始化，包含：

- Vue + Vite 入口文件
- 类型定义、composables、mock、utils 目录
- components 下的 layout / renderer / widgets 子目录
=======
# Agent UI Renderer (Vue3 + ElementPlus)

## 📌 项目简介

本项目实现了一个 **Agent-driven UI 渲染引擎**，核心能力：

* JSON UI Schema → Vue 渲染
* 支持组件：

  * text / alert / checklist / button_group / audit_panel
* Human-in-the-loop 交互
* 标准化事件流（WorkflowEvent）
* 状态机驱动 UI
* **Schema Patch（局部更新）**

---

## 🧠 核心理念

```
Agent → UI Schema → Renderer → UI → Event → Agent
```

---

## 🚀 启动方式

```bash
npm install
npm run dev
```

---

## 🧩 架构说明

### 1. Renderer

* PageRenderer
* SectionRenderer
* ComponentRenderer
* registry

---

### 2. Runtime

* useWorkflowRuntime
* patch engine

---

### 3. Schema Patch（核心特性）

支持：

* set_state
* replace_section
* append_section
* prepend_message
* set_allowed_events

---

## 🔥 未来规划

* 接入真实 Agent（LLM / OpenClaw）
* Streaming UI 更新
* UI Diff 渲染
* 审计日志增强
* 多任务并发 UI

---

## 📜 License

MIT

>>>>>>> main
