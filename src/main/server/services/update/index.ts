import { app, dialog, shell, BrowserWindow } from "electron";
import * as fetchDef from "electron-fetch";
import * as compareVersions from "compare-versions";
import { Server } from "@server/index";

const fetch = fetchDef.default;
export class UpdateService {
    window: BrowserWindow;

    timer: NodeJS.Timeout;

    currentVersion: string;

    isOpen: boolean;

    constructor(window: BrowserWindow) {
        // This won't work in dev-mode because it checks Electron's Version
        this.currentVersion = app.getVersion();
        this.isOpen = false;
        this.window = window;
    }

    start() {
        this.timer = setInterval(async () => {
            await this.checkForUpdate();
        }, 1000 * 60 * 60 * 12); // Default 12 hours
    }

    stop() {
        if (this.timer) clearInterval(this.timer);
    }

    async checkForUpdate() {
        if (this.isOpen) return null;

        // Fetch from Github
        const response = await fetch("https://api.github.com/repos/BlueBubblesApp/BlueBubbles-Server/releases");
        const body = await response.json();
        if (typeof body === "object" && body !== null && !Array.isArray(body) && body?.message)
            return Server().log(`Failed to get updates for BlueBubbles! Error: ${body?.message}`, "warn");
        if (Array.isArray(body) && body.length === 0) return console.log("No updates for BlueBubbles found!");

        // Pull latest version
        const latest = body[0];
        const version = latest.tag_name.replace("v", "");

        // Compare latest version to current version
        if (compareVersions(version, this.currentVersion) === 1) {
            // Emit to all the clients:
            Server().emitMessage("server-update", version);

            const dialogOpts = {
                type: "info",
                buttons: ["Download", "Ignore"],
                title: "BlueBubbles Update",
                message: "BlueBubbles Update Available!",
                detail:
                    `A new version of BlueBubbles is available! (Version: ${version}). ` +
                    `Click download to be redirected.`
            };

            // If there is a newer version, show the dialog and redirect if 'Download' is clicked
            this.isOpen = true;
            dialog.showMessageBox(this.window, dialogOpts).then(returnValue => {
                this.isOpen = false;
                if (returnValue.response === 0) {
                    shell.openExternal("https://github.com/BlueBubblesApp/BlueBubbles-Server/releases");
                    app.quit();
                }
            });
        } else {
            Server().log(`No new version available (latest: ${version})`);
        }

        return null;
    }
}