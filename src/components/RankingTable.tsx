"use client";

import { RankingResult } from "@/lib/ranking-types";

interface Props {
  results: RankingResult[];
}

function getRankBadge(rank: number | null) {
  if (rank === null) return <span className="text-gray-400 text-sm">圏外</span>;
  if (rank === 1)
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-400 text-white font-bold text-sm shadow">
        1
      </span>
    );
  if (rank === 2)
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-300 text-white font-bold text-sm shadow">
        2
      </span>
    );
  if (rank === 3)
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-600 text-white font-bold text-sm shadow">
        3
      </span>
    );
  if (rank <= 10)
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
        {rank}
      </span>
    );
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-bold text-sm">
      {rank}
    </span>
  );
}

function StarRating({ rating }: { rating?: number }) {
  if (!rating) return null;
  return (
    <span className="text-yellow-500 text-xs">
      {"★".repeat(Math.round(rating))} {rating.toFixed(1)}
    </span>
  );
}

export default function RankingTable({ results }: Props) {
  const sorted = [...results].sort((a, b) => {
    if (a.rank === null && b.rank === null) return 0;
    if (a.rank === null) return 1;
    if (b.rank === null) return -1;
    return a.rank - b.rank;
  });

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="font-bold text-gray-800">検索結果一覧</h3>
      </div>

      <div className="divide-y divide-gray-50">
        {sorted.map((result) => (
          <div key={result.keyword} className="px-6 py-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                {getRankBadge(result.rank)}
                <div>
                  <span className="font-medium text-gray-800">
                    {result.keyword}
                  </span>
                  <span className="text-xs text-gray-400 ml-2">
                    ({result.totalResults}件中)
                  </span>
                </div>
              </div>
              <div className="text-right">
                {result.rank !== null ? (
                  <span className={`text-lg font-bold ${
                    result.rank <= 3 ? "text-green-600" : result.rank <= 10 ? "text-blue-600" : "text-gray-600"
                  }`}>
                    {result.rank}位
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">圏外</span>
                )}
              </div>
            </div>

            {result.topThree.length > 0 && (
              <div className="ml-11 mt-2 space-y-1">
                <p className="text-xs text-gray-400 mb-1">上位3位</p>
                {result.topThree.map((place) => (
                  <div
                    key={`${result.keyword}-${place.rank}`}
                    className={`flex items-center justify-between text-xs px-3 py-1.5 rounded ${
                      place.name.includes(result.businessName)
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "bg-gray-50 text-gray-600"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium w-4">{place.rank}.</span>
                      <span className="truncate max-w-[200px]">{place.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StarRating rating={place.rating} />
                      {place.reviews !== undefined && (
                        <span className="text-gray-400">({place.reviews}件)</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
