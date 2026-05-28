import { logger } from "./logger";

type NgrokModule = typeof import("@ngrok/ngrok");
type NgrokListener = Awaited<ReturnType<NgrokModule["forward"]>>;

let currentUrl: string | null = null;
let isConnected = false;
let listener: NgrokListener | null = null;
let ngrokModule: NgrokModule | null = null;

const NGROK_AUTHTOKEN = process.env.NGROK_AUTHTOKEN;
const NGROK_DOMAIN = process.env.NGROK_DOMAIN;
const PORT = Number(process.env.PORT ?? 3000);

async function loadNgrok(): Promise<NgrokModule | null> {
  if (ngrokModule) return ngrokModule;
  try {
    ngrokModule = await import("@ngrok/ngrok");
    return ngrokModule;
  } catch {
    logger.warn("@ngrok/ngrok package not available — ngrok features disabled.");
    return null;
  }
}

export async function startNgrok(): Promise<string | null> {
  if (!NGROK_AUTHTOKEN) {
    logger.warn("NGROK_AUTHTOKEN not set — ngrok is disabled.");
    return null;
  }

  const ngrok = await loadNgrok();
  if (!ngrok) return null;

  try {
    if (listener) {
      await stopNgrok();
    }

    const forwardOpts: Record<string, unknown> = {
      addr: PORT,
      authtoken: NGROK_AUTHTOKEN,
    };

    if (NGROK_DOMAIN) {
      forwardOpts.domain = NGROK_DOMAIN;
    }

    listener = await ngrok.forward(forwardOpts as Parameters<NgrokModule["forward"]>[0]);
    currentUrl = listener.url() ?? null;
    isConnected = true;

    logger.info({ url: currentUrl }, "Ngrok tunnel established.");

    listener.on("close", () => {
      logger.warn("Ngrok tunnel closed.");
      isConnected = false;
      currentUrl = null;
    });

    return currentUrl;
  } catch (err) {
    logger.error({ err }, "Failed to start ngrok tunnel.");
    isConnected = false;
    currentUrl = null;
    return null;
  }
}

export async function stopNgrok(): Promise<void> {
  const ngrok = await loadNgrok();
  try {
    if (listener) {
      await listener.close();
      listener = null;
    }
    if (ngrok) {
      await ngrok.disconnect();
    }
    isConnected = false;
    currentUrl = null;
    logger.info("Ngrok tunnel stopped.");
  } catch (err) {
    logger.error({ err }, "Error stopping ngrok.");
  }
}

export async function reconnectNgrok(): Promise<string | null> {
  logger.info("Reconnecting ngrok...");
  await stopNgrok();
  await new Promise<void>((r) => setTimeout(r, 1000));
  return startNgrok();
}

export function getNgrokStatus(): { connected: boolean; url: string | null } {
  return { connected: isConnected, url: currentUrl };
}
