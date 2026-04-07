export const normalizeTrustScore = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.round(numeric));
};

export const getTrustBadgeMeta = (score) => {
  const trustScore = normalizeTrustScore(score);

  if (trustScore >= 90) {
    return {
      label: 'City Sentinel',
      caption: 'Elite',
      backgroundColor: '#ECFEFF',
      borderColor: '#7DD3FC',
      textColor: '#0F172A',
      iconColor: '#F59E0B',
    };
  }

  if (trustScore >= 70) {
    return {
      label: 'Flow Keeper',
      caption: 'Trusted',
      backgroundColor: '#DBEAFE',
      borderColor: '#93C5FD',
      textColor: '#0F172A',
      iconColor: '#0284C7',
    };
  }

  if (trustScore >= 45) {
    return {
      label: 'Block Ranger',
      caption: 'Active',
      backgroundColor: '#DCFCE7',
      borderColor: '#86EFAC',
      textColor: '#14532D',
      iconColor: '#059669',
    };
  }

  if (trustScore >= 20) {
    return {
      label: 'Street Spotter',
      caption: 'Rising',
      backgroundColor: '#FEF3C7',
      borderColor: '#FCD34D',
      textColor: '#78350F',
      iconColor: '#D97706',
    };
  }

  return {
    label: 'Curb Scout',
    caption: 'Starter',
    backgroundColor: '#E0F2FE',
    borderColor: '#7DD3FC',
    textColor: '#0F172A',
    iconColor: '#38BDF8',
  };
};

export const sortUsersByTrust = (users) => {
  if (!Array.isArray(users)) {
    return [];
  }

  return [...users].sort((left, right) => {
    const trustDelta =
      normalizeTrustScore(right?.trust_score) - normalizeTrustScore(left?.trust_score);
    if (trustDelta !== 0) {
      return trustDelta;
    }

    const contributionDelta =
      (Number(right?.contribution_score) || 0) - (Number(left?.contribution_score) || 0);
    if (contributionDelta !== 0) {
      return contributionDelta;
    }

    return String(left?.full_name || '').localeCompare(String(right?.full_name || ''));
  });
};
