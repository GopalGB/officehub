import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

export const MAX_SOP_BYTES = 3 * 1024 * 1024;
export async function readSopUpload(value: FormDataEntryValue | null) {
  if (value === null || value === "") return null;
  if (typeof value === "string")
    throw new Error("Choose an SOP file to upload.");
  if (!value.name && value.size === 0) return null;
  if (!value.size || value.size > MAX_SOP_BYTES)
    throw new Error("The SOP file must be between 1 byte and 3 MB.");
  const name = value.name.split(/[\\/]/).pop()?.trim() ?? "";
  if (
    !name ||
    name.length > 180 ||
    [...name].some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    )
  )
    throw new Error("Use an SOP filename with at most 180 characters.");
  const extension = name.split(".").pop()?.toLowerCase();
  const data = Buffer.from(await value.arrayBuffer());
  let type: string;
  if (extension === "pdf" && data.subarray(0, 5).toString() === "%PDF-")
    type = "application/pdf";
  else if (
    extension === "docx" &&
    data.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
  )
    type =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  else if (extension === "txt" && !data.includes(0)) {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(data);
    } catch {
      throw new Error("Save text SOP files as UTF-8.");
    }
    type = "text/plain";
  } else
    throw new Error(
      "Upload a valid PDF, DOCX, or UTF-8 TXT file (up to 3 MB).",
    );
  return {
    sopFileName: name,
    sopFileType: type,
    sopFileSize: data.length,
    sopFileSha256: createHash("sha256").update(data).digest("hex"),
    sopFileData: data,
  };
}
