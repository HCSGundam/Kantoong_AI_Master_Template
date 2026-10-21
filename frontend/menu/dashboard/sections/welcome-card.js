
/* =========================================================
   KANTOONG CORE
   Section : Welcome Card
   File    : welcome-card.js
   Part 1/3 — Configuration, defaults, and helpers
   ========================================================= */

(function (window, document) {
    "use strict";

    // Hindari registrasi modul berulang.
    if (window.KantoongWelcomeCard) {
        return;
    }

    const MODULE_NAME = "KantoongWelcomeCard";
    const EVENT_PREFIX = "kantoong:welcome-card:";

    const DEFAULTS = Object.freeze({
        userName: "Pengguna",
        businessName: "Bisnis Anda",
        eyebrow: "KANTOONG CORE",
        subtitle: "Semua aktivitas bisnis, dalam satu tempat.",
        aiStatus: "Belum terhubung",
        showBusinessName: true,
        showAIStatus: true,
        showDate: true
    });

    let currentTarget = null;
    let currentElement = null;
    let currentData = { ...DEFAULTS };

    function normalizeData(data) {
        const input = data && typeof data === "object"
            ? data
            : {};

        return {
            ...DEFAULTS,
            ...input,
            userName: cleanText(input.userName, DEFAULTS.userName),
            businessName: cleanText(
                input.businessName,
                DEFAULTS.businessName
            ),
            eyebrow: cleanText(input.eyebrow, DEFAULTS.eyebrow),
            subtitle: cleanText(input.subtitle, DEFAULTS.subtitle),
            aiStatus: cleanText(input.aiStatus, DEFAULTS.aiStatus),
            showBusinessName: input.showBusinessName !== false,
            showAIStatus: input.showAIStatus !== false,
            showDate: input.showDate !== false
        };
    }

    function cleanText(value, fallback) {
        if (typeof value !== "string") {
            return fallback;
        }

        const result = value.trim();
        return result || fallback;
    }

    function createElement(tag, className, text) {
        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== undefined && text !== null) {
            // Gunakan textContent agar teks data tidak dieksekusi
            // sebagai HTML.
            element.textContent = String(text);
        }

        return element;
    }

    function getGreeting(date) {
        const hour = date.getHours();

        if (hour >= 4 && hour < 11) {
            return "Selamat pagi";
        }

        if (hour >= 11 && hour < 15) {
            return "Selamat siang";
        }

        if (hour >= 15 && hour < 18) {
            return "Selamat sore";
        }

        return "Selamat malam";
    }

    function getFormattedDate(date) {
        try {
            return new Intl.DateTimeFormat("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            }).format(date);
        } catch (error) {
            return "";
        }
    }

    function dispatchEvent(eventName, detail) {
        let event;

        try {
            event = new CustomEvent(EVENT_PREFIX + eventName, {
                detail: detail || {}
            });
        } catch (error) {
            return;
        }

        window.dispatchEvent(event);
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

    
/* =========================================================
   Part 2/3 — Build the welcome card
   ========================================================= */

    function buildCard(data) {
        const now = new Date();

        const card = createElement(
            "section",
            "wc-card"
        );

        card.setAttribute("data-component", "welcome-card");
        card.setAttribute("aria-label", "Sambutan dashboard");

        // Header
        const header = createElement("div", "wc-header");

        const brand = createElement(
            "div",
            "wc-brand",
            data.eyebrow
        );

        const brandMark = createElement(
            "span",
            "wc-brand-mark",
            "K"
        );

        brandMark.setAttribute("aria-hidden", "true");

        const brandLabel = createElement(
            "span",
            "wc-brand-label",
            data.eyebrow
        );

        brand.appendChild(brandMark);
        brand.appendChild(brandLabel);

        const headerRight = createElement(
            "div",
            "wc-header-right"
        );

        if (data.showDate) {
            const dateLabel = createElement(
                "time",
                "wc-date",
                getFormattedDate(now)
            );

            dateLabel.dateTime = now.toISOString();
            headerRight.appendChild(dateLabel);
        }

        header.appendChild(brand);
        header.appendChild(headerRight);

        // Main welcome content
        const content = createElement("div", "wc-content");

        const greeting = createElement(
            "p",
            "wc-greeting",
            getGreeting(now)
        );

        const title = createElement(
            "h2",
            "wc-title",
            data.userName
        );

        title.setAttribute("data-wc-field", "userName");

        const subtitle = createElement(
            "p",
            "wc-subtitle",
            data.subtitle
        );

        content.appendChild(greeting);
        content.appendChild(title);
        content.appendChild(subtitle);

        // Footer information
        const footer = createElement("div", "wc-footer");

        if (data.showBusinessName) {
            const business = createElement(
                "div",
                "wc-business"
            );

            const businessLabel = createElement(
                "span",
                "wc-meta-label",
                "BISNIS"
            );

            const businessName = createElement(
                "span",
                "wc-business-name",
                data.businessName
            );

            businessName.setAttribute(
                "data-wc-field",
                "businessName"
            );

            business.appendChild(businessLabel);
            business.appendChild(businessName);
            footer.appendChild(business);
        }

        if (data.showAIStatus) {
            const status = createElement(
                "div",
                "wc-ai-status"
            );

            const statusDot = createElement(
                "span",
                "wc-status-dot"
            );

            statusDot.setAttribute("aria-hidden", "true");

            const statusText = createElement(
                "span",
                "wc-status-text",
                data.aiStatus
            );

            statusText.setAttribute(
                "data-wc-field",
                "aiStatus"
            );

            status.appendChild(statusDot);
            status.appendChild(statusText);
            footer.appendChild(status);
        }

        card.appendChild(header);
        card.appendChild(content);

        if (footer.childNodes.length > 0) {
            card.appendChild(footer);
        }

        return card;
    }

    function render() {
        if (!currentTarget) {
            return null;
        }

        const nextElement = buildCard(currentData);

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
            data: { ...currentData },
            element: currentElement
        });

        return currentElement;
    }

    
/* =========================================================
   Part 3/3 — Public API and module registration
   ========================================================= */

    function mount(target, data) {
        const resolvedTarget = resolveTarget(target);

        if (!resolvedTarget) {
            console.warn(
                "[KantoongWelcomeCard] Target tidak ditemukan."
            );

            return null;
        }

        // Jika dipindahkan ke target baru, bersihkan instance
        // sebelumnya terlebih dahulu.
        if (
            currentElement &&
            currentElement.parentNode &&
            currentTarget !== resolvedTarget
        ) {
            currentElement.parentNode.removeChild(currentElement);
            currentElement = null;
        }

        currentTarget = resolvedTarget;
        currentData = normalizeData(data);

        return render();
    }

    function update(data) {
        if (!currentTarget) {
            console.warn(
                "[KantoongWelcomeCard] Panggil mount() sebelum update()."
            );

            return null;
        }

        // Data parsial mempertahankan konfigurasi sebelumnya.
        currentData = normalizeData({
            ...currentData,
            ...(data && typeof data === "object" ? data : {})
        });

        return render();
    }

    function destroy() {
        if (currentElement && currentElement.parentNode) {
            currentElement.parentNode.removeChild(currentElement);
        }

        currentTarget = null;
        currentElement = null;
        currentData = { ...DEFAULTS };

        dispatchEvent("destroyed");
    }

    function getData() {
        return { ...currentData };
    }

    function getElement() {
        return currentElement;
    }

    window[MODULE_NAME] = Object.freeze({
        mount,
        update,
        destroy,
        getData,
        getElement
    });

})(window, document);
