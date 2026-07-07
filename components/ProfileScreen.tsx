"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import DinoSvg from "@/components/ui/DinoSvg";
import { SKINS, gameMeta } from "@/game";
import { api } from "@/lib/client/api";
import {
  getApiErrorMessage,
  useRankQuery,
  useSkinMutations,
} from "@/lib/client/hooks";
import {
  changePasswordSchema,
  deleteAccountSchema,
  type ChangePasswordInput,
  type DeleteAccountInput,
} from "@/lib/validation/auth";
import { ui } from "@/lib/i18n/ui";

type ProfileScreenProps = {
  username: string;
  emailVerified: boolean;
  bestScore: number;
  totalScore?: number;
  unlockedSkins?: string[];
  activeSkin?: string;
  onUserUpdate?: (patch: {
    activeSkin?: string;
    totalScore?: number;
    unlockedSkins?: string[];
    emailVerified?: boolean;
  }) => void;
  onLogout: () => void;
  onBack: () => void;
};

export default function ProfileScreen({
  username,
  emailVerified,
  bestScore,
  totalScore: totalScoreProp,
  unlockedSkins: unlockedSkinsProp,
  activeSkin: activeSkinProp,
  onUserUpdate,
  onLogout,
  onBack,
}: ProfileScreenProps) {
  const [skinError, setSkinError] = useState<string | null>(null);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);

  const safeTotalScore = totalScoreProp ?? 0;
  const safeUnlockedSkins = unlockedSkinsProp ?? ["default"];
  const safeActiveSkin = activeSkinProp ?? "default";

  const {
    data: rankData,
    isLoading: rankLoading,
    isError: rankError,
  } = useRankQuery();

  const { equipMutation, unlockMutation } = useSkinMutations(onUserUpdate);
  const skinBusy = equipMutation.isPending || unlockMutation.isPending;

  async function handleSkinClick(skinId: string) {
    const isUnlocked = safeUnlockedSkins.includes(skinId);
    if (isUnlocked && skinId === safeActiveSkin) return;

    setSkinError(null);
    try {
      if (isUnlocked) {
        await equipMutation.mutateAsync(skinId);
      } else {
        await unlockMutation.mutateAsync(skinId);
        await equipMutation.mutateAsync(skinId);
      }
    } catch (err) {
      setSkinError(getApiErrorMessage(err, ui.common.error));
    }
  }

  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "" },
    mode: "onChange",
  });

  const deleteForm = useForm<DeleteAccountInput>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: "" },
    mode: "onChange",
  });

  const resendMutation = useMutation({
    mutationFn: () => api.resendVerification(),
    onSuccess: () => {
      setAccountError(null);
      setAccountMessage(ui.auth.verificationSent);
    },
    onError: (err) => {
      setAccountMessage(null);
      setAccountError(getApiErrorMessage(err, ui.common.error));
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (values: ChangePasswordInput) => api.changePassword(values),
    onSuccess: () => {
      setAccountError(null);
      setAccountMessage(ui.auth.passwordChanged);
      passwordForm.reset();
      onLogout();
    },
    onError: (err) => {
      setAccountMessage(null);
      setAccountError(getApiErrorMessage(err, ui.common.error));
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: (values: DeleteAccountInput) => api.deleteAccount(values),
    onSuccess: () => {
      setAccountError(null);
      setAccountMessage(ui.auth.accountDeleted);
      deleteForm.reset();
      onLogout();
    },
    onError: (err) => {
      setAccountMessage(null);
      setAccountError(getApiErrorMessage(err, ui.common.error));
    },
  });

  const accountBusy =
    resendMutation.isPending ||
    changePasswordMutation.isPending ||
    deleteAccountMutation.isPending;

  return (
    <div className="screen-content">
      <div className="page-header">
        <h2>{ui.profile.title}</h2>
        <button type="button" className="back-link" onClick={onBack}>
          {ui.common.back}
        </button>
      </div>

      <div className="profile-card">
        <div className="profile-name">{username}</div>
        <div className="profile-stat">
          <span>{ui.profile.bestScore}</span>
          <b>{bestScore}</b>
        </div>
        <div className="profile-stat">
          <span>{ui.profile.points}</span>
          <b>{safeTotalScore}</b>
        </div>
        {gameMeta.features.skins && (
          <div className="profile-stat">
            <span>{ui.profile.skinsUnlocked}</span>
            <b>
              {safeUnlockedSkins.length} / {SKINS.length}
            </b>
          </div>
        )}
        <div className="profile-stat">
          <span>{ui.profile.rank}</span>
          <b>
            {rankLoading && "…"}
            {rankError && "—"}
            {!rankLoading &&
              !rankError &&
              (rankData ? `#${rankData.rank}` : "—")}
          </b>
        </div>
      </div>

      {!emailVerified && (
        <div className="alert-warn mt-4">
          <p className="mb-2">{ui.auth.emailUnverified}</p>
          <button
            type="button"
            disabled={accountBusy}
            onClick={() => resendMutation.mutate()}
            className="auth-switch p-0"
          >
            {ui.auth.resendVerification}
          </button>
        </div>
      )}

      {gameMeta.features.skins && (
        <div className="mt-4">
          <div className="section-label section-label-tight">
            <span>{ui.profile.skins}</span>
          </div>
          {skinError && (
            <p className="alert-error" role="alert">
              {skinError}
            </p>
          )}
          <div className="skins-row">
            {SKINS.map((skin) => {
              const isUnlocked = safeUnlockedSkins.includes(skin.id);
              const isActive = skin.id === safeActiveSkin;

              return (
                <button
                  key={skin.id}
                  type="button"
                  disabled={(isUnlocked && isActive) || skinBusy}
                  onClick={() => void handleSkinClick(skin.id)}
                  className={`skin-card${isActive ? " skin-card-active" : ""}${
                    !isUnlocked ? " skin-card-locked" : ""
                  }`}
                >
                  {isActive && <span className="skin-check">✓</span>}
                  <DinoSvg color={skin.color} size={32} />
                  <span className="skin-name">{skin.name}</span>
                  {!isUnlocked && <span className="skin-price">{skin.price}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <details className="account-details">
        <summary>{ui.profile.accountSettings}</summary>

        <div className="account-panel">
          {accountMessage && (
            <p className="alert-success text-center" role="status">
              {accountMessage}
            </p>
          )}
          {accountError && (
            <p className="alert-error text-center" role="alert">
              {accountError}
            </p>
          )}

          <form
            onSubmit={passwordForm.handleSubmit((values) =>
              changePasswordMutation.mutate(values),
            )}
          >
            <p className="account-panel-title">{ui.auth.changePassword}</p>
            <input
              type="password"
              placeholder={ui.auth.currentPassword}
              disabled={accountBusy}
              className="field-input"
              {...passwordForm.register("currentPassword")}
            />
            {passwordForm.formState.errors.currentPassword && (
              <p className="alert-error" role="alert">
                {passwordForm.formState.errors.currentPassword.message}
              </p>
            )}
            <input
              type="password"
              placeholder={ui.auth.newPassword}
              disabled={accountBusy}
              className="field-input"
              {...passwordForm.register("newPassword")}
            />
            {passwordForm.formState.errors.newPassword && (
              <p className="alert-error" role="alert">
                {passwordForm.formState.errors.newPassword.message}
              </p>
            )}
            <button
              type="submit"
              disabled={accountBusy || !passwordForm.formState.isValid}
              className="start-btn start-btn-compact"
            >
              {ui.auth.changePassword}
            </button>
          </form>
        </div>

        <div className="account-panel">
          <form
            onSubmit={deleteForm.handleSubmit((values) =>
              deleteAccountMutation.mutate(values),
            )}
          >
            <p className="account-panel-title account-panel-title-danger">
              {ui.auth.deleteAccount}
            </p>
            <p className="field-hint">{ui.auth.deleteConfirm}</p>
            <input
              type="password"
              placeholder={ui.auth.password}
              disabled={accountBusy}
              className="field-input"
              {...deleteForm.register("password")}
            />
            {deleteForm.formState.errors.password && (
              <p className="alert-error" role="alert">
                {deleteForm.formState.errors.password.message}
              </p>
            )}
            <button
              type="submit"
              disabled={accountBusy || !deleteForm.formState.isValid}
              className="pbtn pbtn-secondary pbtn-danger"
            >
              {ui.auth.deleteAccount}
            </button>
          </form>
        </div>
      </details>

      <button
        type="button"
        onClick={onLogout}
        className="topbar-exit w-full text-center mt-4 py-3"
      >
        {ui.auth.logOut}
      </button>
    </div>
  );
}
