
/**
 * ============================================================
 * KANTOONG CORE — PROFILE VIEW
 * File: frontend/dashboard-user/features/profile/profile-view.js
 *
 * Tanggung jawab:
 * - Merender UI Profile.
 * - Membaca konfigurasi dari profile-config.js.
 * - Menampilkan data pengguna dari context.
 * - Mengatur visibilitas field berdasarkan konfigurasi.
 * - Menangani interaksi UI.
 * - Membersihkan event listener dan memulihkan konten sebelumnya.
 *
 * Catatan:
 * - Belum terhubung ke backend.
 * - Konfigurasi frontend bukan mekanisme otorisasi backend.
 * - Styling berada di profile.css.
 * ============================================================
 */

import { getProfileConfig } from "./profile-config.js";

const VIEW_CLASS = "kc-profile";
const VIEW_ATTRIBUTE = "data-kc-profile-view";

const mountedViews = new WeakMap();

/**
 * Membuat elemen DOM tanpa memasukkan teks sebagai HTML.
 */
function createElement(tagName, className, text = "") {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  if (text !== "") {
    element.textContent = String(text);
  }

  return element;
}

/**
 * Membaca data pengguna dari context.
 * Data hanya dianggap tersedia apabila context menyatakan
 * bahwa pengguna sudah terautentikasi.
 */
function getUserData(context = {}, config) {
  const user = context.currentUser ?? context.user ?? null;

  if (!user || typeof user !== "object") {
    return {
      available: false,
      name: "Pengguna",
      email: "",
      role: "",
      avatarUrl: "",
      isOwner: false,
    };
  }

  const name =
    typeof user.name === "string" && user.name.trim()
      ? user.name.trim()
      : typeof user.fullName === "string" && user.fullName.trim()
        ? user.fullName.trim()
        : "Pengguna";

  const authenticated =
    user.authenticated === true ||
    user.isAuthenticated === true;

  return {
    available: authenticated,
    name,
    email: typeof user.email === "string" ? user.email : "",
    role: typeof user.role === "string" ? user.role : "",
    avatarUrl:
      typeof user.avatarUrl === "string"
        ? user.avatarUrl
        : "",
    isOwner: user.isOwner === true,
  };
}

/**
 * Membuat inisial avatar.
 */
function getInitials(name = "") {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "P";
  }

  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join("")
    .toUpperCase();
}

/**
 * Membuat avatar dengan fallback ke inisial.
 */
function createAvatar(user) {
  const avatar = createElement("div", "kc-profile__avatar");

  if (user.avatarUrl) {
    try {
      const url = new URL(
        user.avatarUrl,
        window.location.origin
      );

      const isAllowedUrl =
        url.protocol === "https:" ||
        url.origin === window.location.origin;

      if (isAllowedUrl) {
        const image = document.createElement("img");

        image.src = url.href;
        image.alt = "";
        image.loading = "lazy";
        image.referrerPolicy = "no-referrer";

        image.addEventListener(
          "error",
          () => {
            image.remove();
            avatar.textContent = getInitials(user.name);
          },
          { once: true }
        );

        avatar.append(image);

        return avatar;
      }
    } catch {
      // URL tidak valid; gunakan inisial.
    }
  }

  avatar.textContent = getInitials(user.name);

  return avatar;
}

/**
 * Membuat satu item informasi akun.
 */
function createInfoItem(label, value) {
  const item = createElement(
    "div",
    "kc-profile__info-item"
  );

  const labelElement = createElement(
    "span",
    "kc-profile__info-label",
    label
  );

  const valueElement = createElement(
    "span",
    "kc-profile__info-value",
    value || "Belum tersedia"
  );

  item.append(labelElement, valueElement);

  return item;
}

/**
 * Panel masuk: tampil saat pengguna belum login.
 */
