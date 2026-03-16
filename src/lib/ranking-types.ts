export interface TopPlace {
  rank: number;
  name: string;
  rating?: number;
  reviews?: number;
}

export interface RankingResult {
  keyword: string;
  rank: number | null;
  businessName: string;
  totalResults: number;
  checkedAt: string;
  topThree: TopPlace[];
}

export interface RankingHistory {
  id: string;
  keyword: string;
  rank: number | null;
  businessName: string;
  checkedAt: string;
  topThree: TopPlace[];
}
