"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SKINS } from "@/game/skins";
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
    onMutate: async (skinId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.session });
      const previous = queryClient.getQueryData<User | null>(queryKeys.session);
      patchSession({ activeSkin: skinId });
      return { previous };
    },
    onError: (_err, _skinId, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKeys.session, context.previous);
      }
    },
    onSuccess: (data) => {
      patchSession({ activeSkin: data.activeSkin ?? "default" });
    },
  });

  const unlockMutation = useMutation({
    mutationFn: (skinId: string) => api.unlockSkin(skinId),
    onMutate: async (skinId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.session });
      const previous = queryClient.getQueryData<User | null>(queryKeys.session);
      const skin = SKINS.find((item) => item.id === skinId);
      if (previous && skin) {
        patchSession({
          totalScore: Math.max(0, previous.totalScore - skin.price),
          unlockedSkins: previous.unlockedSkins.includes(skinId)
            ? previous.unlockedSkins
            : [...previous.unlockedSkins, skinId],
          activeSkin: skinId,
        });
      }
      return { previous };
    },
    onError: (_err, _skinId, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKeys.session, context.previous);
      }
    },
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
