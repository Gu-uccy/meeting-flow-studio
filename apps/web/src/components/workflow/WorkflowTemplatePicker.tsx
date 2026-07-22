import { useRef } from "react";
import type { ProductWorkflowTemplate } from "@meeting-flow/shared";

type WorkflowTemplatePickerProps = {
  onCreateTemplate: () => void;
  onDeleteTemplate: () => void;
  onDuplicateTemplate: () => void;
  onExportTemplate: () => void;
  onImportTemplate: (template: ProductWorkflowTemplate) => void;
  onSelectTemplate: (templateId: string) => void;
  selectedTemplateId: string;
  workflowTemplates: ProductWorkflowTemplate[];
};

export function WorkflowTemplatePicker({
  onCreateTemplate,
  onDeleteTemplate,
  onDuplicateTemplate,
  onExportTemplate,
  onImportTemplate,
  onSelectTemplate,
  selectedTemplateId,
  workflowTemplates
}: WorkflowTemplatePickerProps) {
  const importInputRef = useRef<HTMLInputElement>(null);
  const active = workflowTemplates.find((template) => template.id === selectedTemplateId);

  return (
    <details className="canvas-toolbar__template">
      <summary title="切换模板">{active?.name ?? "模板"}</summary>
      <div className="canvas-toolbar__template-menu">
        {workflowTemplates.map((template) => (
          <button
            className={template.id === selectedTemplateId ? "is-active" : ""}
            key={template.id}
            onClick={() => onSelectTemplate(template.id)}
            type="button"
          >
            {template.name}
          </button>
        ))}
        <div className="canvas-toolbar__template-actions">
          <button onClick={onCreateTemplate} type="button">新建</button>
          <button onClick={onDuplicateTemplate} type="button">复制</button>
          <button onClick={onExportTemplate} type="button">导出</button>
          <button onClick={() => importInputRef.current?.click()} type="button">导入</button>
          <button disabled={workflowTemplates.length <= 1} onClick={onDeleteTemplate} type="button">删除</button>
        </div>
        <input
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            void file.text().then((text) => onImportTemplate(JSON.parse(text) as ProductWorkflowTemplate)).finally(() => {
              event.target.value = "";
            });
          }}
          ref={importInputRef}
          type="file"
        />
      </div>
    </details>
  );
}
