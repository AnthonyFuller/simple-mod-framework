const windowStateManager = require("electron-window-state")
const contextMenu = require("electron-context-menu")
const { app, BrowserWindow, ipcMain, dialog } = require("electron")
const serve = require("electron-serve")

try {
	require("electron-reloader")(module)
} catch (e) {
	console.error(e)
}

const serveURL = serve({ directory: "." })
const port = process.env.PORT || 3000
const dev = !app.isPackaged
/** @type BrowserWindow */
let mainWindow

function createWindow() {
	let windowState = windowStateManager({
		defaultWidth: 800,
		defaultHeight: 600
	})

	const mainWindow = new BrowserWindow({
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: true,
			spellcheck: false,
			webSecurity: false,
			preload: require("path").join(__dirname, "preload.cjs")
		},
		x: windowState.x,
		y: windowState.y,
		width: windowState.width,
		height: windowState.height
	})

	windowState.manage(mainWindow)

	mainWindow.once("ready-to-show", () => {
		mainWindow.show()
		mainWindow.focus()
		mainWindow.webContents.reloadIgnoringCache()
	})

	mainWindow.on("close", () => {
		windowState.saveState(mainWindow)
	})

	return mainWindow
}

contextMenu({
	showLookUpSelection: false,
	showSearchWithGoogle: false,
	showCopyImage: false
})

function loadVite(port) {
	mainWindow.loadURL(`http://localhost:${port}`).catch((e) => {
		console.log("Error loading URL, retrying", e)
		setTimeout(() => {
			loadVite(port)
		}, 200)
	})
}

function createMainWindow() {
	mainWindow = createWindow()
	mainWindow.once("close", () => {
		mainWindow = null
	})

	if (dev) loadVite(port)
	else serveURL(mainWindow)
}

app.once("ready", createMainWindow)
app.on("activate", () => {
	if (!mainWindow) {
		createMainWindow()
	}
})
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit()
})

ipcMain.on("deploy", () => {
	let deployProcess = require("child_process").spawn("Deploy.exe --useConsoleLogging", ["--useConsoleLogging"], { // just to make sure
		shell: true,
		cwd: ".."
	})

	let deployOutput = ""

	mainWindow.webContents.send("frameworkDeployModalOpen")

	deployProcess.stdout.on("data", (data) => {
		deployOutput += String(data)
		mainWindow.webContents.send("frameworkDeployOutput", deployOutput)
	})

	deployProcess.stderr.on("data", (data) => {
		deployOutput += String(data)
		mainWindow.webContents.send("frameworkDeployOutput", deployOutput)
	})

	deployProcess.on("close", (data) => {
		mainWindow.webContents.send("frameworkDeployFinished")
	})
})

ipcMain.on("modFileOpenDialog", () => {
	mainWindow.webContents.send("modFileOpenDialogResult", dialog.showOpenDialogSync({
		title: "Add a mod file",
		buttonLabel: "Select",
		filters: [{ name: "Mod Files", extensions: ["zip", "rpkg"] }],
		properties: ["openFile", "dontAddToRecent"]
	}))
})