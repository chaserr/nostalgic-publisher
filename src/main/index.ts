import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { createDatabase } from './db/database'
import { ArticleDB } from './db/articles'
import { PlatformDB } from './db/platforms'
import { RecordDB } from './db/records'
import { SettingsDB } from './db/settings'
import { GeneratorService } from './services/generator'
import { WechatService } from './services/wechat'
import { ToutiaoService } from './services/toutiao'
import { registerIpc } from './ipc'
import { Scheduler } from './scheduler'

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.nostalgic.publisher')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const db = createDatabase()
  const articleDB = new ArticleDB(db)
  const platformDB = new PlatformDB(db)
  const recordDB = new RecordDB(db)
  const settingsDB = new SettingsDB(db)

  const generator = new GeneratorService(settingsDB)
  const wechat = new WechatService(platformDB, settingsDB)
  const toutiao = new ToutiaoService(platformDB)

  registerIpc({ articleDB, platformDB, recordDB, settingsDB, generator, wechat, toutiao })

  const scheduler = new Scheduler({
    articleDB,
    platformDB,
    recordDB,
    settingsDB,
    generator,
    wechat,
    toutiao,
  })
  scheduler.start()

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
