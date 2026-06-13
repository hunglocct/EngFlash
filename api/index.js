require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Cấu hình giới hạn dung lượng để tải ảnh lên (Base64)
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Phục vụ các file tĩnh trong thư mục gốc của dự án (cấp trên của thư mục api/)
app.use(express.static(path.join(__dirname, '..')));

// Middleware ghi nhật ký các request gửi đến server để phục vụ debug
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
});

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const REST_BASE = `${SUPABASE_URL}/rest/v1`;

// Danh sách user fallback phục vụ trên server
const FALLBACK_USERS = [
    { id: "u1", username: "admin",  password: "admin123", role: "admin", name: "Quản Trị Viên" },
    { id: "u2", username: "user1",  password: "user123",  role: "user",  name: "Nguyễn Văn An"  },
    { id: "u3", username: "user2",  password: "user456",  role: "user",  name: "Trần Thị Bình"  },
];

// Helper gọi Supabase với token và apikey bảo mật
async function callSupabase(url, method, headers = {}, body = null) {
    const mergedHeaders = {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        ...headers
    };

    const options = {
        method,
        headers: mergedHeaders
    };

    if (body) {
        options.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    return await fetch(url, options);
}

// ─── ENDPOINT XÁC THỰC ĐĂNG NHẬP (SERVER-SIDE AUTH) ───
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    console.log(`[AUTH] Nhận yêu cầu đăng nhập cho tài khoản: "${username}"`);
    
    if (!username || !password) {
        console.log(`[AUTH] Đăng nhập thất bại: Thiếu tài khoản hoặc mật khẩu.`);
        return res.status(400).json({ error: "Vui lòng nhập tên đăng nhập và mật khẩu." });
    }

    try {
        // 1. Thử tìm user trong bảng users của Supabase
        const url = `${REST_BASE}/users?select=*&username=eq.${encodeURIComponent(username)}`;
        const response = await callSupabase(url, 'GET');
        
        if (response.ok) {
            const list = await response.json();
            const dbUser = list.find(u => u.username === username);
            
            if (dbUser) {
                let isMatch = false;
                
                // Kiểm tra xem mật khẩu có được mã hóa bằng bcrypt hay không
                if (dbUser.password && (dbUser.password.startsWith('$2a$') || dbUser.password.startsWith('$2b$'))) {
                    isMatch = bcrypt.compareSync(password, dbUser.password);
                } else {
                    // Nếu là mật khẩu dạng thường (migration state hoặc fallback cũ)
                    isMatch = (password === dbUser.password);
                    
                    // Tự động mã hóa mật khẩu lưu lại vào DB nếu khớp
                    if (isMatch) {
                        try {
                            const hashedPassword = bcrypt.hashSync(password, 10);
                            await callSupabase(`${REST_BASE}/users?id=eq.${dbUser.id}`, 'PATCH', {
                                "Prefer": "return=representation"
                            }, { password: hashedPassword });
                            console.log(`[AUTH] Tự động mã hóa mật khẩu thành công cho học viên: ${username}`);
                        } catch (updateErr) {
                            console.error("[AUTH] Lỗi mã hóa cập nhật mật khẩu:", updateErr.message);
                        }
                    }
                }

                if (isMatch) {
                    console.log(`[AUTH] Đăng nhập THÀNH CÔNG (Supabase) - Tài khoản: "${username}"`);
                    // Trả về session không chứa thông tin password thô
                    return res.json({
                        id: dbUser.id,
                        username: dbUser.username,
                        role: dbUser.role,
                        name: dbUser.name || dbUser.username,
                        avatar: dbUser.avatar,
                        bypassSequence: dbUser.bypassSequence,
                        enrolledSessions: dbUser.enrolledSessions,
                        studentId: dbUser.studentId
                    });
                } else {
                    console.log(`[AUTH] Đăng nhập thất bại (Supabase): Sai mật khẩu cho tài khoản "${username}".`);
                }
            } else {
                console.log(`[AUTH] Không tìm thấy tài khoản "${username}" trên Supabase.`);
            }
        } else {
            console.log(`[AUTH] Lỗi kết nối Supabase (Status ${response.status}).`);
        }
    } catch (err) {
        console.error("[AUTH] Lỗi xác thực qua Supabase:", err.message);
    }

    // 2. Thử đối chiếu tài khoản trong FALLBACK_USERS lưu trên server
    const fbUser = FALLBACK_USERS.find(u => u.username === username && u.password === password);
    if (fbUser) {
        console.log(`[AUTH] Đăng nhập THÀNH CÔNG (Fallback Server) - Tài khoản: "${username}"`);
        return res.json({
            id: fbUser.id,
            username: fbUser.username,
            role: fbUser.role,
            name: fbUser.name || fbUser.username,
            avatar: "preset1",
            bypassSequence: true,
            enrolledSessions: [],
            studentId: "000000"
        });
    }

    console.log(`[AUTH] Đăng nhập THẤT BẠI - Tài khoản: "${username}"`);
    return res.status(401).json({ error: "Tên đăng nhập hoặc mật khẩu không đúng." });
});

