import type * as WS from "@trufflesuite/uws-js-unofficial";
import type DefaultApiPlugin from "../../../index";
import type { HttpRouterBase } from "../base";

import { AuthMiddleware } from "../../../middleware/http/authMiddleware";
import { InjectMiddleware } from "../../../middleware/http/injectMiddleware";
import { RequestParserMiddleware } from "../../../middleware/http/requestParserMiddleware";
import { Response } from "../../../helpers/response";
import { UpgradedHttp, WsMiddleware } from "../../../types";
import { tokenAuth } from "./auth";
import { ping } from "./general";
import { getPlugins } from "./plugin";
import { getChats } from "./chat";
import { getHandles } from "./handle";
import { getMessages, getUpdatedMessages } from "./message";

export class HttpRouter implements HttpRouterBase {
    name = "v1";

    app: WS.TemplatedApp;

    plugin: DefaultApiPlugin;

    injector: WsMiddleware;

    constructor(plugin: DefaultApiPlugin) {
        this.app = plugin.app;
        this.plugin = plugin;

        this.injector = InjectMiddleware.middleware({
            plugin,
            hasEnded: false
        });
    }

    public async serve() {
        this.app.get(HttpRouter.path("/ping"), this.base(ping));

        // Authentication routes
        this.app.post(HttpRouter.path("/token"), this.base(tokenAuth));

        // Chat API routes
        this.app.get(HttpRouter.path("/chat"), this.protected(getChats));

        // Handle API routes
        this.app.get(HttpRouter.path("/handle"), this.protected(getHandles));

        // Message API routes
        this.app.get(HttpRouter.path("/message"), this.protected(getMessages));
        this.app.get(HttpRouter.path("/updatedMessages"), this.protected(getUpdatedMessages));

        // Plugin routes
        this.app.get(HttpRouter.path("/plugin"), this.protected(getPlugins));

        // Log routes
        // this.app.get(HttpRouter.path("/log/last"), null);

        // Catch-all for any unhandled routes (404)
        this.app.any("/*", (res, _) => Response.notFound(res));
    }

    public base(...handlers: WsMiddleware[]): WsMiddleware {
        return HttpRouter.bootstrapRouteHandlers(this.injector, RequestParserMiddleware.middleware, ...handlers);
    }

    public protected(...handlers: WsMiddleware[]): WsMiddleware {
        return this.base(AuthMiddleware.middleware, ...handlers);
    }

    public static path(path: string) {
        let p = path;
        if (!p.startsWith("/")) p = `/${p}`;
        return `/api/v1${p}`;
    }

    private static bootstrapRouteHandlers(...handlers: WsMiddleware[]): WsMiddleware {
        const handler = async (res: WS.HttpResponse, req: WS.HttpRequest) => {
            for (const func of handlers) {
                try {
                    // Call the next middleware
                    await func(res, req);

                    // If the request is marked as complete, don't continue
                    if ((req as UpgradedHttp).hasEnded) break;
                } catch (ex) {
                    console.error(ex);
                    Response.error(res, 500, ex.message);
                }
            }
        };

        return handler;
    }
}

export const onAbort = async (): Promise<void> => {
    console.log("ABORTED");
};