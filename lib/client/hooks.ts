"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "@/lib/client/api";
import { queryKeys } from "@/lib/client/query-keys";
import { fetchSessionUser } from "@/lib/client/session-query";
import type { User } from "@/types/user";

export function useSessionQuery() {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: fetchSessionUser,
  });
}

export function useLeaderboardQuery() {
  return useQuery({
    queryKey: queryKeys.leaderboard,
    queryFn: async () => {
      const data = await api.getLeaderboard();
      return data.leaderboard;
    },
  });
}

export function useRankQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.rank,
    queryFn: () => api.getLeaderboardRank(),
    enabled,
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => {
      queryClient.setQueryData<User | null>(queryKeys.session, null);
    },
  });
}

export function useSkinMutations(onUserUpdate?: (patch: Partial<User>) => void) {
  const queryClient = useQueryClient();

  const patchSession = (patch: Partial<User>) => {
    queryClient.setQueryData<User | null>(queryKeys.session, (prev) =>
      prev ? { ...prev, ...patch } : prev,
    );
    onUserUpdate?.(patch);
  };

  const equipMutation = useMutation({
    mutationFn: (skinId: string) => api.equipSkin(skinId),
    onSuccess: (data) => {
      const nextActiveSkin = data.activeSkin ?? "default";
      patchSession({ activeSkin: nextActiveSkin });
    },
  });

  const unlockMutation = useMutation({
    mutationFn: (skinId: string) => api.unlockSkin(skinId),
    onSuccess: (data) => {
      patchSession({
        totalScore: data.totalScore,
        unlockedSkins: data.unlockedSkins,
      });
    },
  });

  return { equipMutation, unlockMutation };
}

export function getApiErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}