// ─── PROXY ROUTE: GET DATA ───
app.get('/api/:table', async (req, res) => {
    const { table } = req.params;
    try {
        const params = new URLSearchParams(req.query);
        const url = `${REST_BASE}/${table}?${params.toString()}`;
        
        const response = await callSupabase(url, 'GET');
        if (!response.ok) {
            const msg = await response.text();
            return res.status(response.status).send(msg);
        }
        
        let data = await response.json();
        
        // Bảo mật: Xoá bỏ mật khẩu nếu dữ liệu là từ bảng users
        if (table === 'users') {
            if (Array.isArray(data)) {
                data = data.map(u => {
                    const cleanUser = { ...u };
                    delete cleanUser.password;
                    return cleanUser;
                });
            } else if (data && typeof data === 'object') {
                delete data.password;
            }
        }
        
        return res.json(data);
    } catch (err) {
        console.error(`[Server] Lỗi GET ${table}:`, err.message);
        return res.status(500).send(err.message);
    }
});

// ─── PROXY ROUTE: POST DATA (CREATE/UPSERT) ───
app.post('/api/:table', async (req, res) => {
    const { table } = req.params;
    let payload = req.body;
    
    try {
        // Mã hóa mật khẩu nếu thêm tài khoản vào bảng users
        if (table === 'users') {
            if (payload && payload.password) {
                payload = { ...payload };
                payload.password = bcrypt.hashSync(payload.password, 10);
            }
        }

        const params = new URLSearchParams(req.query);
        const url = `${REST_BASE}/${table}?${params.toString()}`;
        
        const headers = {};
        if (req.headers['prefer']) {
            headers['Prefer'] = req.headers['prefer'];
        }

        const response = await callSupabase(url, 'POST', headers, payload);
        if (!response.ok) {
            const msg = await response.text();
            return res.status(response.status).send(msg);
        }
        
        let data = await response.json();
        
        // Bảo mật: Xoá mật khẩu trả về
        if (table === 'users') {
            if (Array.isArray(data)) {
                data = data.map(u => {
                    const cleanUser = { ...u };
                    delete cleanUser.password;
                    return cleanUser;
                });
            } else if (data && typeof data === 'object') {
                delete data.password;
            }
        }
        
        return res.json(data);
    } catch (err) {
        console.error(`[Server] Lỗi POST ${table}:`, err.message);
        return res.status(500).send(err.message);
    }
});

// ─── PROXY ROUTE: PATCH DATA (UPDATE) ───
app.patch('/api/:table', async (req, res) => {
    const { table } = req.params;
    let payload = req.body;
    
    try {
        // Mã hóa mật khẩu mới nếu thay đổi mật khẩu cho user
        if (table === 'users') {
            if (payload && payload.password) {
                payload = { ...payload };
                payload.password = bcrypt.hashSync(payload.password, 10);
            }
        }

        const params = new URLSearchParams(req.query);
        const url = `${REST_BASE}/${table}?${params.toString()}`;
        
        const headers = {};
        if (req.headers['prefer']) {
            headers['Prefer'] = req.headers['prefer'];
        }

        const response = await callSupabase(url, 'PATCH', headers, payload);
        if (!response.ok) {
            const msg = await response.text();
            return res.status(response.status).send(msg);
        }
        
        let data = await response.json();
        
        // Bảo mật: Xoá mật khẩu trả về
        if (table === 'users') {
            if (Array.isArray(data)) {
                data = data.map(u => {
                    const cleanUser = { ...u };
                    delete cleanUser.password;
                    return cleanUser;
                });
            } else if (data && typeof data === 'object') {
                delete data.password;
            }
        }
        
        return res.json(data);
    } catch (err) {
        console.error(`[Server] Lỗi PATCH ${table}:`, err.message);
        return res.status(500).send(err.message);
    }
});

// ─── PROXY ROUTE: DELETE DATA ───
app.delete('/api/:table', async (req, res) => {
    const { table } = req.params;
    try {
        const params = new URLSearchParams(req.query);
        const url = `${REST_BASE}/${table}?${params.toString()}`;
        
        const headers = {};
        if (req.headers['prefer']) {
            headers['Prefer'] = req.headers['prefer'];
        }

        const response = await callSupabase(url, 'DELETE', headers);
        if (!response.ok) {
            const msg = await response.text();
            return res.status(response.status).send(msg);
        }
        
        const text = await response.text();
        try {
            return res.json(JSON.parse(text));
        } catch {
            return res.send(text);
        }
    } catch (err) {
        console.error(`[Server] Lỗi DELETE ${table}:`, err.message);
        return res.status(500).send(err.message);
    }
});

// Khởi chạy server nếu chạy trực tiếp (local)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`==============================================`);
        console.log(`🚀 Eng Flash Server đang chạy tại: http://localhost:${PORT}`);
        console.log(`==============================================`);
    });
}

// Xuất module app để tương thích với Vercel Node runtime
module.exports = app;
