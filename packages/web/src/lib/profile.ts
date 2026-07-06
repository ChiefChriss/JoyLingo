/** Client device-local profile persistence (localStorage until auth). */
import {
  type FavoriteAnime,
  type UserProfile,
  type JlptGoal,
  DEFAULT_PROFILE,
  normalizeProfile,
} from "@joylingo/shared";

const PROFILE_KEY = "joylingo:profile";

let cached: UserProfile | null = null;

/** Reset cache if another tab writes the profile key. */
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === PROFILE_KEY) cached = null;
  });
}

function read(): UserProfile | null {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = normalizeProfile(JSON.parse(raw));
    cached = p;
    return p;
  } catch {
    return null;
  }
}

function write(profile: UserProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  cached = profile;
}

export function loadProfile(): UserProfile {
  return read() ?? { ...DEFAULT_PROFILE };
}

export function saveProfile(profile: UserProfile): void {
  write(profile);
  void syncProfileToApi(profile);
}

export function isOnboardingComplete(profile: UserProfile = loadProfile()): boolean {
  return profile.onboardingComplete;
}

export function getFavoriteAnime(profile: UserProfile = loadProfile()): FavoriteAnime[] {
  return profile.favoriteAnime;
}

export function addFavoriteAnime(anime: FavoriteAnime, profile: UserProfile = loadProfile()): UserProfile {
  if (profile.favoriteAnime.some((a) => a.malId === anime.malId)) return profile;
  const next: UserProfile = { ...profile, favoriteAnime: [...profile.favoriteAnime, anime] };
  saveProfile(next);
  return next;
}

export function setJlptGoal(goal: JlptGoal | null, profile: UserProfile = loadProfile()): UserProfile {
  const next: UserProfile = { ...profile, jlptGoal: goal };
  saveProfile(next);
  return next;
}

export function setPreferredStreamMode(mode: "sub" | "dub", profile: UserProfile = loadProfile()): UserProfile {
  const next: UserProfile = { ...profile, preferredStreamMode: mode };
  saveProfile(next);
  return next;
}

export function markKanaBaselineDone(profile: UserProfile = loadProfile()): UserProfile {
  if (profile.kanaBaselineDone) return profile;
  const next: UserProfile = { ...profile, kanaBaselineDone: true };
  saveProfile(next);
  return next;
}

export function completeOnboarding(patch: Partial<UserProfile>): UserProfile {
  const next: UserProfile = { ...loadProfile(), ...patch, onboardingComplete: true };
  saveProfile(next);
  return next;
}

/** Best-effort mirror to the API (`user_profiles` keyed by device id). */
async function syncProfileToApi(profile: UserProfile): Promise<void> {
  try {
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-joylingo-device-id": deviceHeader() },
      body: JSON.stringify(profile),
    });
  } catch {
    // Offline or API not running — localStorage remains source of truth.
  }
}

/** Read device id (creating it on first use) like the vocab lib does. */
function deviceHeader(): string {
  const KEY = "joylingo:device-id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}