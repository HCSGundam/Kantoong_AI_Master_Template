// backend/server.js - Sasis Backend Kantoong AI
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Endpoint Tes Koneksi Backend
app.get('/api/status', (req, res) => {
    res.json({ 
        status: "success", 
        message: "Backend Kantoong AI Master Template aktif dan berjalan!",
        timestamp: new Date()
    });
});

// Endpoint untuk AI Chat (Nanti di sini tempat kita pasang API Gemini)
app.post('/api/chat', (req, res) => {
    const { business_id, message } = req.body;
    
    // Respon sementara (Dummy Agent) sebelum dihubungkan ke Gemini API
    res.json({
        reply: `[Backend AI Agent] Menerima pesan untuk bisnis [${business_id}]: "${message}". Sistem berjalan normal.`
    });
});

const fs = require('fs');
const path = require('path');

// Whitelist Email Admin yang Sah (Bisa disesuaikan dengan email kamu/karyawan)
const ADMIN_EMAILS = [
    "micken.jobmail@gmail.com", 
    "karyawanit@kantong.ai"
];

// Endpoint Login Admin
app.post('/api/admin/login', (req, res) => {
    const { email } = req.body;
    if (ADMIN_EMAILS.includes(email)) {
        // Berikan token sesi sederhana / status sukses
        res.json({ success: true, message: "Akses Admin Diberikan", role: "admin", email });
    } else {
        res.status(403).json({ success: false, message: "Akses Ditolak: Anda bukan admin resmi!" });
    }
});

// Endpoint Mengambil Daftar Produk (Publik & Admin)
app.get('/api/products', (req, res) => {
    const filePath = path.join(__dirname, 'products.json');
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        res.json(JSON.parse(data));
    } else {
        res.json([]);
    }
});

// Endpoint Tambah Produk (Khusus Admin)
app.post('/api/admin/products', (req, res) => {
    const { email, product } = req.body;
    
    // Validasi keamanan server-side
    if (!ADMIN_EMAILS.includes(email)) {
        return res.status(403).json({ success: false, message: "Unauthorized action." });
    }

    const filePath = path.join(__dirname, 'products.json');
    let products = [];
    if (fs.existsSync(filePath)) {
        products = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    const newProduct = {
        id: 'prod_' + Date.now(),
        name: product.name,
        category: product.category,
        price: Number(product.price),
        stock: Number(product.stock),
        description: product.description,
        image: product.image || ''
    };

    products.push(newProduct);
    fs.writeFileSync(filePath, JSON.stringify(products, null, 2));

    res.json({ success: true, message: "Produk berhasil ditambahkan!", product: newProduct });
});

// Jalankan Server
app.listen(PORT, () => {
    console.log(`Server Kantoong AI berjalan di http://localhost:${PORT}`);
});