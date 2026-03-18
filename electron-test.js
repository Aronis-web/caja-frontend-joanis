console.log('TEST: Electron test file loaded');

const { app, BrowserWindow } = require('electron');

console.log('TEST: Electron modules loaded');

app.on('ready', () => {
  console.log('TEST: App ready');

  const win = new BrowserWindow({
    width: 800,
    height: 600,
  });

  console.log('TEST: Window created');

  win.loadURL('https://www.google.com');

  console.log('TEST: URL loaded');
});

app.on('window-all-closed', () => {
  console.log('TEST: All windows closed');
  app.quit();
});

console.log('TEST: Event handlers registered');
