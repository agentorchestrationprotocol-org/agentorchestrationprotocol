export const LEGACY_STAKE_MIGRATION_CAP = 50;

type BalanceLike = {
  tokenBalance?: number;
  claimableBalance?: number;
  stakeBalance?: number;
};

const sanitize = (value: number | undefined) =>
  Number.isFinite(value) ? Math.max(0, value ?? 0) : 0;

/**
 * Resolves current ledgers with migration-aware fallback from legacy tokenBalance.
 * This never mutates DB by itself.
 */
export function resolveLedgers(
  user: BalanceLike,
  legacyStakeCap = LEGACY_STAKE_MIGRATION_CAP
): { claimableBalance: number; stakeBalance: number; legacyTokenBalance: number } {
  const legacyTokenBalance = sanitize(user.tokenBalance);
  const hasClaimable = user.claimableBalance !== undefined;
  const hasStake = user.stakeBalance !== undefined;

  if (hasClaimable && hasStake) {
    return {
      claimableBalance: sanitize(user.claimableBalance),
      stakeBalance: sanitize(user.stakeBalance),
      legacyTokenBalance,
    };
  }

  if (!hasClaimable && !hasStake) {
    const migratedStake = Math.min(legacyTokenBalance, Math.max(0, legacyStakeCap));
    return {
      claimableBalance: Math.max(0, legacyTokenBalance - migratedStake),
      stakeBalance: migratedStake,
      legacyTokenBalance,
    };
  }

  if (!hasStake) {
    const claimable = sanitize(user.claimableBalance);
    return {
      claimableBalance: claimable,
      stakeBalance: Math.max(0, legacyTokenBalance - claimable),
      legacyTokenBalance,
    };
  }

  const stake = sanitize(user.stakeBalance);
  return {
    claimableBalance: Math.max(0, legacyTokenBalance - stake),
    stakeBalance: stake,
    legacyTokenBalance,
  };
}

/**
 * Returns a patch that persists resolved ledgers and clears legacy tokenBalance.
 * Returns null if the row is already normalized.
 */
export function ledgerBackfillPatch(
  user: BalanceLike,
  legacyStakeCap = LEGACY_STAKE_MIGRATION_CAP
): { claimableBalance: number; stakeBalance: number; tokenBalance: number } | null {
  const resolved = resolveLedgers(user, legacyStakeCap);
  const needsBackfill =
    user.claimableBalance === undefined ||
    user.stakeBalance === undefined ||
    resolved.legacyTokenBalance !== 0;

  if (!needsBackfill) return null;

  return {
    claimableBalance: resolved.claimableBalance,
    stakeBalance: resolved.stakeBalance,
    tokenBalance: 0,
  };
}
