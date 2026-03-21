// src/avatar.js
// Generates unique SVG avatars using multiavatar
// multiavatar is loaded globally via <script> tag in index.html

export function getAvatarSvg(seed) {
  if (typeof multiavatar === 'undefined') return null;
  return multiavatar(seed || 'default');
}

export function getAvatarUrl(seed) {
  const svg = getAvatarSvg(seed);
  if (!svg) return null;
  // Convert SVG to a data URL for use in <img> tags
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// Returns an <img> tag HTML string with the avatar
export function avatarImg(seed, size = 42, cssClass = 'avatar-img') {
  const url = getAvatarUrl(seed);
  if (!url) {
    // Fallback: colored initial
    const initial = (seed || '?')[0].toUpperCase();
    return `<div class="${cssClass} avatar-fallback">${initial}</div>`;
  }
  return `<img src="${url}" class="${cssClass}" alt="avatar" width="${size}" height="${size}" />`;
}
