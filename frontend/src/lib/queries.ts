import { useQuery } from "@tanstack/react-query";

import {
  fetchDiaryBooks,
  fetchDiaryHeatmap,
  fetchDiaryReviews,
  fetchMyBadges,
  fetchWeeklyRecap,
  type CheckIn,
  type ReactionType,
} from "@/lib/api";

export const queryKeys = {
  challenges: ["challenges"] as const,
  challengeDetail: (id: string) => ["challenge-detail", id] as const,
  challengeFeed: (id: string) => ["challenge-feed", id] as const,
  badges: ["my-badges"] as const,
  diaryHeatmap: ["diary-heatmap"] as const,
  diaryBooks: ["diary-books"] as const,
  diaryReviews: ["diary-reviews"] as const,
  weeklyRecap: ["diary-weekly-recap"] as const,
};

/** Aplica toggle otimista de reação localmente para resposta instantânea na UI. */
export function applyOptimisticReaction(checkin: CheckIn, reaction: ReactionType): CheckIn {
  const alreadyActive = checkin.user_reactions.includes(reaction);
  const currentCount = checkin.reactions[reaction] ?? 0;
  return {
    ...checkin,
    reactions: {
      ...checkin.reactions,
      [reaction]: Math.max(0, currentCount + (alreadyActive ? -1 : 1)),
    },
    user_reactions: alreadyActive
      ? checkin.user_reactions.filter((r) => r !== reaction)
      : [...checkin.user_reactions, reaction],
  };
}

export function useMyBadgesQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.badges,
    queryFn: fetchMyBadges,
    enabled,
    staleTime: 60_000,
  });
}

export function useDiaryHeatmapQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.diaryHeatmap,
    queryFn: () => fetchDiaryHeatmap(365),
    enabled,
    staleTime: 60_000,
  });
}

export function useDiaryBooksQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.diaryBooks,
    queryFn: fetchDiaryBooks,
    enabled,
    staleTime: 60_000,
  });
}

export function useDiaryReviewsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.diaryReviews,
    queryFn: fetchDiaryReviews,
    enabled,
    staleTime: 60_000,
  });
}

export function useWeeklyRecapQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.weeklyRecap,
    queryFn: fetchWeeklyRecap,
    enabled,
    staleTime: 60_000,
  });
}