function createLoginPanel() {
  const panel = createElement("section", "kc-profile__login");

  panel.append(
    createElement(
      "h2",
      "kc-profile__section-title",
      "Masuk ke akunmu"
    ),
    createElement(
      "p",
      "kc-profile__login-text",
      "Masuk untuk melihat profil, pesanan, dan fitur pribadimu."
    )
  );

  const googleButton = createActionButton({
    label: "Lanjutkan dengan Google",
    action: "login-google",
    variant: "primary",
  });

  googleButton.dataset.lockable = "true";

  panel.append(
    googleButton,
    createElement(
      "p",
      "kc-profile__divider",
      "atau masuk dengan email"
    )
  );

  const form = createElement("form", "kc-profile__login-form");

  form.dataset.profileForm = "email-login";
  form.noValidate = true;

  const emailInput = document.createElement("input");

  emailInput.type = "email";
  emailInput.name = "email";
  emailInput.autocomplete = "username";
  emailInput.placeholder = "Email";
  emailInput.setAttribute("aria-label", "Email");
  emailInput.className = "kc-profile__input";
  emailInput.dataset.lockable = "true";

  const passwordInput = document.createElement("input");

  passwordInput.type = "password";
  passwordInput.name = "password";
  passwordInput.autocomplete = "current-password";
  passwordInput.placeholder = "Password";
  passwordInput.setAttribute("aria-label", "Password");
  passwordInput.className = "kc-profile__input";
  passwordInput.dataset.lockable = "true";

  const submit = createElement(
    "button",
    "kc-profile__button kc-profile__button--secondary",
    "Masuk dengan Email"
  );

  submit.type = "submit";
  submit.dataset.lockable = "true";

  form.append(emailInput, passwordInput, submit);
  panel.append(form);

  return panel;
}

/**
 * Aksi akun: tampil saat pengguna sudah login.
 */
function createAccountActions(user) {
  const group = createElement("div", "kc-profile__account-actions");

  if (user.isOwner) {
    const adminButton = createActionButton({
      label: "Buka Dashboard Admin",
      action: "open-admin",
      variant: "primary",
    });

    adminButton.dataset.lockable = "true";
    group.append(adminButton);
  }

  const logoutButton = createActionButton({
    label: "Keluar",
    action: "logout",
    variant: "secondary",
  });

  logoutButton.dataset.lockable = "true";
  group.append(logoutButton);

  return group;
}

/**
 * Membuat tombol aksi.
 */
function createActionButton({
  label,
  action,
  variant = "secondary",
  disabled = false,
}) {
  const button = createElement(
    "button",
    `kc-profile__button kc-profile__button--${variant}`,
    label
  );

  button.type = "button";
  button.dataset.profileAction = action;
  button.disabled = disabled;

  return button;
}

/**
 * Membuat tampilan berdasarkan data dan konfigurasi.
 */
