import { ConfirmDialog } from "../../common/PromptDialogs";

type WorkflowUnsavedDialogProps = {
  onCancel: () => void;
  onConfirm: () => void;
  targetName: string;
};

export function WorkflowUnsavedDialog({ onCancel, onConfirm, targetName }: WorkflowUnsavedDialogProps) {
  return (
    <ConfirmDialog
      cancelLabel="继续编辑"
      confirmLabel="放弃修改"
      description={(
        <>
          当前画布有未保存的修改。切换到「{targetName}」将丢失这些更改。
        </>
      )}
      onCancel={onCancel}
      onConfirm={onConfirm}
      title="未保存的修改"
      tone="danger"
    />
  );
}
