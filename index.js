const express = require('express');
const { spawn, execSync } = require('child_process');
const basicAuth = require('express-basic-auth');
const path = require('path');
const fs = require('fs');
const os = require('os');
const multer = require('multer');

const app = express();

// ===== MIDDLEWARE =====
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// ===== AUTH =====
const adminUser = process.env.TERMINAL_USER;
const adminPass = process.env.TERMINAL_PASS;

if (!adminUser || !adminPass) {
    console.error('[FATAL] TERMINAL_USER and TERMINAL_PASS required');
    process.exit(1);
}

app.use(basicAuth({
    users: { [adminUser]: adminPass },
    challenge: true,
    realm: 'MAGoCo Terminal'
}));

// ===== LOGGING =====
const LOG_DIR = process.env.LOG_DIR || '/var/log/magoco-terminal';
fs.mkdirSync(LOG_DIR, { recursive: true });
const accessLog = fs.createWriteStream(path.join(LOG_DIR, 'access.log'), { flags: 'a' });
const cmdLog = fs.createWriteStream(path.join(LOG_DIR, 'commands.log'), { flags: 'a' });

function log(type, msg) {
    const ts = new Date().toISOString();
    const line = `[${ts}] [${type}] ${msg}\n`;
    accessLog.write(line);
    process.stdout.write(line);
}

// ===== SESSION MANAGEMENT =====
const sessions = new Map();
const SESSION_TIMEOUT = 3600000; // 1 hour

function getSession(id) {
    if (!sessions.has(id)) {
        sessions.set(id, {
            id,
            cwd: process.env.WORK_DIR || '/tmp',
            created: Date.now(),
            lastAccess: Date.now()
        });
    }
    const s = sessions.get(id);
    s.lastAccess = Date.now();
    return s;
}

// Cleanup old sessions every 10 min
setInterval(() => {
    const now = Date.now();
    for (const [id, s] of sessions) {
        if (now - s.lastAccess > SESSION_TIMEOUT) sessions.delete(id);
    }
}, 600000);

// ===== COMMAND EXECUTION =====
function executeCommand(command, cwd, timeout = 30000) {
    return new Promise((resolve) => {
        const start = Date.now();
        
        // Handle cd specially
        const trimmed = command.trim();
        if (trimmed === 'cd' || trimmed.startsWith('cd ')) {
            const target = trimmed === 'cd' ? os.homedir() : trimmed.substring(3).trim();
            const fullPath = path.isAbsolute(target) ? target : path.join(cwd, target);
            
            try {
                fs.accessSync(fullPath, fs.constants.R_OK);
                return resolve({
                    output: '',
                    error: null,
                    exitCode: 0,
                    cwd: fullPath,
                    duration: 0
                });
            } catch {
                return resolve({
                    output: '',
                    error: `cd: ${target}: No such file or directory`,
                    exitCode: 1,
                    cwd,
                    duration: 0
                });
            }
        }
        
        // Handle pwd
        if (trimmed === 'pwd') {
            return resolve({ output: cwd, error: null, exitCode: 0, cwd, duration: 0 });
        }
        
        // Execute command
        try {
            const output = execSync(command, {
                cwd,
                encoding: 'utf-8',
                timeout,
                maxBuffer: 50 * 1024 * 1024,
                env: { ...process.env, TERM: 'xterm-256color', HOME: os.homedir() }
            });
            
            const duration = Date.now() - start;
            cmdLog.write(`[${new Date().toISOString()}] OK ${duration}ms | ${command.substring(0, 100)}\n`);
            
            resolve({
                output: output || '',
                error: null,
                exitCode: 0,
                cwd,
                duration
            });
        } catch (err) {
            const duration = Date.now() - start;
            cmdLog.write(`[${new Date().toISOString()}] FAIL ${duration}ms | ${command.substring(0, 100)} | ${err.message.substring(0, 100)}\n`);
            
            resolve({
                output: err.stdout ? err.stdout.toString() : '',
                error: err.stderr ? err.stderr.toString() : err.message,
                exitCode: err.status || 1,
                cwd,
                duration
            });
        }
    });
}

