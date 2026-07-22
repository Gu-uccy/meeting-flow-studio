import type { AuditAction } from "@meeting-flow/shared";

export const auditActionLabels: Record<AuditAction, string> = {
  "meeting.create": "创建会议",
  "meeting.update": "更新会议",
  "meeting.status_change": "变更会议状态",
  "meeting.delete": "删除会议",
  "workflow.run_start": "启动流程",
  "workflow.run_cancel": "取消流程",
  "workflow.template_canvas_save": "保存流程画布",
  "knowledge.document_create": "上传知识文档",
  "knowledge.document_delete": "删除知识文档",
  "knowledge.document_seed_demo": "填充示例知识文档",
  "knowledge.index_rebuild": "重建向量索引",
  "chat.message_send": "发送会议对话",
  "chat.reset": "清空会议对话",
  "workspace.create": "创建工作区",
  "workspace.rename": "重命名工作区",
  "workspace.delete": "删除工作区",
  "workspace.switch": "切换工作区",
  "workspace.member_invite": "邀请工作区成员",
  "workspace.member_remove": "移除工作区成员",
  "workspace.member_role_update": "更新工作区成员角色"
};
