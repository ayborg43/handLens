const key = (skillId) => `handlens:done:${skillId}`;

export function loadDone(skillId) {
  try {
    const raw = window.localStorage.getItem(key(skillId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDone(skillId, ids) {
  try {
    window.localStorage.setItem(key(skillId), JSON.stringify(ids));
  } catch {
    /* storage unavailable: progress just lasts for this visit */
  }
}

export function loadPref(name, fallback) {
  try {
    const raw = window.localStorage.getItem(`handlens:pref:${name}`);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function savePref(name, value) {
  try {
    window.localStorage.setItem(`handlens:pref:${name}`, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