function createProfileLayout(user, config) {
  const fragment = document.createDocumentFragment();

  const { display, fields, actions, messages, feature } = config;

  const page = createElement("section", VIEW_CLASS);

  page.setAttribute(VIEW_ATTRIBUTE, "true");
  page.setAttribute("aria-labelledby", "kc-profile-title");

  // ----------------------------------------------------------
  // HEADER
  // ----------------------------------------------------------

  const header = createElement(
    "header",
    "kc-profile__header"
  );

  const headingGroup = createElement(
    "div",
    "kc-profile__heading-group"
  );

  const eyebrow = createElement(
    "p",
    "kc-profile__eyebrow",
    display.eyebrow
  );

  const title = createElement(
    "h1",
    "kc-profile__title",
    display.title
  );

  title.id = "kc-profile-title";

  const description = createElement(
    "p",
    "kc-profile__description",
    display.description
  );

  headingGroup.append(eyebrow, title, description);

  header.append(headingGroup);

  if (display.showAccountStatus) {
    const status = createElement(
      "span",
      user.available
        ? "kc-profile__status kc-profile__status--available"
        : "kc-profile__status",
      user.available
        ? "Sesi terdeteksi"
        : "Data belum tersedia"
    );

    header.append(status);
  }

  // ----------------------------------------------------------
  // IDENTITY CARD
  // ----------------------------------------------------------

  const identityCard = createElement(
    "section",
    "kc-profile__identity"
  );

  identityCard.setAttribute(
    "aria-label",
    "Informasi profil"
  );

  const identityMain = createElement(
    "div",
    "kc-profile__identity-main"
  );

  if (display.showAvatar && fields.avatarUrl?.enabled !== false) {
    identityMain.append(createAvatar(user));
  }

  const identityText = createElement(
    "div",
    "kc-profile__identity-text"
  );

  const identityName = createElement(
    "h2",
    "kc-profile__name",
    fields.name?.enabled === false
      ? "Profil pengguna"
      : user.name
  );

  identityText.append(identityName);

  if (
    display.showEmail &&
    fields.email?.enabled !== false
  ) {
    const email = createElement(
      "p",
      "kc-profile__email",
      user.email || messages.noEmail
    );

    identityText.append(email);
  }

  identityMain.append(identityText);
  identityCard.append(identityMain);

  const canEdit =
    feature.enabled === true &&
    feature.editable === true &&
    actions.editProfile?.enabled === true &&
    display.showEditButton === true &&
    user.available;

  if (
    display.showEditButton &&
    actions.editProfile?.enabled !== false
  ) {
    identityCard.append(
      createActionButton({
        label: actions.editProfile?.label || "Edit profil",
        action: "edit-profile",
        variant: "primary",
        disabled: !canEdit,
      })
    );
  }

  // ----------------------------------------------------------
  // ACCOUNT DETAILS
  // ----------------------------------------------------------

  const detailItems = [];

  if (fields.name?.enabled !== false) {
    detailItems.push(
      createInfoItem(
        fields.name?.label || "Nama",
        user.name
      )
    );
  }

  if (
    fields.email?.enabled !== false &&
    display.showEmail
  ) {
    detailItems.push(
      createInfoItem(
        fields.email?.label || "Email",
        user.email || messages.noEmail
      )
    );
  }

  if (
    fields.role?.enabled !== false &&
    display.showRole
  ) {
    detailItems.push(
      createInfoItem(
        fields.role?.label || "Role",
        user.role || messages.noRole
      )
    );
  }

  const detailsSection = createElement(
    "section",
    "kc-profile__details"
  );

  const detailsTitle = createElement(
    "h2",
    "kc-profile__section-title",
    "Informasi akun"
  );

  const detailsGrid = createElement(
    "div",
    "kc-profile__info-grid"
  );

  detailsGrid.append(...detailItems);

  detailsSection.append(detailsTitle, detailsGrid);

  // Sembunyikan bagian informasi apabila semua field dimatikan.
  detailsSection.hidden = detailItems.length === 0;

  // ----------------------------------------------------------
  // NOTICE
  // ----------------------------------------------------------

  const notice = createElement(
    "p",
    "kc-profile__notice",
    user.available
      ? "Informasi ditampilkan berdasarkan context aplikasi. Perubahan data belum disimpan ke backend."
      : messages.unavailable
  );

  notice.setAttribute("role", "status");

  // ----------------------------------------------------------
  // FEEDBACK
  // ----------------------------------------------------------

  const feedback = createElement(
    "p",
    "kc-profile__feedback"
  );

  feedback.setAttribute("aria-live", "polite");
  feedback.hidden = true;

  // Belum login: tampilkan panel masuk menggantikan data akun.
  if (!user.available) {
    page.append(header, createLoginPanel(), feedback);
    fragment.append(page);

    return {
      fragment,
      page,
      feedback,
    };
  }

  page.append(
    header,
    identityCard,
    createAccountActions(user),
    detailsSection,
    notice,
    feedback
  );

  fragment.append(page);

  return {
    fragment,
    page,
    feedback,
  };
}

/**
 * Merender Profile ke elemen target.
 *
 * profileConfig dapat diberikan melalui context.profileConfig
 * untuk kebutuhan konfigurasi UI tertentu.
 */
