/**
 * auth.js — Module xử lý xác thực người dùng và Theme sáng tối
 *
 * Lưu phiên đăng nhập trong localStorage với key "elearn_user".
 * Quản lý theme sáng/tối tự động trên toàn hệ thống.
 */

const AUTH_KEY = "elearn_user";

// ============================================================
// LIGHT / DARK THEME MANAGEMENT
// ============================================================

const LIGHT_THEME_CSS = `
    body.light-theme {
        --bg-base: #f8fafc;
        --bg-card: #ffffff;
        --glass-border: #cbd5e1;
        --text-primary: #0f172a;
        --text-muted: #64748b;
        --bg-sidebar: #f1f5f9;
        --tab-active-bg: rgba(99,102,241,0.08);
        background: #f8fafc !important;
        color: #0f172a !important;
    }
    body.light-theme .main-nav {
        background: rgba(248, 250, 252, 0.95) !important;
        border-bottom: 1px solid #cbd5e1 !important;
    }
    body.light-theme .navbar-brand {
        color: #0f172a !important;
    }
    body.light-theme .main-nav .text-white,
    body.light-theme #navbar-user,
    body.light-theme #navbar-user a,
    body.light-theme #navbar-user span:not(.badge),
    body.light-theme #navbar-user button {
        color: #0f172a !important;
    }
    body.light-theme .btn-back {
        color: #64748b !important;
    }
    body.light-theme .btn-back:hover {
        color: #0f172a !important;
    }
    body.light-theme .sidebar-nav {
        background: #f8fafc !important;
        border-right: 1px solid #cbd5e1 !important;
    }
    body.light-theme .sidebar-header {
        border-bottom: 1px solid #cbd5e1 !important;
    }
    body.light-theme .sidebar-header h5 {
        color: #0f172a !important;
    }
    body.light-theme .sidebar-lesson-item {
        border-bottom: 1px solid #f1f5f9 !important;
        color: #64748b !important;
    }
    body.light-theme .sidebar-lesson-item:hover:not(.locked-sidebar) {
        background: #f1f5f9 !important;
        color: #0f172a !important;
    }
    body.light-theme .sidebar-lesson-item.active {
        background: rgba(99, 102, 241, 0.08) !important;
        color: var(--primary) !important;
    }
    body.light-theme .workspace-header {
        background: rgba(248, 250, 252, 0.5) !important;
        border-bottom: 1px solid #cbd5e1 !important;
    }
    body.light-theme .workspace-header span.text-white {
        color: #0f172a !important;
    }
    body.light-theme .lesson-tabs {
        background: rgba(248, 250, 252, 0.6) !important;
        border-bottom: 1px solid #cbd5e1 !important;
    }
    body.light-theme .tab-btn:hover {
        color: #0f172a !important;
    }
    body.light-theme .step-card,
    body.light-theme .panel-card,
    body.light-theme .content-panel,
    body.light-theme .quiz-question,
    body.light-theme .quiz-builder-card,
    body.light-theme .stat-summary-card,
    body.light-theme .data-table-wrapper {
        background: #ffffff !important;
        border-color: #cbd5e1 !important;
        color: #0f172a !important;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05) !important;
    }
    body.light-theme .stat-box {
        background: #f8fafc !important;
        border-color: #cbd5e1 !important;
    }
    body.light-theme .data-table thead th {
        background: #f1f5f9 !important;
        color: #64748b !important;
        border-bottom: 1px solid #cbd5e1 !important;
    }
    body.light-theme .data-table tbody tr {
        border-bottom: 1px solid #f1f5f9 !important;
    }
    body.light-theme .data-table tbody tr:hover {
        background: #f8fafc !important;
    }
    body.light-theme .modal-content {
        background: #ffffff !important;
        border-color: #cbd5e1 !important;
        color: #0f172a !important;
    }
    body.light-theme .form-control,
    body.light-theme .form-select {
        background: #ffffff !important;
        border-color: #cbd5e1 !important;
        color: #0f172a !important;
    }
    body.light-theme .form-control:focus,
    body.light-theme .form-select:focus {
        background: #ffffff !important;
        color: #0f172a !important;
        border-color: var(--primary) !important;
    }
    body.light-theme .form-control::placeholder {
        color: #94a3b8 !important;
    }
    body.light-theme .modal-form-tabs {
        border-bottom: 1px solid #cbd5e1 !important;
    }
    body.light-theme .content-body {
        color: #334155 !important;
    }
    body.light-theme .option-label {
        background: #f8fafc !important;
        border-color: #e2e8f0 !important;
        color: #334155 !important;
    }
    body.light-theme .option-label:hover {
        background: rgba(99, 102, 241, 0.05) !important;
    }
    body.light-theme .quiz-result {
        background: rgba(99, 102, 241, 0.05) !important;
        border-color: rgba(99, 102, 241, 0.2) !important;
    }
    body.light-theme .btn-outline-light {
        color: #0f172a !important;
        border-color: #cbd5e1 !important;
    }
    body.light-theme .btn-outline-light:hover {
        background: #f1f5f9 !important;
    }
    body.light-theme .card-title-custom {
        color: #0f172a !important;
    }
    body.light-theme .roadmap-line {
        background: rgba(15, 23, 42, 0.08) !important;
    }
`;

