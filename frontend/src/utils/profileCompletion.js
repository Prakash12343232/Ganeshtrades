export const REGISTRATION_TOKEN_KEY = 'gt_registration_token';
export const PENDING_PROFILE_KEY = 'gt_pending_profile';

export const savePendingRegistration = (registrationToken, profile) => {
  if (registrationToken) {
    sessionStorage.setItem(REGISTRATION_TOKEN_KEY, registrationToken);
  }
  if (profile) {
    sessionStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify(profile));
  }
};

export const readPendingRegistration = () => {
  const token = sessionStorage.getItem(REGISTRATION_TOKEN_KEY);
  let profile = null;
  try {
    const raw = sessionStorage.getItem(PENDING_PROFILE_KEY);
    profile = raw ? JSON.parse(raw) : null;
  } catch {
    profile = null;
  }
  return { token, profile };
};

export const clearPendingRegistration = () => {
  sessionStorage.removeItem(REGISTRATION_TOKEN_KEY);
  sessionStorage.removeItem(PENDING_PROFILE_KEY);
};
