/**
 * config.js — Cấu hình chung toàn bộ ứng dụng E-Learning
 *
 * Backend: Supabase (PostgreSQL + PostgREST)
 *
 * Ưu điểm so với npoint.io:
 *   ✅ CRUD thực sự: GET / POST / PATCH / DELETE theo ID
 *   ✅ Filter trên server: ?userId=eq.u1
 *   ✅ Upsert native: POST với Prefer: resolution=merge-duplicates
 *   ✅ Không cần "read-modify-write", mỗi thao tác = 1 request
 *
 * Yêu cầu SQL trong Supabase (chạy 1 lần trong SQL Editor):
 * ─────────────────────────────────────────────────────────
 *   CREATE TABLE IF NOT EXISTS sessions (
 *     id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *     name        text NOT NULL,
 *     description text DEFAULT '',
 *     "isActive"  boolean DEFAULT true,
 *     created_at  timestamptz DEFAULT now()
 *   );
 *
 *   CREATE TABLE courses (
 *     id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *     title       text NOT NULL,
 *     "youtubeId" text NOT NULL,
 *     duration    integer NOT NULL,
 *     "sessionId" text DEFAULT NULL, -- Liên kết với chuyên đề
 *     "isActive"  boolean DEFAULT true,
 *     created_at  timestamptz DEFAULT now()
 *   );
 *
 *   CREATE TABLE progress (
 *     id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *     "userId"       text NOT NULL,
 *     "courseId"     text NOT NULL,
 *     "currentTime"  integer DEFAULT 0,
 *     "isCompleted"  boolean DEFAULT false,
 *     "updatedAt"    timestamptz DEFAULT now(),
 *     "homeworkImage" text DEFAULT NULL,
 *     "practiceImage" text DEFAULT NULL,
 *     "homeworkSubmitted" boolean DEFAULT false,
 *     "practiceSubmitted" boolean DEFAULT false,
 *     "quizScore"    integer DEFAULT NULL,
 *     "quizDone"     boolean DEFAULT false,
 *     "homeworkScore" integer DEFAULT NULL,
 *     "practiceScore" integer DEFAULT NULL,
 *     "teacherComment" text DEFAULT NULL,
 *     UNIQUE ("userId", "courseId")
 *   );
 *
 * *   CREATE TABLE IF NOT EXISTS users (
 *     id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *     username            text NOT NULL UNIQUE,
 *     password            text NOT NULL,
 *     name                text DEFAULT '',
 *     birthdate           text DEFAULT '',
 *     role                text DEFAULT 'user',
 *     avatar              text DEFAULT 'preset1',
 *     "bypassSequence"    boolean DEFAULT false,
 *     "enrolledSessions"  jsonb DEFAULT '[]'::jsonb,
 *     "studentId"         text DEFAULT '',
 *     created_at          timestamptz DEFAULT now()
 *   );
 *
 *   ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
 *   ALTER TABLE courses  ENABLE ROW LEVEL SECURITY;
 *   ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
 *   ALTER TABLE users    ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "Allow all" ON sessions FOR ALL USING (true) WITH CHECK (true);
 *   CREATE POLICY "Allow all" ON courses  FOR ALL USING (true) WITH CHECK (true);
 *   CREATE POLICY "Allow all" ON progress FOR ALL USING (true) WITH CHECK (true);
 *   CREATE POLICY "Allow all" ON users     FOR ALL USING (true) WITH CHECK (true);
 * ─────────────────────────────────────────────────────────
 */

// ============================================================
// SUPABASE CONFIGURATION
// ============================================================

/** URL project Supabase của bạn */
const SUPABASE_URL = "https://oqvezzdyvviqgmdudcgp.supabase.co";

/**
 * Supabase Anon Key (publishable — an toàn để dùng ở frontend).
 * Key này CHỈ có quyền theo RLS policy bạn đã cài đặt.
 */
const SUPABASE_KEY = "sb_publishable_aDudP79Gv3j9oQcKOaM_zw_NltU8n5J";

/** Base URL cho PostgREST API */
const REST_BASE = `${SUPABASE_URL}/rest/v1`;

