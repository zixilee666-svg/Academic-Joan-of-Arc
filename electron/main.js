const { app, BrowserWindow, Menu, Tray, nativeImage, dialog, shell, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

// ============================================================
// 文件日志：无论控制台窗口是否可见/是否闪退，现场都落盘可查
// 位置: %TEMP%\ajoa-desktop.log
// ============================================================
const LOG_PATH = path.join(process.env.TEMP || '.', 'ajoa-desktop.log');
function flog(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(LOG_PATH, line); } catch (_) { /* ignore */ }
  console.log(msg);
}

// ============================================================
// 自愈守卫：若被以 ELECTRON_RUN_AS_NODE=1（纯 Node 模式）误启动
// （某些父进程/终端会注入该变量），require('electron') 将拿不到 app。
// 此时清除该变量并用真实 electron.exe 重新拉起自身，保证任何入口都能正常开窗口。
// ============================================================
if (typeof app === 'undefined' && process.env.ELECTRON_RUN_AS_NODE) {
  const exe = path.join(__dirname, 'node_modules', 'electron', 'dist', 'electron.exe');
  flog('检测到 ELECTRON_RUN_AS_NODE 污染，自愈重启真实 Electron: ' + exe);
  const env = Object.assign({}, process.env);
  delete env.ELECTRON_RUN_AS_NODE;
  spawn(exe, [__dirname], { env, detached: true, stdio: 'ignore' });
  process.exit(0);
}
if (typeof app === 'undefined') {
  flog('FATAL: require("electron") 未返回 app（非 Electron 运行时环境），退出。');
  process.exit(1);
}

process.on('uncaughtException', (err) => { flog('UNCAUGHT: ' + (err && err.stack ? err.stack : err)); });
process.on('exit', (code) => { flog(`process exit code=${code}`); });

// ============================================================
// v3.2 桌面外壳：加载「真实 FastAPI 后端 + 新前端」
//   electron/ 已迁入主项目根，路径全部相对 __dirname 解析：
//   PROJECT_ROOT = __dirname/.. （即 D:\...\揭榜，等价 C:\jibang-aihub junction）
//   后端  : FastAPI v3.2.0（uvicorn :8000，同源托管 frontend/dist 新界面）
//   旧内置 server.js（:3100 内存版 v3.0.0）已停用
//   回滚  : 恢复 main.js.bak-v3.0 即可
// ============================================================
const PROJECT_ROOT = path.join(__dirname, '..');
const BACKEND_APP = path.join(PROJECT_ROOT, 'backend', 'app');
const VENV_PY = path.join(PROJECT_ROOT, '.venv', 'Scripts', 'python.exe');
const APP_PORT = 8000;

let mainWindow = null;
let tray = null;
let serverProcess = null;
let weStartedServer = false;