function injectLightThemeCSS() {
    let styleEl = document.getElementById("global-light-theme-style");
    if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "global-light-theme-style";
        styleEl.innerHTML = LIGHT_THEME_CSS;
        document.head.appendChild(styleEl);
    }
}

function removeLightThemeCSS() {
    const styleEl = document.getElementById("global-light-theme-style");
    if (styleEl) styleEl.remove();
}

function initTheme() {
    const savedTheme = localStorage.getItem("theme") || "dark";
    if (savedTheme === "light") {
        document.body.classList.add("light-theme");
        injectLightThemeCSS();
    } else {
        document.body.classList.remove("light-theme");
        removeLightThemeCSS();
    }
    updateThemeToggleUI();
}

function toggleTheme() {
    const current = localStorage.getItem("theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem("theme", next);
    
    if (next === "light") {
        document.body.classList.add("light-theme");
        injectLightThemeCSS();
    } else {
        document.body.classList.remove("light-theme");
        removeLightThemeCSS();
    }
    updateThemeToggleUI();
}

function updateThemeToggleUI() {
    const btn = document.getElementById("btn-theme-toggle");
    if (!btn) return;
    const current = localStorage.getItem("theme") || "dark";
    if (current === "light") {
        btn.innerHTML = '<i class="bi bi-moon-fill" title="Chuyển sang chế độ Tối"></i>';
    } else {
        btn.innerHTML = '<i class="bi bi-sun-fill" title="Chuyển sang chế độ Sáng"></i>';
    }
}

// Khởi chạy Theme ngay lập tức trước khi tải trang hoàn toàn
(function() {
    const savedTheme = localStorage.getItem("theme") || "dark";
    if (savedTheme === "light") {
        if (document.body) {
            document.body.classList.add("light-theme");
            injectLightThemeCSS();
        } else {
            window.addEventListener("DOMContentLoaded", () => {
                document.body.classList.add("light-theme");
                injectLightThemeCSS();
            });
        }
    }
})();

// ============================================================
// SESSION MANAGEMENT
// ============================================================

function getCurrentUser() {
    try {
        const raw = localStorage.getItem(AUTH_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function saveSession(userData) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(userData));
}

// ============================================================
// DYNAMIC PATH PREFIX HELPERS
// ============================================================

function getBasePrefix() {
    // If the path contains "pages/", we are inside the /pages/ folder.
    // Otherwise, we are at the root directory.
    const inPages = window.location.pathname.includes("/pages/");
    return {
        pages: inPages ? "" : "pages/",
        root: inPages ? "../" : ""
    };
}

// ============================================================
// GUARD FUNCTIONS
// ============================================================

function checkLogin() {
    const user = getCurrentUser();
    if (!user) {
        window.location.replace(getBasePrefix().pages + "login.html");
        return null;
    }
    return user;
}

function checkAdmin() {
    const user = checkLogin();
    if (!user) return null;
    if (user.role !== "admin") {
        console.warn(`[AUTH] User "${user.username}" cố truy cập trang admin.`);
        window.location.replace(getBasePrefix().root + "index.html");
        return null;
    }
    return user;
}

function checkTeacher() {
    const user = checkLogin();
    if (!user) return null;
    if (user.role !== "teacher" && user.role !== "admin") {
        console.warn(`[AUTH] User "${user.username}" cố truy cập trang giáo viên.`);
        window.location.replace(getBasePrefix().root + "index.html");
        return null;
    }
    return user;
}

function logout() {
    localStorage.removeItem(AUTH_KEY);
    window.location.replace(getBasePrefix().pages + "login.html");
}

// ============================================================
// UI RENDERING
// ============================================================

function renderNavbarUser() {
    const user = getCurrentUser();
    const el = document.getElementById("navbar-user");
    if (!el) return;

    const prefixes = getBasePrefix();

    if (!user) {
        // Chưa đăng nhập: hiển thị nút Đăng nhập và nút Theme
        el.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <button class="btn btn-sm btn-icon border-0 text-white" id="btn-theme-toggle" onclick="toggleTheme()" style="background:transparent; font-size:1.1rem">
                    <i class="bi bi-sun-fill"></i>
                </button>
                <a href="${prefixes.pages}login.html" class="btn btn-sm btn-outline-light px-3">
                    <i class="bi bi-box-arrow-in-right me-1"></i> Đăng nhập
                </a>
            </div>
        `;
        updateThemeToggleUI();
        return;
    }

    let roleBadge = "";
    if (user.role === "admin") {
        roleBadge = `<span class="badge rounded-pill ms-1" style="background:var(--accent-gold);color:#1a1a2e">ADMIN</span>`;
    } else if (user.role === "teacher") {
        roleBadge = `<span class="badge rounded-pill ms-1 bg-warning text-dark">Giáo viên</span>`;
    } else {
        roleBadge = `<span class="badge rounded-pill bg-info text-dark ms-1">Học viên</span>`;
    }

    let adminLink = "";
    if (user.role === "admin") {
        adminLink = `<a href="${prefixes.pages}admin.html" class="btn btn-sm btn-outline-warning me-2">
               <i class="bi bi-gear-fill"></i> Quản trị
           </a>`;
    } else if (user.role === "teacher") {
        adminLink = `<a href="${prefixes.pages}teacher.html" class="btn btn-sm btn-outline-warning me-2">
               <i class="bi bi-person-workspace"></i> Giảng dạy
           </a>`;
    }

    // Xử lý avatar preset hoặc avatar tải lên
    const presetEmojis = {
        preset1: "🧑‍🎓",
        preset2: "🧑‍🏫",
        preset3: "🧑‍💻",
        preset4: "🦊",
        preset5: "🦁",
        preset6: "🐼"
    };

    let avatarHtml = "";
    if (user.avatar && user.avatar.startsWith("data:image/")) {
        // Avatar upload (Base64)
        avatarHtml = `<img src="${user.avatar}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.2)" class="me-1">`;
    } else if (user.avatar && presetEmojis[user.avatar]) {
        // Avatar preset
        avatarHtml = `<div style="width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 14px" class="me-1">${presetEmojis[user.avatar]}</div>`;
    } else {
        // Mặc định initials avatar
        const firstLetter = (user.name || user.username || "?")[0].toUpperCase();
        avatarHtml = `<div style="width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), var(--accent)); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #fff; border: 1px solid rgba(255,255,255,0.1)" class="me-1">${firstLetter}</div>`;
    }

    el.innerHTML = `
        <div class="d-flex align-items-center gap-2 flex-wrap">
            <button class="btn btn-sm text-white" id="btn-theme-toggle" onclick="toggleTheme()" style="background:transparent; border:none; font-size:1.05rem; padding: 4px 8px">
                <i class="bi bi-sun-fill"></i>
            </button>
            ${adminLink}
            <div class="d-flex align-items-center gap-2">
                <a href="${prefixes.pages}profile.html" class="d-flex align-items-center text-decoration-none text-white gap-1 pe-2" style="border-right: 1px solid var(--glass-border)">
                    ${avatarHtml}
                    <span class="fw-medium d-none d-sm-inline" style="font-size:0.85rem">${user.name || user.username}</span>
                    ${roleBadge}
                </a>
            </div>
            <button class="btn btn-sm btn-outline-light" onclick="logout()" style="padding: 4px 8px; font-size: 0.8rem">
                <i class="bi bi-box-arrow-right"></i> Thoát
            </button>
        </div>
    `;
    
    updateThemeToggleUI();
}
