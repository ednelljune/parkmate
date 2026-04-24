export const normalizeTrustScore = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.round(numeric));
};

export const normalizeImpactScore = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.round(numeric));
};

export const LEADERBOARD_BADGE_TIERS = [
  {
    threshold: 0,
    label: 'Curb Scout',
    caption: 'Starter',
    backgroundColor: '#E0F2FE',
    borderColor: '#7DD3FC',
    textColor: '#0F172A',
    iconColor: '#38BDF8',
  },
  {
    threshold: 25,
    label: 'Street Sprinter',
    caption: 'Rising',
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    textColor: '#78350F',
    iconColor: '#D97706',
  },
  {
    threshold: 75,
    label: 'Lane Leader',
    caption: 'Pro',
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
    textColor: '#14532D',
    iconColor: '#059669',
  },
  {
    threshold: 150,
    label: 'City Vanguard',
    caption: 'Elite',
    backgroundColor: '#DBEAFE',
    borderColor: '#93C5FD',
    textColor: '#0F172A',
    iconColor: '#0284C7',
  },
  {
    threshold: 300,
    label: 'ParkMate Legend',
    caption: 'Legend',
    backgroundColor: '#ECFEFF',
    borderColor: '#7DD3FC',
    textColor: '#0F172A',
    iconColor: '#F59E0B',
  },
];

export const getLeaderboardBadgeMeta = (score) => {
  const impactScore = normalizeImpactScore(score);
  for (let index = LEADERBOARD_BADGE_TIERS.length - 1; index >= 0; index -= 1) {
    if (impactScore >= LEADERBOARD_BADGE_TIERS[index].threshold) {
      return LEADERBOARD_BADGE_TIERS[index];
    }
  }

  return LEADERBOARD_BADGE_TIERS[0];
};

export const sortUsersByImpact = (users) => {
  if (!Array.isArray(users)) {
    return [];
  }

  return [...users].sort((left, right) => {
    const impactDelta =
      normalizeImpactScore(right?.contribution_score) - normalizeImpactScore(left?.contribution_score);
    if (impactDelta !== 0) {
      return impactDelta;
    }

    const trustDelta =
      normalizeTrustScore(right?.trust_score) - normalizeTrustScore(left?.trust_score);
    if (trustDelta !== 0) {
      return trustDelta;
    }

    const reportsDelta =
      (Number(right?.total_reports) || 0) - (Number(left?.total_reports) || 0);
    if (reportsDelta !== 0) {
      return reportsDelta;
    }

    return String(left?.full_name || '').localeCompare(String(right?.full_name || ''));
  });
};