// ============================================================
// Health probe of the real FastAPI backend
// ============================================================
function checkServer() {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${APP_PORT}/health`, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        if (res.statusCode === 200 && body.includes('"status"')) {
          try { resolve(JSON.parse(body)); } catch (e) { resolve({}); }
        } else {
          reject(new Error('health bad response'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(3000, () => { req.destroy(); reject(new Error('health timeout')); });
    req.end();
  });
}

// ============================================================
// Start (or reuse) the real backend
// ============================================================
async function startServer() {
  // 已有健康服务则直接复用（浏览器版 / 先前启动的实例）
  try {
    const h = await checkServer();
    console.log(`[Server] :${APP_PORT} 已有健康服务，直接复用（version=${h.version} mode=${h.mode}）。`);
    return;
  } catch (_) { /* 需要自行启动 */ }

  if (!fs.existsSync(BACKEND_APP)) {
    throw new Error(`未找到后端目录 ${BACKEND_APP}`);
  }
  const pythonExe = fs.existsSync(VENV_PY) ? VENV_PY : 'python';
  console.log(`[Server] 启动真实后端: ${pythonExe} -m uvicorn main:app (cwd=${BACKEND_APP})`);

  serverProcess = spawn(pythonExe, ['-m', 'uvicorn', 'main:app',
    '--host', '127.0.0.1', '--port', String(APP_PORT), '--log-level', 'info'], {
    cwd: BACKEND_APP,
    env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  weStartedServer = true;

  serverProcess.stdout.on('data', (d) => console.log('[Server]', d.toString().trim()));
  serverProcess.stderr.on('data', (d) => console.error('[Server]', d.toString().trim()));
  serverProcess.on('error', (err) => console.error('Failed to start server:', err));
  serverProcess.on('exit', (code) => console.log(`Server exited with code ${code}`));

  // 轮询健康探针直至就绪（最长 120s）
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    try { await checkServer(); return; } catch (_) { /* keep polling */ }
  }
  throw new Error('后端在 120 秒内未就绪（请检查 C:\\jibang-aihub\\.venv 依赖与 .env 百炼凭证）');
}

// ============================================================
// Create Main Window
// ============================================================
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    title: 'Academic Joan of Arc - AI科研智能平台 v3.2',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
    backgroundColor: '#060E1A',
    autoHideMenuBar: true,
  });

  mainWindow.loadURL(`http://127.0.0.1:${APP_PORT}`);

  // 外部链接（DOI / 文献源）交系统浏览器打开，不在应用内跳转
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  // 加载失败兜底：绝不静默——强制显示窗口并呈现错误页，避免"双击无反应"
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    flog(`did-fail-load code=${code} ${desc} url=${url}`);
    mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(
      '<h2>Academic Joan of Arc 无法连接后端</h2><p>' + desc + ' (code ' + code + ')</p>' +
      '<p>请确认 :8000 后端已启动（双击 start.bat），或查看日志 ' + LOG_PATH + '</p>'));
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.once('ready-to-show', () => {
    flog('ready-to-show, 显示主窗口');
    mainWindow.show();
    mainWindow.focus();
  });

  // 兜底定时器：15 秒后若窗口仍未显示（ready-to-show 未触发），强制显示
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      flog('15s 兜底：强制显示主窗口');
      mainWindow.show();
      mainWindow.focus();
    }
  }, 15000);

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Application menu
  const menu = Menu.buildFromTemplate([
    {
      label: 'Academic Joan of Arc',
      submenu: [
        { label: '显示主窗口', accelerator: 'CmdOrCtrl+Shift+M', click: () => mainWindow?.show() },
        { type: 'separator' },
        { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => { app.isQuitting = true; app.quit(); } },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => dialog.showMessageBox(mainWindow, {
            type: 'info', title: '关于 Academic Joan of Arc',
            message: 'Academic Joan of Arc v3.2.0',
            detail: '六环节自迭代流水线 · 真实百炼引擎（非 Mock）\n新问题实验室 / 125题总控台 / 迭代工作台 / 评测中心\n© 2026 Academic Joan of Arc Team',
          }),
        },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

// ============================================================
// System Tray
// ============================================================
function createTray() {
  try {
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(trayIcon);
    tray.setToolTip('Academic Joan of Arc v3.2 - AI科研智能平台');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '显示主窗口', click: () => mainWindow?.show() },
      { type: 'separator' },
      { label: '退出', click: () => { app.isQuitting = true; app.quit(); } },
    ]));
    tray.on('double-click', () => mainWindow?.show());
  } catch {
    console.log('Tray icon not available');
  }
}

// ============================================================
// IPC Handlers — 对应 preload.js 暴露的 4 个桥接方法
// ============================================================
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});
ipcMain.on('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});
ipcMain.on('maximize-window', () => {
  if (mainWindow) {
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  }
});
ipcMain.on('close-window', () => {
  if (mainWindow) mainWindow.close();
});

// ============================================================
// App Lifecycle
// ============================================================
// 渲染策略：使用 Electron 默认（GPU 优先 + 驱动异常时自动回退软件渲染）。
// 历史教训：曾加 app.disableHardwareAcceleration() 强制软件渲染，
// 在部分显卡驱动下反而导致 GPU 进程反复崩溃、窗口无法显示（v3.0 默认渲染已验证良好）。
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) { app.quit(); }

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  flog('app ready — Starting Academic Joan of Arc Desktop v3.2 (real backend @ :8000)...');
  try {
    await startServer();
    flog('startServer 完成，创建窗口');
    createWindow();
    createTray();
  } catch (err) {
    flog('Startup failed: ' + (err && err.message ? err.message : err));
    console.error('Startup failed:', err);
    dialog.showErrorBox('启动失败', `Academic Joan of Arc 启动失败：${err.message}\n\n请确保 C:\\jibang-aihub 项目完整（.venv 依赖 + .env 百炼凭证）。`);
    app.quit();
  }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

app.on('before-quit', () => {
  app.isQuitting = true;
  // 仅终止由桌面版自行拉起的后端；复用的服务（与浏览器版共用）不动
  if (serverProcess && weStartedServer) {
    try { serverProcess.kill(); } catch (_) { /* ignore */ }
  }
});
