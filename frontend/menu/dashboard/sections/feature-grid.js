/* =========================================================
   KANTOONG CORE
   Section : Feature Grid
   File    : feature-grid.js
   Part 1/3 — Configuration, defaults, and helpers
   ========================================================= */

(function (window, document) {
    "use strict";

    // Hindari registrasi modul berulang.
    if (window.KantoongFeatureGrid) {
        return;
    }

    const MODULE_NAME = "KantoongFeatureGrid";
    const EVENT_PREFIX = "kantoong:feature-grid:";

    const DEFAULTS = Object.freeze({
        title: "Ringkasan Fitur",
        subtitle: "Akses aktivitas dan layanan bisnis Anda.",
        features: [],
        columns: "auto",
        showHeader: true,
        showDescription: true,
        showStatus: true,
        showSearch: false,
        showDisabled: false,
        emptyMessage: "Belum ada fitur yang ditampilkan.",
        searchPlaceholder: "Cari fitur...",
        itemLabel: "Buka fitur"
    });

    let currentTarget = null;
    let currentElement = null;
    let currentData = { ...DEFAULTS };
    let searchQuery = "";

    const ALLOWED_STATUSES = new Set([
        "active",
        "pending",
        "inactive",
        "coming-soon"
    ]);

    function cleanText(value, fallback) {
        if (typeof value !== "string") {
            return fallback || "";
        }

        const text = value.trim();
        return text || fallback || "";
    }

    function normalizeStatus(status) {
        return ALLOWED_STATUSES.has(status)
            ? status
            : "active";
    }

    function normalizeFeature(feature, index) {
        const item = feature && typeof feature === "object"
            ? feature
            : {};

        const id = cleanText(
            item.id,
            "feature-" + (index + 1)
        );

        return {
            id: id,
            title: cleanText(item.title, "Fitur"),
            description: cleanText(item.description, ""),
            icon: cleanText(item.icon, "◇"),
            category: cleanText(item.category, ""),
            status: normalizeStatus(item.status),
            summary: cleanText(item.summary, ""),
            metric: cleanText(item.metric, ""),
            metricLabel: cleanText(item.metricLabel, ""),
            enabled: item.enabled !== false,
            progress: normalizeProgress(item.progress),
            actionLabel: cleanText(
                item.actionLabel,
                DEFAULTS.itemLabel
            )
        };
    }

    function normalizeProgress(value) {
        if (typeof value !== "number" || !Number.isFinite(value)) {
            return null;
        }

        return Math.max(0, Math.min(100, value));
    }

    function normalizeFeatures(features) {
        if (!Array.isArray(features)) {
            return [];
        }

        const seen = new Set();

        return features
            .map(normalizeFeature)
            .filter(function (feature) {
                if (seen.has(feature.id)) {
                    return false;
                }

                seen.add(feature.id);
                return true;
            });
    }

    function normalizeData(options) {
        const input = options && typeof options === "object"
            ? options
            : {};

        const merged = {
            ...DEFAULTS,
            ...input
        };

        merged.title = cleanText(
            merged.title,
            DEFAULTS.title
        );

        merged.subtitle = cleanText(
            merged.subtitle,
            DEFAULTS.subtitle
        );

        merged.emptyMessage = cleanText(
            merged.emptyMessage,
            DEFAULTS.emptyMessage
        );

        merged.searchPlaceholder = cleanText(
            merged.searchPlaceholder,
            DEFAULTS.searchPlaceholder
        );

        merged.features = normalizeFeatures(merged.features);

        merged.showHeader = merged.showHeader !== false;
        merged.showDescription = merged.showDescription !== false;
        merged.showStatus = merged.showStatus !== false;
        merged.showSearch = merged.showSearch === true;
        merged.showDisabled = merged.showDisabled === true;

        return merged;
    }

    function createElement(tag, className, text) {
        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== undefined && text !== null) {
            element.textContent = String(text);
        }

        return element;
    }

    function dispatchEvent(eventName, detail) {
        try {
            window.dispatchEvent(
                new CustomEvent(EVENT_PREFIX + eventName, {
                    detail: detail || {}
                })
            );
        } catch (error) {
            // Event tidak boleh membuat dashboard gagal dirender.
        }
    }

    function resolveTarget(target) {
        if (typeof target === "string") {
            return document.querySelector(target);
        }

        if (target && target.nodeType === 1) {
            return target;
        }

        return null;
    }

    function getStatusLabel(status) {
        const labels = {
            active: "Tersedia",
            pending: "Perlu ditinjau",
            inactive: "Nonaktif",
            "coming-soon": "Segera hadir"
        };

        return labels[status] || "Tersedia";
    }

    function getVisibleFeatures() {
        const query = searchQuery.toLocaleLowerCase("id-ID");

        return currentData.features.filter(function (feature) {
            if (!currentData.showDisabled && !feature.enabled) {
                return false;
            }

            if (!query) {
                return true;
            }

            const searchableText = [
                feature.title,
                feature.description,
                feature.category,
                feature.summary,
                feature.metricLabel
            ].join(" ").toLocaleLowerCase("id-ID");

            return searchableText.includes(query);
        });
    }

    /* =========================================================
   Part 2/3 — Header, feature cards, and rendering
   ========================================================= */

    function buildHeader() {
        const header = createElement("div", "fg-header");
        const headingGroup = createElement("div", "fg-heading-group");

        const title = createElement(
            "h2",
            "fg-title",
            currentData.title
        );

        const subtitle = createElement(
            "p",
            "fg-subtitle",
            currentData.subtitle
        );

        headingGroup.appendChild(title);
        headingGroup.appendChild(subtitle);
        header.appendChild(headingGroup);

        if (currentData.showSearch) {
            const searchWrap = createElement("div", "fg-search-wrap");
            const searchLabel = createElement(
                "label",
                "fg-search-label",
                "Cari fitur"
            );

            const search = createElement("input", "fg-search");

            search.type = "search";
            search.placeholder = currentData.searchPlaceholder;
            search.value = searchQuery;
            search.autocomplete = "off";
            search.setAttribute("aria-label", "Cari fitur dashboard");

            searchLabel.appendChild(search);
            searchWrap.appendChild(searchLabel);
            header.appendChild(searchWrap);

            search.addEventListener("input", function () {
                const nextQuery = search.value;
                const cursorPosition = search.selectionStart;

                searchQuery = nextQuery;
                renderWithInteractions();

                // Pertahankan fokus saat grid diperbarui.
                if (currentElement) {
                    const nextInput = currentElement.querySelector(
                        ".fg-search"
                    );

                    if (nextInput) {
                        nextInput.focus();

                        try {
                            nextInput.setSelectionRange(
                                cursorPosition,
                                cursorPosition
                            );
                        } catch (error) {
                            // Beberapa browser tidak mendukung selection range
                            // untuk seluruh tipe input.
                        }
                    }
                }
            });
        }

        return header;
    }

    function buildFeatureCard(feature) {
        const card = createElement("button", "fg-card");

        card.type = "button";
        card.setAttribute("data-feature-id", feature.id);
        card.setAttribute("aria-label", feature.actionLabel);

        if (!feature.enabled) {
            card.disabled = true;
            card.setAttribute("aria-disabled", "true");
            card.classList.add("is-disabled");
        }

        const top = createElement("div", "fg-card-top");
        const iconBox = createElement("span", "fg-icon", feature.icon);

        iconBox.setAttribute("aria-hidden", "true");

        top.appendChild(iconBox);

        if (currentData.showStatus) {
            const status = createElement(
                "span",
                "fg-status fg-status--" + feature.status,
                getStatusLabel(feature.status)
            );

            top.appendChild(status);
        }

        const content = createElement("div", "fg-card-content");

        const title = createElement(
            "h3",
            "fg-card-title",
            feature.title
        );

        content.appendChild(title);

        if (currentData.showDescription && feature.description) {
            content.appendChild(
                createElement(
                    "p",
                    "fg-card-description",
                    feature.description
                )
            );
        }

        if (feature.summary) {
            content.appendChild(
                createElement("p", "fg-card-summary", feature.summary)
            );
        }

        if (feature.metric || feature.metricLabel) {
            const metric = createElement("div", "fg-metric");

            if (feature.metric) {
                metric.appendChild(
                    createElement("strong", "fg-metric-value", feature.metric)
                );
            }

            if (feature.metricLabel) {
                metric.appendChild(
                    createElement("span", "fg-metric-label", feature.metricLabel)
                );
            }

            content.appendChild(metric);
        }

        if (feature.progress !== null) {
            const progressGroup = createElement("div", "fg-progress-group");
            const progressTrack = createElement("div", "fg-progress-track");
            const progressBar = createElement("span", "fg-progress-bar");

            progressTrack.setAttribute("role", "progressbar");
            progressTrack.setAttribute("aria-valuemin", "0");
            progressTrack.setAttribute("aria-valuemax", "100");
            progressTrack.setAttribute(
                "aria-valuenow",
                String(feature.progress)
            );
            progressTrack.setAttribute(
                "aria-label",
                "Progress " + feature.title
            );

            progressBar.style.width = feature.progress + "%";
            progressTrack.appendChild(progressBar);
            progressGroup.appendChild(progressTrack);

            progressGroup.appendChild(
                createElement(
                    "span",
                    "fg-progress-label",
                    feature.progress + "%"
                )
            );

            content.appendChild(progressGroup);
        }

        const footer = createElement("div", "fg-card-footer");

        if (feature.category) {
            footer.appendChild(
                createElement("span", "fg-category", feature.category)
            );
        } else {
            footer.appendChild(createElement("span", "fg-category", " "));
        }

        const arrow = createElement("span", "fg-arrow", "↗");
        arrow.setAttribute("aria-hidden", "true");
        footer.appendChild(arrow);

        card.appendChild(top);
        card.appendChild(content);
        card.appendChild(footer);

        return card;
    }

    function buildGrid() {
        const grid = createElement("div", "fg-grid");

        grid.setAttribute("role", "list");
        grid.setAttribute("aria-label", "Daftar ringkasan fitur");

        if (
            currentData.columns === 2 ||
            currentData.columns === 3 ||
            currentData.columns === 4
        ) {
            grid.setAttribute(
                "data-columns",
                String(currentData.columns)
            );
        } else {
            grid.setAttribute("data-columns", "auto");
        }

        const features = getVisibleFeatures();

        if (features.length === 0) {
            const empty = createElement(
                "div",
                "fg-empty",
                currentData.emptyMessage
            );

            empty.setAttribute("role", "status");
            grid.appendChild(empty);
            return grid;
        }

        features.forEach(function (feature) {
            const wrapper = createElement("div", "fg-grid-item");
            wrapper.setAttribute("role", "listitem");
            wrapper.appendChild(buildFeatureCard(feature));
            grid.appendChild(wrapper);
        });

        return grid;
    }

    function buildSection() {
        const section = createElement("section", "fg-section");

        section.setAttribute("data-component", "feature-grid");
        section.setAttribute("aria-label", currentData.title);

        if (currentData.showHeader) {
            section.appendChild(buildHeader());
        }

        section.appendChild(buildGrid());

        return section;
    }

    function render() {
        if (!currentTarget) {
            return null;
        }

        const nextElement = buildSection();

        if (currentElement && currentElement.parentNode) {
            currentElement.parentNode.replaceChild(
                nextElement,
                currentElement
            );
        } else {
            currentTarget.appendChild(nextElement);
        }

        currentElement = nextElement;

        dispatchEvent("rendered", {
            count: getVisibleFeatures().length,
            total: currentData.features.length,
            element: currentElement
        });

        return currentElement;
    }

    /* =========================================================
   Part 3/3 — Interaction, public API, and registration
   ========================================================= */

    function attachInteractions(section) {
        section.addEventListener("click", function (event) {
            const card = event.target.closest("[data-feature-id]");

            if (!card || !section.contains(card) || card.disabled) {
                return;
            }

            const featureId = card.getAttribute("data-feature-id");

            const feature = currentData.features.find(function (item) {
                return item.id === featureId;
            });

            if (!feature || !feature.enabled) {
                return;
            }

            const detail = {
                id: feature.id,
                feature: { ...feature }
            };

            dispatchEvent("select", detail);

            if (typeof currentData.onFeatureSelect === "function") {
                currentData.onFeatureSelect(detail);
            }
        });
    }

    function renderWithInteractions() {
        const element = render();

        if (element) {
            attachInteractions(element);
        }

        return element;
    }

    function mount(target, options) {
        const resolvedTarget = resolveTarget(target);

        if (!resolvedTarget) {
            console.warn(
                "[KantoongFeatureGrid] Target tidak ditemukan."
            );

            return null;
        }

        if (
            currentElement &&
            currentElement.parentNode &&
            currentTarget !== resolvedTarget
        ) {
            currentElement.parentNode.removeChild(currentElement);
            currentElement = null;
        }

        currentTarget = resolvedTarget;
        currentData = normalizeData(options);
        searchQuery = "";

        return renderWithInteractions();
    }

    function update(options) {
        if (!currentTarget) {
            console.warn(
                "[KantoongFeatureGrid] Panggil mount() sebelum update()."
            );

            return null;
        }

        const input = options && typeof options === "object"
            ? options
            : {};

        currentData = normalizeData({
            ...currentData,
            ...input,
            features: Object.prototype.hasOwnProperty.call(
                input,
                "features"
            )
                ? input.features
                : currentData.features
        });

        return renderWithInteractions();
    }

    function setFeatures(features) {
        return update({ features: features });
    }

    function setFeatureEnabled(featureId, enabled) {
        const nextFeatures = currentData.features.map(function (feature) {
            if (feature.id !== featureId) {
                return feature;
            }

            return {
                ...feature,
                enabled: enabled === true
            };
        });

        return setFeatures(nextFeatures);
    }

    function getFeatures() {
        return currentData.features.map(function (feature) {
            return { ...feature };
        });
    }

    function getElement() {
        return currentElement;
    }

    function getData() {
        return {
            ...currentData,
            features: getFeatures()
        };
    }

    function destroy() {
        if (currentElement && currentElement.parentNode) {
            currentElement.parentNode.removeChild(currentElement);
        }

        currentTarget = null;
        currentElement = null;
        currentData = { ...DEFAULTS };
        searchQuery = "";

        dispatchEvent("destroyed");
    }

    window[MODULE_NAME] = Object.freeze({
        mount: mount,
        update: update,
        setFeatures: setFeatures,
        setFeatureEnabled: setFeatureEnabled,
        getFeatures: getFeatures,
        getData: getData,
        getElement: getElement,
        destroy: destroy
    });

})(window, document);