// ===== FILE UPLOAD =====
const upload = multer({ 
    dest: '/tmp/magoco-upload/',
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// ===== API ROUTES =====

// Health check (no auth)
app.get('/health', (req, res) => {
    res.json({
        status: 'alive',
        version: '3.0.0',
        uptime: process.uptime(),
        sessions: sessions.size,
        timestamp: new Date().toISOString()
    });
});

// Ping (no auth)
app.get('/ping', (req, res) => res.status(204).end());

// Execute command
app.post('/execute', async (req, res) => {
    const { command, sessionId = 'default' } = req.body;
    if (!command) return res.status(400).json({ error: 'No command' });
    
    const session = getSession(sessionId);
    const result = await executeCommand(command, session.cwd);
    
    // Update session cwd if changed
    if (result.cwd) session.cwd = result.cwd;
    
    res.json({ ...result, sessionId, cwd: session.cwd });
});

// Batch execute
app.post('/batch', async (req, res) => {
    const { commands, sessionId = 'default' } = req.body;
    if (!Array.isArray(commands)) return res.status(400).json({ error: 'commands must be array' });
    
    const session = getSession(sessionId);
    const results = [];
    
    for (const cmd of commands) {
        const result = await executeCommand(cmd, session.cwd);
        if (result.cwd) session.cwd = result.cwd;
        results.push({ command: cmd, ...result });
    }
    
    res.json({ results, sessionId, cwd: session.cwd });
});

// System info
app.get('/sysinfo', async (req, res) => {
    const result = await executeCommand(
        'echo "===CPU===" && nproc && echo "===RAM===" && free -h && echo "===DISK===" && df -h / && echo "===UPTIME===" && uptime',
        '/tmp'
    );
    
    res.json({
        output: result.output,
        system: {
            platform: os.platform(),
            arch: os.arch(),
            hostname: os.hostname(),
            cpus: os.cpus().length,
            totalMem: Math.floor(os.totalmem() / 1024 / 1024) + 'MB',
            freeMem: Math.floor(os.freemem() / 1024 / 1024) + 'MB'
        }
    });
});

// List files
app.post('/files', async (req, res) => {
    const { dir } = req.body;
    const target = dir || '/tmp';
    const result = await executeCommand(`ls -la "${target}"`, '/tmp');
    res.json({ ...result, dir: target });
});

// Install package
app.post('/install', async (req, res) => {
    const { package: pkg, manager = 'apt' } = req.body;
    if (!pkg) return res.status(400).json({ error: 'package required' });
    
    let cmd;
    switch (manager) {
        case 'npm': cmd = `npm install -g ${pkg}`; break;
        case 'pip': cmd = `pip install ${pkg}`; break;
        default: cmd = `apt-get update && apt-get install -y ${pkg}`;
    }
    
    const result = await executeCommand(cmd, '/tmp', 120000);
    res.json(result);
});

// Upload file
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    
    const dest = req.body.dest || '/tmp';
    const destPath = path.join(dest, req.file.originalname);
    
    try {
        fs.mkdirSync(dest, { recursive: true });
        fs.renameSync(req.file.path, destPath);
        res.json({ success: true, path: destPath, size: req.file.size });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Download file
app.get('/download', (req, res) => {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'path required' });
    
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    
    res.download(filePath);
});

// List sessions
app.get('/sessions', (req, res) => {
    const list = [];
    for (const [id, s] of sessions) {
        list.push({ id, cwd: s.cwd, created: s.created, lastAccess: s.lastAccess });
    }
    res.json({ sessions: list });
});

// ===== START =====
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
    log('SYSTEM', `MAGoCo Terminal v3.0 started on ${HOST}:${PORT}`);
    log('SYSTEM', `Auth: ${adminUser}`);
    log('SYSTEM', `Features: execute, batch, sysinfo, files, install, upload, download, sessions`);
});

process.on('SIGTERM', () => {
    log('SYSTEM', 'Shutting down...');
    accessLog.end();
    cmdLog.end();
    process.exit(0);
});