export async function renderProfileView({
  rootElement,
  context = {},
} = {}) {
  if (
    typeof Element === "undefined" ||
    !(rootElement instanceof Element)
  ) {
    throw new TypeError(
      "[KANTOONG Profile] rootElement harus berupa elemen DOM."
    );
  }

  const existingView = mountedViews.get(rootElement);

  if (existingView) {
    return existingView.cleanup;
  }

  const config = getProfileConfig(
    context.profileConfig ?? {}
  );

  if (!config.feature.enabled) {
    throw new Error(
      "[KANTOONG Profile] Fitur Profile dinonaktifkan melalui konfigurasi."
    );
  }

  const user = getUserData(context, config);

  const { fragment, page, feedback } =
    createProfileLayout(user, config);

  // Simpan konten sebelumnya agar dapat dipulihkan saat unmount.
  const previousContent = document.createDocumentFragment();

  while (rootElement.firstChild) {
    previousContent.append(rootElement.firstChild);
  }

  rootElement.append(fragment);

  const showFeedback = (text, kind = "info") => {
    feedback.textContent = text;
    feedback.dataset.kind = kind;
    feedback.hidden = !text;
  };

  const getAuth = () => {
    if (!context.auth) {
      showFeedback("Layanan login belum tersedia.", "error");

      return null;
    }

    return context.auth;
  };

  // Kunci tombol/isian login saat proses berjalan (cegah klik ganda).
  const setBusy = (busy) => {
    page.querySelectorAll("[data-lockable]").forEach((element) => {
      element.disabled = busy;
    });
  };

  const describeError = (error, fallback) =>
    context.auth?.describeError?.(error) ?? fallback;

  const handleClick = async (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const button = target.closest("[data-profile-action]");

    if (!button || !page.contains(button) || button.disabled) {
      return;
    }

    const action = button.dataset.profileAction;

    if (action === "edit-profile") {
      showFeedback(config.messages.editUnavailable);

      context.emit?.("profile:edit-requested", {
        featureId: "profile",
      });

      return;
    }

    const auth = getAuth();

    if (!auth) {
      return;
    }

    if (action === "login-google") {
      setBusy(true);
      showFeedback("Mengalihkan ke Google…");

      try {
        await auth.signInWithGoogle();
      } catch (error) {
        showFeedback(
          describeError(error, "Gagal masuk dengan Google."),
          "error"
        );
        setBusy(false);
      }

      return;
    }

    if (action === "open-admin") {
      auth.openAdmin();

      return;
    }

    if (action === "logout") {
      setBusy(true);

      try {
        await auth.signOut();
        context.reload?.();
      } catch (error) {
        showFeedback(describeError(error, "Gagal keluar."), "error");
        setBusy(false);
      }
    }
  };

  const handleSubmit = async (event) => {
    const form = event.target;

    if (
      !(form instanceof HTMLFormElement) ||
      form.dataset.profileForm !== "email-login"
    ) {
      return;
    }

    event.preventDefault();

    const auth = getAuth();

    if (!auth) {
      return;
    }

    const email = String(form.elements.email?.value ?? "").trim();
    const password = String(form.elements.password?.value ?? "");

    if (!email || !password) {
      showFeedback("Isi email dan password.", "error");

      return;
    }

    setBusy(true);
    showFeedback("Masuk…");

    try {
      await auth.signInWithEmail(email, password);
      context.reload?.();
    } catch (error) {
      showFeedback(describeError(error, "Gagal masuk."), "error");
      setBusy(false);
    }
  };

  page.addEventListener("click", handleClick);
  page.addEventListener("submit", handleSubmit);

  let isCleaned = false;

  const cleanup = () => {
    if (isCleaned) {
      return;
    }

    isCleaned = true;

    page.removeEventListener("click", handleClick);
    page.removeEventListener("submit", handleSubmit);
    page.remove();

    rootElement.append(previousContent);

    mountedViews.delete(rootElement);
  };

  mountedViews.set(rootElement, { cleanup });

  return cleanup;
}

/**
 * Membersihkan tampilan Profile.
 */
export async function destroyProfileView({
  rootElement,
} = {}) {
  if (!rootElement) {
    return;
  }

  const mountedView = mountedViews.get(rootElement);

  if (mountedView) {
    mountedView.cleanup();
  }
}
