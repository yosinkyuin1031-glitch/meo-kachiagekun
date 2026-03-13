export interface ChecklistItem {
  id: string;
  category: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  completed: boolean;
}

export interface BusinessProfile {
  name: string;
  area: string;
  keywords: string[];
  description: string;
  category: string;
  anthropicKey: string;
}

export interface GeneratedContent {
  id: string;
  type: "note" | "gbp" | "faq" | "structured-data";
  title: string;
  content: string;
  keyword: string;
  createdAt: string;
}
