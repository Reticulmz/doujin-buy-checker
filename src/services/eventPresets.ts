import type { EventType } from "~/db/schema";

export interface EventPreset {
  type: EventType;
  label: string;
  venue: string;
  halls: string[];
  spacePattern: RegExp;
  spaceHint: string;
  spacePlaceholder: string;
}

// M3 スペース形式:
//   アルファベット+数字 → 第一展示場（例: A-01）
//   ひらがな+数字     → 第二展示場1F（例: あ-01）
//   カタカナ+数字     → 第二展示場2F（例: ア-01）
const M3_SPACE_PATTERN = /^([A-Za-z]|[ぁ-ん]|[ァ-ヶ])-?\d{1,3}[a-z]*$/;

export const EVENT_PRESETS: Record<EventType, EventPreset> = {
  m3: {
    type: "m3",
    label: "M3",
    venue: "東京流通センター",
    halls: ["第一展示場", "第二展示場1F", "第二展示場2F"],
    spacePattern: M3_SPACE_PATTERN,
    spaceHint: "英字: 第一 / ひらがな: 第二1F / カタカナ: 第二2F",
    spacePlaceholder: "A-01",
  },
  custom: {
    type: "custom",
    label: "その他",
    venue: "",
    halls: [],
    spacePattern: /^.+$/,
    spaceHint: "",
    spacePlaceholder: "スペース番号",
  },
};

export function inferM3Hall(space: string): string {
  const normalized = normalizeSpace(space);
  if (!normalized) return "";
  const first = normalized[0];
  if (/[A-Za-z]/.test(first)) return "第一展示場";
  if (/[ぁ-ん]/.test(first)) return "第二展示場1F";
  if (/[ァ-ヶ]/.test(first)) return "第二展示場2F";
  return "";
}

export function validateSpace(eventType: EventType, space: string): { valid: boolean; message: string } {
  if (!space.trim()) return { valid: true, message: "" };

  const preset = EVENT_PRESETS[eventType];
  const normalized = normalizeSpace(space);

  if (!preset.spacePattern.test(normalized)) {
    return {
      valid: false,
      message: `形式が不正です（${preset.spaceHint}）`,
    };
  }

  return { valid: true, message: "" };
}

export function normalizeSpace(space: string): string {
  return space
    .trim()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0)
    )
    .replace(/[ー−―]/g, "-");
}
