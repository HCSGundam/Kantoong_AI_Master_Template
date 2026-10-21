
/**
 * KANTOONG CORE — Customer Dashboard
 * File: frontend/dashboard/dashboard.js
 * BAGIAN 1/3
 *
 * Tanggung jawab:
 * - Menginisialisasi dashboard.
 * - Mengakses elemen dashboard.
 * - Membaca fitur dari Menu Registry.
 * - Menghubungkan aksi ke Menu Controller.
 * - Menyediakan utilitas toast dan event.
 *
 * Catatan:
 * - Tidak mengakses database secara langsung.
 * - Tidak mendaftarkan ulang fitur ke registry.
 * - Tidak menggantikan menu.js yang lama.
 */

(() => {
  'use strict';

  const MODULE = '[KANTOONG Dashboard]';

  // Hindari inisialisasi ganda.
  if (window.KantoongDashboard) {
    console.warn(`${MODULE} Modul sudah terpasang.`);
    return;
  }

  const SELECTORS = Object.freeze({
    root: '#kantoongDashboard',
    search: '#kdFeatureSearch',
    searchSuggestions: '#kdSearchSuggestions',
    featureGrid: '#kdFeatureGrid',
    featureEmpty: '#kdFeatureEmpty',
    recentActivity: '#kdRecentActivity',
    toast: '#kdDashboardToast',
    toastMessage: '#kdDashboardToastMessage'
  });

  const state = {
    initialized: false,
    root: null,
    elements: {},
    recentActivity: [],
    searchQuery: '',
    toastTimer: null,
    eventController: null
  };

  /**
   * Helper selector yang hanya mencari
   * elemen di dalam dashboard.
   */
  function $(selector, root = state.root) {
    if (!root) return null;

    return root.querySelector(selector);
  }

  /**
   * Memancarkan event integrasi KANTOONG.
   */
  function emit(name, detail = {}) {
    window.dispatchEvent(
      new CustomEvent(name, { detail })
    );
  }

  /**
   * Escape teks sebelum dimasukkan ke HTML.
   */
  function escapeHTML(value) {
    return String(value ?? '').replace(
      /[&<>"']/g,
      (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[character]
    );
  }

  /**
   * Mengambil referensi elemen dashboard.
   */
  function cacheElements() {
    state.elements = {};

    for (const [key, selector] of Object.entries(SELECTORS)) {
      state.elements[key] = $(selector);
    }

    return state.elements;
  }

  /**
   * Membaca daftar fitur dari registry.
   *
   * Jika registry belum tersedia atau kosong,
   * fungsi akan mengembalikan array kosong.
   * Daftar fitur lama tidak diduplikasi di sini.
   */
  function getRegisteredFeatures() {
  // Prioritas pertama: registry menu baru.
  if (window.KantoongMenuRegistry) {
    const registry = window.KantoongMenuRegistry;

    if (typeof registry.getAll === "function") {
      const registered = registry.getAll({
        enabledOnly: true
      });

      if (Array.isArray(registered) && registered.length > 0) {
        return registered;
      }
    }
  }

  // Fallback: daftar fitur dari menu.js lama.
  if (
    window.KantoongCustomerMenu &&
    typeof window.KantoongCustomerMenu.getFeatures === "function"
  ) {
    const legacyFeatures =
      window.KantoongCustomerMenu.getFeatures();

    if (Array.isArray(legacyFeatures)) {
      return legacyFeatures.filter(function (feature) {
        return feature && feature.id && feature.action;
      });
    }
  }

  return [];
}

  /**
   * Meminta controller menjalankan aksi fitur.
   */
  function dispatchFeature(action) {
    if (
      typeof action !== 'string' ||
      !action.trim()
    ) {
      return {
        ok: false,
        code: 'INVALID_ACTION'
      };
    }

    const controller = window.KantoongMenuController;

    if (!controller || typeof controller.dispatch !== 'function') {
      showToast(
        'Sistem navigasi belum siap. Coba lagi sebentar.'
      );

      return {
        ok: false,
        code: 'CONTROLLER_UNAVAILABLE'
      };
    }

    const result = controller.dispatch(action.trim());

    if (!result || result.ok !== true) {
      showToast(
        'Fitur belum tersedia atau belum terhubung.'
      );
    }

    return result;
  }

  /**
   * Menampilkan pesan singkat pada toast dashboard.
   */
  function showToast(message) {
    const toast = state.elements.toast;
    const messageElement = state.elements.toastMessage;

    if (!toast || !messageElement) {
      console.info(`${MODULE} ${message}`);
      return;
    }

    if (state.toastTimer) {
      window.clearTimeout(state.toastTimer);
      state.toastTimer = null;
    }

    messageElement.textContent = String(message ?? '');
    toast.hidden = false;
    toast.classList.add('is-visible');

    state.toastTimer = window.setTimeout(() => {
      dismissToast();
    }, 3500);
  }

  /**
   * Menutup toast.
   */
  function dismissToast() {
    const toast = state.elements.toast;

    if (state.toastTimer) {
      window.clearTimeout(state.toastTimer);
      state.toastTimer = null;
    }

    if (!toast) return;

    toast.classList.remove('is-visible');
    toast.hidden = true;
  }

  /**
   * Mengambil label fitur dari registry.
   * Digunakan untuk nama aktivitas dan pencarian.
   */
  function getFeatureById(id) {
    const normalizedId = String(id ?? '')
      .trim()
      .toLowerCase();

    if (!normalizedId) return null;

    const registry = window.KantoongMenuRegistry;

    if (registry && typeof registry.get === 'function') {
      const feature = registry.get(normalizedId);

      if (feature) return feature;
    }

    return getRegisteredFeatures().find(
      (feature) => feature.id === normalizedId
    ) || null;
  }

  /**
   * Mencatat aktivitas dashboard di memori sesi.
   *
   * Penyimpanan permanen akan ditambahkan setelah
   * integrasi dengan menu-storage.js dipastikan.
   */
  function recordActivity(featureId, title) {
    const id = String(featureId ?? '').trim();

    if (!id) return;

    const feature = getFeatureById(id);

    const activity = {
      id,
      title: String(
        title ||
        feature?.title ||
        id
      ),
      timestamp: Date.now()
    };

    state.recentActivity = [
      activity,
      ...state.recentActivity.filter(
        (item) => item.id !== id
      )
    ].slice(0, 8);

    emit('kantoong:dashboard-activity', {
      featureId: activity.id,
      title: activity.title,
      timestamp: activity.timestamp
    });
  }
  
  // ============================================
  // BAGIAN 2/3 — INTERAKSI DASHBOARD
  // ============================================

  /**
   * Mengubah teks menjadi bentuk aman untuk pencarian.
   */
  function normalizeSearchText(value) {
    return String(value ?? '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  /**
   * Mengambil kata kunci dari fitur registry.
   * Tidak menggunakan daftar sinonim buatan manual.
   */
  function getFeatureSearchText(feature) {
    return normalizeSearchText([
      feature.id,
      feature.title,
      feature.description,
      feature.category,
      feature.route
    ].filter(Boolean).join(' '));
  }

  /**
   * Memetakan fitur yang memang didukung controller lama.
   * Fitur yang belum terhubung tidak akan diarahkan ke aksi
   * yang tidak dikenal.
   */
  function getActionForFeature(feature) {
  if (!feature) {
    return null;
  }

  // Gunakan action yang sudah dimiliki fitur.
  if (typeof feature.action === "string" && feature.action) {
    return feature.action;
  }

  // Fallback ke controller menu.
  if (
    window.KantoongMenuController &&
    typeof window.KantoongMenuController.getFeature === "function"
  ) {
    const registeredFeature =
      window.KantoongMenuController.getFeature(feature.id);

    if (registeredFeature && registeredFeature.action) {
      return registeredFeature.action;
    }
  }

  return null;
}

  /**
   * Mencari fitur berdasarkan metadata registry.
   */
  function searchFeatures(query) {
    const normalizedQuery = normalizeSearchText(query);

    if (!normalizedQuery) return [];

    const terms = normalizedQuery
      .split(/\s+/)
      .filter(Boolean);

    return getRegisteredFeatures()
      .map((feature) => {
        const searchableText = getFeatureSearchText(feature);

        const matchedTerms = terms.filter(
          (term) => searchableText.includes(term)
        );

        return {
          feature,
          score: matchedTerms.length,
          completeMatch: searchableText.includes(normalizedQuery)
        };
      })
      .filter((result) => result.score > 0)
      .sort((a, b) => {
        if (a.completeMatch !== b.completeMatch) {
          return a.completeMatch ? -1 : 1;
        }

        if (a.score !== b.score) {
          return b.score - a.score;
        }

        return String(a.feature.title).localeCompare(
          String(b.feature.title),
          'id'
        );
      })
      .slice(0, 8)
      .map((result) => result.feature);
  }

  /**
   * Membuat markup saran pencarian.
   */
  function renderSearchSuggestions(query) {
    const container = state.elements.searchSuggestions;
    const input = state.elements.search;

    if (!container || !input) return;

    const normalizedQuery = String(query ?? '').trim();

    if (!normalizedQuery) {
      container.innerHTML = '';
      container.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      return;
    }

    const results = searchFeatures(normalizedQuery);

    if (!results.length) {
      container.innerHTML = `
        <div class="kd-search-no-results" role="status">
          <strong>Fitur belum ditemukan</strong>
          <span>
            Coba kata kunci lain atau jelajahi semua fitur.
          </span>
        </div>
        <button
          class="kd-search-result kd-search-browse"
          type="button"
          data-dashboard-action="customize"
        >
          <span class="kd-search-result-icon" aria-hidden="true">＋</span>
          <span class="kd-search-result-content">
            <strong>Jelajahi fitur</strong>
            <span>Buka pengaturan fitur dashboard</span>
          </span>
          <span aria-hidden="true">↗</span>
        </button>
      `;

      container.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      return;
    }

    container.innerHTML = results.map((feature) => {
      const action = getActionForFeature(feature);

      return `
        <button
          class="kd-search-result"
          type="button"
          role="option"
          aria-selected="false"
          data-dashboard-search-feature="${escapeHTML(feature.id)}"
          ${action ? '' : 'data-feature-unavailable="true"'}
        >
          <span class="kd-search-result-icon" aria-hidden="true">
            ${escapeHTML(feature.icon || '◇')}
          </span>

          <span class="kd-search-result-content">
            <strong>${escapeHTML(feature.title)}</strong>
            <span>${escapeHTML(feature.description || 'Buka fitur ini')}</span>
          </span>

          <span class="kd-search-result-arrow" aria-hidden="true">↗</span>
        </button>
      `;
    }).join('');

    container.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  /**
   * Menutup dropdown pencarian.
   */
  function closeSearchSuggestions() {
    const container = state.elements.searchSuggestions;
    const input = state.elements.search;

    if (container) {
      container.hidden = true;
    }

    if (input) {
      input.setAttribute('aria-expanded', 'false');
    }
  }

  /**
   * Menjalankan fitur berdasarkan ID.
   */
  function openFeatureById(featureId) {
    const feature = getFeatureById(featureId);

    if (!feature) {
      showToast('Fitur ini belum terdaftar di menu.');
      return false;
    }

    if (feature.enabled === false) {
      showToast('Fitur ini sedang dinonaktifkan.');
      return false;
    }

    const action = getActionForFeature(feature);

    if (!action) {
      showToast('Fitur ini belum terhubung ke navigasi.');
      emit('kantoong:dashboard-feature-unavailable', {
        featureId: feature.id,
        title: feature.title
      });
      return false;
    }

    const result = dispatchFeature(action);

    if (result && result.ok) {
      recordActivity(feature.id, feature.title);
      renderRecentActivity();
      closeSearchSuggestions();

      if (state.elements.search) {
        state.elements.search.value = '';
      }

      state.searchQuery = '';
      return true;
    }

    return false;
  }

  /**
   * Menampilkan aktivitas terbaru yang tercatat
   * selama dashboard aktif.
   */
  function renderRecentActivity() {
    const container = state.elements.recentActivity;

    if (!container) return;

    if (!state.recentActivity.length) {
      container.innerHTML = `
        <div class="kd-recent-empty">
          <span
            class="kd-recent-empty-icon"
            aria-hidden="true"
          >◷</span>

          <div>
            <strong>Aktivitasmu akan muncul di sini</strong>
            <p>
              Fitur yang kamu buka akan menjadi jalan pintas
              saat kamu kembali ke dashboard.
            </p>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = state.recentActivity.map((activity) => `
      <button
        class="kd-recent-item"
        type="button"
        data-dashboard-feature="${escapeHTML(activity.id)}"
      >
        <span class="kd-recent-item-icon" aria-hidden="true">◷</span>

        <span class="kd-recent-item-content">
          <strong>${escapeHTML(activity.title)}</strong>
          <span>${formatActivityTime(activity.timestamp)}</span>
        </span>

        <span class="kd-recent-item-arrow" aria-hidden="true">↗</span>
      </button>
    `).join('');
  }

  /**
   * Format waktu aktivitas tanpa mengasumsikan lokasi tertentu.
   */
  function formatActivityTime(timestamp) {
    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return 'Baru saja';
    }

    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  /**
   * Menangani perubahan input pencarian.
   */
  function handleSearchInput(event) {
    const query = event.target.value;

    state.searchQuery = query;

    const clearButton = $(
      '[data-dashboard-action="clear-search"]'
    );

    if (clearButton) {
      clearButton.hidden = !query;
    }

    renderSearchSuggestions(query);
  }

  /**
   * Menangani tombol keyboard pada pencarian.
   */
  function handleSearchKeydown(event) {
    if (event.key === 'Escape') {
      closeSearchSuggestions();
      return;
    }

    if (event.key === 'Enter') {
      const firstResult = $(
        '[data-dashboard-search-feature]',
        state.elements.searchSuggestions
      );

      if (firstResult) {
        event.preventDefault();

        openFeatureById(
          firstResult.dataset.dashboardSearchFeature
        );
      }
    }
  }

  /**
   * Menangani seluruh klik di dalam dashboard.
   * Event delegation mencegah listener ganda
   * pada setiap kartu.
   */
  function handleDashboardClick(event) {
    const target = event.target;

    if (!(target instanceof Element)) return;

    const actionElement = target.closest(
      '[data-dashboard-action]'
    );

    const searchFeatureElement = target.closest(
      '[data-dashboard-search-feature]'
    );

    const featureElement = target.closest(
      '[data-dashboard-feature]'
    );

    if (
      actionElement &&
      state.root.contains(actionElement)
    ) {
      const action = actionElement.dataset.dashboardAction;

      switch (action) {
        case 'clear-search': {
          if (state.elements.search) {
            state.elements.search.value = '';
            state.elements.search.focus();
          }

          state.searchQuery = '';
          closeSearchSuggestions();
          renderSearchSuggestions('');
          break;
        }

        case 'dismiss-toast':
          dismissToast();
          break;

        case 'notifications':
          emit('kantoong:notifications-open', {
            source: 'dashboard'
          });
          showToast('Pusat notifikasi belum dihubungkan.');
          break;

        case 'profile':
          openFeatureById('profile');
          break;

        case 'view-all-summary':
          openFeatureById('analytics');
          break;

        case 'customize':
          emit('kantoong:dashboard-customize-request', {
            source: 'dashboard'
          });
          showToast('Pengaturan kustomisasi akan dihubungkan berikutnya.');
          break;

        case 'open-ai':
          openFeatureById('ai-history');
          break;

        case 'promos':
          openFeatureById('promos');
          break;

        case 'history':
          openFeatureById('history');
          break;

        default:
          emit('kantoong:dashboard-action', {
            action,
            source: 'dashboard'
          });
          break;
      }

      return;
    }

    if (
      searchFeatureElement &&
      state.root.contains(searchFeatureElement)
    ) {
      openFeatureById(
        searchFeatureElement.dataset.dashboardSearchFeature
      );
      return;
    }

    if (
      featureElement &&
      state.root.contains(featureElement)
    ) {
      openFeatureById(
        featureElement.dataset.dashboardFeature
      );
    }
  }

  /**
   * Menghubungkan event input dan klik.
   */
  function bindDashboardEvents() {
    if (!state.root) return;

    if (state.eventController) {
      state.eventController.abort();
    }

    state.eventController = new AbortController();

    const options = {
      signal: state.eventController.signal
    };

    state.root.addEventListener(
      'click',
      handleDashboardClick,
      options
    );

    if (state.elements.search) {
      state.elements.search.addEventListener(
        'input',
        handleSearchInput,
        options
      );

      state.elements.search.addEventListener(
        'keydown',
        handleSearchKeydown,
        options
      );

      state.elements.search.addEventListener(
        'focus',
        () => {
          if (state.elements.search.value.trim()) {
            renderSearchSuggestions(
              state.elements.search.value
            );
          }
        },
        options
      );
    }

    document.addEventListener(
      'click',
      (event) => {
        if (
          state.root &&
          !state.root.contains(event.target)
        ) {
          closeSearchSuggestions();
        }
      },
      options
    );

    document.addEventListener(
      'keydown',
      (event) => {
        const isShortcut =
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === 'k';

        if (!isShortcut) return;

        if (
          !state.root ||
          !state.root.isConnected
        ) {
          return;
        }

        event.preventDefault();

        if (state.elements.search) {
          state.elements.search.focus();
        }
      },
      options
    );
  }

  // ============================================
  // BAGIAN 3/3 — INISIALISASI DAN API PUBLIK
  // ============================================

  /**
   * Memasang shortcut Ctrl+K / Cmd+K.
   * Shortcut difokuskan ke pencarian dashboard.
   */
  function focusSearch() {
    const input = state.elements.search;

    if (!input || !state.root || !state.root.isConnected) {
      return false;
    }

    input.focus();
    input.select();

    return true;
  }

  /**
   * Memperbarui elemen dashboard setelah registry
   * atau data fitur berubah.
   */
  function refresh() {
    if (!state.root) {
      return {
        ok: false,
        code: 'DASHBOARD_NOT_FOUND'
      };
    }

    cacheElements();
    renderRecentActivity();

    if (state.searchQuery) {
      renderSearchSuggestions(state.searchQuery);
    }

    emit('kantoong:dashboard-refreshed', {
      featureCount: getRegisteredFeatures().length
    });

    return {
      ok: true,
      code: 'DASHBOARD_REFRESHED'
    };
  }

  /**
   * Memulai dashboard.
   */
  function init() {
    if (state.initialized) {
      return {
        ok: true,
        code: 'ALREADY_INITIALIZED'
      };
    }

    const root = document.querySelector(SELECTORS.root);

    if (!root) {
      console.warn(
        `${MODULE} Elemen ${SELECTORS.root} tidak ditemukan.`
      );

      return {
        ok: false,
        code: 'DASHBOARD_ROOT_NOT_FOUND'
      };
    }

    state.root = root;

    cacheElements();
    bindDashboardEvents();
    renderRecentActivity();

    state.initialized = true;

    emit('kantoong:dashboard-ready', {
      featureCount: getRegisteredFeatures().length
    });

    console.info(`${MODULE} Dashboard berhasil diinisialisasi.`);

    return {
      ok: true,
      code: 'INITIALIZED'
    };
  }

  /**
   * Membersihkan listener dan timer.
   * Dipakai jika dashboard perlu dilepas atau dipasang ulang.
   */
  function destroy() {
    if (state.eventController) {
      state.eventController.abort();
      state.eventController = null;
    }

    if (state.toastTimer) {
      window.clearTimeout(state.toastTimer);
      state.toastTimer = null;
    }

    state.initialized = false;
    state.root = null;
    state.elements = {};
    state.searchQuery = '';

    console.info(`${MODULE} Listener dashboard dibersihkan.`);

    return {
      ok: true,
      code: 'DESTROYED'
    };
  }

  /**
   * Mengambil snapshot status tanpa membocorkan
   * referensi state internal yang bisa diubah.
   */
  function getStatus() {
    return Object.freeze({
      initialized: state.initialized,
      rootAvailable: Boolean(
        state.root && state.root.isConnected
      ),
      registeredFeatureCount: getRegisteredFeatures().length,
      recentActivityCount: state.recentActivity.length
    });
  }

  /**
   * Mengambil salinan riwayat aktivitas sesi.
   */
  function getRecentActivity() {
    return state.recentActivity.map((activity) => ({
      id: activity.id,
      title: activity.title,
      timestamp: activity.timestamp
    }));
  }

  /**
   * Membuka fitur melalui API dashboard.
   */
  function openFeature(featureId) {
    if (!state.initialized) {
      return {
        ok: false,
        code: 'DASHBOARD_NOT_INITIALIZED'
      };
    }

    const success = openFeatureById(featureId);

    return {
      ok: success,
      code: success ? 'FEATURE_DISPATCHED' : 'FEATURE_DISPATCH_FAILED',
      featureId: String(featureId ?? '')
    };
  }

  /**
   * API publik dashboard.
   */
  window.KantoongDashboard = Object.freeze({
    init,
    refresh,
    destroy,
    focusSearch,
    openFeature,
    showToast,
    dismissToast,
    getStatus,
    getRecentActivity,
    getFeatures: getRegisteredFeatures
  });

  /**
   * Pasang saat DOM siap.
   *
   * Jika file dimuat setelah DOMContentLoaded,
   * init langsung dipanggil.
   */
  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        window.KantoongDashboard?.init();
      },
      { once: true }
    );
  } else {
    window.KantoongDashboard.init();
  }

})();