// NPOINT users has been migrated to Supabase users table

// ============================================================
// DANH SÁCH USER FALLBACK
// Dùng khi /users API không khả dụng.
// ============================================================
const FALLBACK_USERS = [
    { id: "u1", username: "admin",  password: "admin123", role: "admin", name: "Quản Trị Viên" },
    { id: "u2", username: "user1",  password: "user123",  role: "user",  name: "Nguyễn Văn An"  },
    { id: "u3", username: "user2",  password: "user456",  role: "user",  name: "Trần Thị Bình"  },
];

// ============================================================
// SUPABASE DB — Lớp trừu tượng REST CRUD
// ============================================================

/**
 * SupabaseDB - Wrapper thuần fetch cho Supabase PostgREST API.
 *
 * Không cần @supabase/supabase-js (SDK nặng ~200KB).
 * Tất cả thao tác là 1 HTTP request duy nhất.
 *
 * Tài liệu PostgREST: https://postgrest.org/en/stable/references/api.html
 */
const SupabaseDB = {

    // ─── PRIVATE HELPERS ──────────────────────────────────────

    /** Tạo headers chuẩn cho mọi request đến Supabase */
    _headers(extra = {}) {
        return {
            "apikey":        SUPABASE_KEY,          // Xác thực với Supabase gateway
            "Authorization": `Bearer ${SUPABASE_KEY}`, // Xác thực PostgREST
            "Content-Type":  "application/json",
            ...extra,
        };
    },

    /**
     * Tạo URL với filter theo chuẩn PostgREST.
     * Ví dụ: filters = { userId: "eq.u1", limit: 1 }
     * → /rest/v1/progress?select=*&userId=eq.u1&limit=1
     */
    _url(table, filters = {}) {
        const params = new URLSearchParams();
        params.set("select", "*");
        Object.entries(filters).forEach(([k, v]) => params.set(k, String(v)));
        return `${REST_BASE}/${table}?${params}`;
    },

    // ─── READ ─────────────────────────────────────────────────

    /**
     * Lấy tất cả bản ghi trong bảng (có thể filter).
     *
     * @param {string} table   - Tên bảng ("courses", "progress", ...)
     * @param {Object} filters - Filter theo PostgREST, VD: { userId: "eq.u1" }
     * @returns {Promise<Array>}
     *
     * Ví dụ:
     *   SupabaseDB.getAll("courses")
     *   SupabaseDB.getAll("progress", { userId: "eq.u1" })
     */
    async getAll(table, filters = {}) {
        const res = await fetch(this._url(table, filters), {
            headers: this._headers(),
        });
        if (!res.ok) {
            const msg = await res.text();
            throw new Error(`[Supabase] GET ${table} lỗi ${res.status}: ${msg}`);
        }
        return res.json();
    },

    /**
     * Lấy 1 bản ghi theo UUID.
     * @param {string} table
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async getById(table, id) {
        const items = await this.getAll(table, { id: `eq.${id}`, limit: 1 });
        return items[0] || null;
    },

    /**
     * Tìm 1 bản ghi thỏa nhiều điều kiện bằng nhau.
     * @param {string} table
     * @param {Object} conditions - Ví dụ: { userId: "u1", courseId: "c1" }
     * @returns {Promise<Object|null>}
     */
    async findOne(table, conditions) {
        // Chuyển conditions thành PostgREST filter: { userId: "eq.u1", courseId: "eq.c1" }
        const filters = { limit: 1 };
        Object.entries(conditions).forEach(([k, v]) => { filters[k] = `eq.${v}`; });
        const items = await this.getAll(table, filters);
        return items[0] || null;
    },

    // ─── CREATE ───────────────────────────────────────────────

    /**
     * Tạo bản ghi mới. ID (UUID) được Supabase tự sinh.
     * @param {string} table
     * @param {Object} data
     * @returns {Promise<Object>} Bản ghi vừa tạo (có id)
     */
    async create(table, data) {
        const res = await fetch(`${REST_BASE}/${table}`, {
            method:  "POST",
            headers: this._headers({ "Prefer": "return=representation" }),
            body:    JSON.stringify(data),
        });
        if (!res.ok) {
            const msg = await res.text();
            throw new Error(`[Supabase] POST ${table} lỗi ${res.status}: ${msg}`);
        }
        const result = await res.json();
        return Array.isArray(result) ? result[0] : result;
    },

    // ─── UPDATE ───────────────────────────────────────────────

    /**
     * Cập nhật bản ghi theo id (chỉ các field được truyền, merge).
     * @param {string} table
     * @param {string} id    - UUID của bản ghi
     * @param {Object} data  - Các field cần cập nhật
     * @returns {Promise<Object>} Bản ghi sau cập nhật
     */
    async update(table, id, data) {
        const res = await fetch(`${REST_BASE}/${table}?id=eq.${encodeURIComponent(id)}`, {
            method:  "PATCH",
            headers: this._headers({ "Prefer": "return=representation" }),
            body:    JSON.stringify(data),
        });
        if (!res.ok) {
            const msg = await res.text();
            throw new Error(`[Supabase] PATCH ${table}/${id} lỗi ${res.status}: ${msg}`);
        }
        const result = await res.json();
        return Array.isArray(result) ? result[0] : result;
    },

    // ─── DELETE ───────────────────────────────────────────────

    /**
     * Xóa bản ghi theo id.
     * @param {string} table
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async delete(table, id) {
        const res = await fetch(`${REST_BASE}/${table}?id=eq.${encodeURIComponent(id)}`, {
            method:  "DELETE",
            headers: this._headers(),
        });
        if (!res.ok) {
            const msg = await res.text();
            throw new Error(`[Supabase] DELETE ${table}/${id} lỗi ${res.status}: ${msg}`);
        }
        return true;
    },

    // ─── UPSERT ───────────────────────────────────────────────

    /**
     * Insert hoặc Update dựa trên UNIQUE constraint của bảng.
     *
     * Dùng cho progress: mỗi user chỉ có đúng 1 record cho mỗi course.
     * Khi gọi: nếu (userId + courseId) đã tồn tại → UPDATE; chưa có → INSERT.
     *
     * Yêu cầu bảng có UNIQUE ("userId", "courseId").
     *
     * @param {string} table
     * @param {Object} data          - Dữ liệu đầy đủ (gồm cả conflict columns)
     * @param {string} onConflict    - Tên cột conflict, cách nhau bởi dấu phẩy
     *                                 Ví dụ: 'userId,courseId'
     * @returns {Promise<Object>}
     */
    async upsert(table, data, onConflict) {
        const url = `${REST_BASE}/${table}?on_conflict=${encodeURIComponent(onConflict)}`;
        const res = await fetch(url, {
            method:  "POST",
            headers: this._headers({
                // resolution=merge-duplicates: khi conflict → UPDATE (không phải lỗi)
                // return=representation: trả về bản ghi sau upsert
                "Prefer": "resolution=merge-duplicates,return=representation",
            }),
            body: JSON.stringify(data),
        });
        if (!res.ok) {
            const msg = await res.text();
            throw new Error(`[Supabase] UPSERT ${table} lỗi ${res.status}: ${msg}`);
        }
        const result = await res.json();
        return Array.isArray(result) ? result[0] : result;
    },
};

// ============================================================
// HÀM TIỆN ÍCH (Utilities)
// ============================================================

/** Chuyển đổi số giây → chuỗi "mm:ss" */
function formatTime(seconds) {
    if (!seconds || isNaN(seconds) || seconds < 0) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Tính phần trăm tiến độ học (0–100) */
function calcPercent(currentTime, duration) {
    if (!duration || duration === 0 || !currentTime) return 0;
    return Math.min(100, Math.round((currentTime / duration) * 100));
}

/** Format ISO date → ngày giờ Việt Nam */
function formatDate(isoString) {
    if (!isoString) return "—";
    try {
        return new Date(isoString).toLocaleString("vi-VN", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit",
        });
    } catch {
        return "—";
    }
}
