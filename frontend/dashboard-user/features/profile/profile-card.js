/**
 * KANTOONG CORE — PROFILE CARD PREVIEW
 * File: frontend/dashboard-user/features/profile/profile-card.js
 *
 * Mengubah komposisi kartu Profile berdasarkan ukuran sel grid.
 * Semua konten dibuat dengan DOM API; tidak memakai HTML mentah.
 */

import { getProfileConfig } from "./profile-config.js";

function element(tag, className, text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== "") node.textContent = String(text);
  return node;
}

function getVariant({ width = 2, height = 2 } = {}) {
  if (width <= 1 && height <= 1) return "icon";
  if (width >= 4 && height >= 4) return "large";
  if (width >= 4 && height <= 2) return "wide";
  if (width <= 2 && height >= 4) return "tall";
  if (width >= 4) return "wide";
  if (height >= 4) return "tall";
  return "compact";
}

function makeAvatar(profile, extraClass = "") {
  const avatar = element(
    "span",
    `kc-profile-card__avatar${extraClass ? ` ${extraClass}` : ""}`
  );
  avatar.setAttribute("aria-hidden", "true");

  if (profile.avatarUrl) {
    try {
      const url = new URL(profile.avatarUrl, window.location.origin);
      if (url.protocol === "https:" || url.origin === window.location.origin) {
        const image = document.createElement("img");
        image.src = url.href;
        image.alt = "";
        image.loading = "lazy";
        image.referrerPolicy = "no-referrer";
        image.addEventListener("error", () => {
          image.remove();
          avatar.textContent = initials(profile.name);
        }, { once: true });
        avatar.append(image);
        return avatar;
      }
    } catch {
      // URL tidak valid: lanjutkan dengan avatar inisial.
    }
  }

  avatar.textContent = initials(profile.name);
  return avatar;
}

function initials(name = "") {
  return String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? "")
    .join("")
    .toUpperCase() || "P";
}

function addStat(container, symbol, value, label) {
  const stat = element("span", "kc-profile-card__stat");
  const icon = element("span", "kc-profile-card__stat-icon", symbol);
  const number = element("span", "kc-profile-card__stat-value", value);
  stat.append(icon, number);
  stat.setAttribute("aria-label", `${value} ${label}`);
  container.append(stat);
}

function createStats(profile) {
  const stats = element("span", "kc-profile-card__stats");
  addStat(stats, "♙", profile.followers, "pengikut");
  addStat(stats, "▣", profile.posts, "postingan");
  return stats;
}

function createActionLabel(label) {
  const action = element("span", "kc-profile-card__action");
  const arrow = element("span", "kc-profile-card__action-arrow", "↗");
  const text = element("span", "kc-profile-card__action-text", label);
  action.append(arrow, text);
  return action;
}

function createProfileCopy(profile, variant) {
  const copy = element("span", "kc-profile-card__copy");
  copy.append(
    element("span", "kc-profile-card__name", profile.name),
    element("span", "kc-profile-card__work", profile.work)
  );

  if (["wide", "tall", "large"].includes(variant)) {
    copy.append(element("span", "kc-profile-card__bio", profile.bio));
  }

  return copy;
}

/** Dipanggil dashboard core setelah ukuran kartu ditentukan. */
export function renderProfileCardPreview({ card, container, layout } = {}) {
  if (!card || !container) return;

  const config = getProfileConfig();
  const profile = config.cardPreview;
  const variant = getVariant(layout);

  card.dataset.cardUi = "profile";
  card.dataset.profileCardVariant = variant;
  container.dataset.profileCardVariant = variant;
  container.replaceChildren();
  container.classList.add("kc-profile-card-preview-host");

  const preview = element("span", "kc-profile-card-preview");
  preview.dataset.profileCardVariant = variant;

  if (variant === "icon") {
    preview.append(makeAvatar(profile, "kc-profile-card__avatar--icon"));
    preview.append(element("span", "kc-profile-card__micro-name", profile.name));
    container.append(preview);
    return;
  }

  if (variant === "wide") {
    preview.classList.add("kc-profile-card-preview--wide");
    preview.append(makeAvatar(profile, "kc-profile-card__avatar--wide"));
    const details = element("span", "kc-profile-card__wide-details");
    details.append(createProfileCopy(profile, variant));
    const footer = element("span", "kc-profile-card__footer");
    footer.append(createStats(profile), createActionLabel(profile.actionLabel));
    details.append(footer);
    preview.append(details);
    container.append(preview);
    return;
  }

  if (variant === "tall") {
    preview.classList.add("kc-profile-card-preview--tall");
    const portrait = element("span", "kc-profile-card__portrait");
    portrait.append(makeAvatar(profile, "kc-profile-card__avatar--portrait"));
    preview.append(portrait, createProfileCopy(profile, variant));
    const footer = element("span", "kc-profile-card__footer");
    footer.append(createStats(profile), createActionLabel(profile.actionLabel));
    preview.append(footer);
    container.append(preview);
    return;
  }

  if (variant === "large") {
    preview.classList.add("kc-profile-card-preview--large");
    const portrait = element("span", "kc-profile-card__large-portrait");
    portrait.append(makeAvatar(profile, "kc-profile-card__avatar--large"));
    const glass = element("span", "kc-profile-card__glass");
    glass.append(createProfileCopy(profile, variant));
    const footer = element("span", "kc-profile-card__footer");
    footer.append(createStats(profile), createActionLabel(profile.actionLabel));
    glass.append(footer);
    preview.append(portrait, glass);
    container.append(preview);
    return;
  }

  // Compact / ukuran perantara: avatar di bagian atas, identitas dan CTA ringkas.
  preview.classList.add("kc-profile-card-preview--compact");
  preview.append(makeAvatar(profile, "kc-profile-card__avatar--compact"));
  preview.append(createProfileCopy(profile, "compact"));
  preview.append(createActionLabel(profile.actionLabel));
  container.append(preview);
}

export default renderProfileCardPreview;
