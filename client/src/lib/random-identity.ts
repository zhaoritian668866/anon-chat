// Chinese nickname components
const adjectives = [
  "快乐的", "温柔的", "勇敢的", "聪明的", "可爱的", "神秘的", "优雅的",
  "活泼的", "安静的", "阳光的", "自由的", "浪漫的", "甜蜜的", "酷酷的",
  "梦幻的", "闪亮的", "清新的", "灵动的", "暖暖的", "飘逸的", "淡然的",
  "俏皮的", "慵懒的", "率真的", "洒脱的", "迷人的", "天真的", "纯净的",
];

const nouns = [
  "小猫", "星星", "月亮", "云朵", "蝴蝶", "小鹿", "海豚", "兔子",
  "樱花", "雪花", "彩虹", "萤火虫", "向日葵", "小熊", "企鹅", "水母",
  "风铃", "泡泡", "棉花糖", "薄荷", "柠檬", "草莓", "蓝莓", "桃子",
  "仙人掌", "蒲公英", "四叶草", "银杏", "竹子", "梅花", "茉莉", "玫瑰",
];

export function generateNickname(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj}${noun}`;
}

// Avatar styles using DiceBear API
export const AVATAR_STYLES = [
  { id: "adventurer", name: "冒险家" },
  { id: "avataaars", name: "卡通人物" },
  { id: "bottts", name: "机器人" },
  { id: "fun-emoji", name: "趣味表情" },
  { id: "lorelei", name: "洛蕾莱" },
  { id: "notionists", name: "简笔画" },
  { id: "pixel-art", name: "像素风" },
  { id: "thumbs", name: "拇指人" },
] as const;

export type AvatarStyleId = typeof AVATAR_STYLES[number]["id"];

export function generateAvatarUrl(seed: string, style: AvatarStyleId = "adventurer"): string {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

/** Alias for convenience */
export function getAvatarUrl(style: string, seed: string): string {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

export function generateRandomSeed(): string {
  return Math.random().toString(36).substring(2, 10);
}
