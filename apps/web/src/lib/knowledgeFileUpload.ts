const TEXT_EXTENSIONS = new Set([".txt", ".md", ".markdown", ".csv", ".json", ".log"]);

export type KnowledgeUploadFormat = "markdown" | "text";

export type ParsedKnowledgeFile = {
  content: string;
  fileName: string;
  format: KnowledgeUploadFormat;
  title: string;
};

function getExtension(fileName: string) {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index).toLowerCase() : "";
}

function titleFromFileName(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, "").trim();
  return base || fileName;
}

export function detectKnowledgeFormat(fileName: string): KnowledgeUploadFormat {
  const extension = getExtension(fileName);
  return extension === ".md" || extension === ".markdown" ? "markdown" : "text";
}

export function isSupportedKnowledgeFile(file: File) {
  if (file.type.startsWith("text/")) {
    return true;
  }

  return TEXT_EXTENSIONS.has(getExtension(file.name));
}

export async function readKnowledgeFile(file: File, maxBytes = 2 * 1024 * 1024): Promise<ParsedKnowledgeFile> {
  if (!isSupportedKnowledgeFile(file)) {
    throw new Error("暂仅支持 .txt / .md / .csv / .json 等文本文件。");
  }

  if (file.size > maxBytes) {
    throw new Error(`文件过大，请控制在 ${Math.round(maxBytes / 1024 / 1024)}MB 以内。`);
  }

  const content = await file.text();
  if (!content.trim()) {
    throw new Error("文件内容为空，请选择其它文件。");
  }

  return {
    content,
    fileName: file.name,
    format: detectKnowledgeFormat(file.name),
    title: titleFromFileName(file.name)
  };
}
