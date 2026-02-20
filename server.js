const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const app = express();
const port = 3000;
// const host = '192.168.10.83';

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));

app.use(express.static(__dirname, {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
}));

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 200 * 1024 * 1024,
        files: 50000
    }
});

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/upload', upload.array('xmls'), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, error: 'Nenhum arquivo enviado' });
        }

        const arquivos = req.files;
        
        console.log(`✅ Recebidos ${arquivos.length} arquivos para processar`);
        
        const arquivosProcessados = arquivos.map(f => ({
            nome: f.originalname,
            tamanho: f.size,
            conteudo: f.buffer.toString('utf-8')
        }));
        
        res.json({
            success: true,
            arquivos: arquivosProcessados,
            totalArquivos: arquivosProcessados.length
        });
        
    } catch (error) {
        console.error('❌ Erro no upload:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message
        });
    }
});

app.get('/worker.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(path.join(__dirname, 'worker.js'));
});

app.get('/ping', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        server: `http://${host}:${port}`
    });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
});

app.use((err, req, res, next) => {
    console.error('❌ Erro no servidor:', err);
    res.status(500).json({ error: err.message });
});

app.listen(port, () => {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 SERVIDOR INICIADO COM SUCESSO!');
    console.log('='.repeat(70));
    console.log(`📡 Local:    http://localhost:${port}`);
    console.log('='.repeat(70));
    console.log('📁 Pasta:    ' + __dirname);
    console.log('='.repeat(70));
    console.log('✅ Para testar:');
    console.log('='.repeat(70) + '\n');
});