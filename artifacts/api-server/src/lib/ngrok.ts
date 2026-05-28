import ngrok from "@ngrok/ngrok";
import { logger } from "./logger";

let currentUrl: string | null = null;
let isConnected = false;
let listener: Awaited<ReturnType<typeof ngrok.forward>> | null = null;

const NGROK_AUTHTOKEN = process.env.NGROK_AUTHTOKEN;
const NGROK_DOMAIN = process.env.NGROK_DOMAIN;
const PORT = Number(process.env.PORT ?? 3000);

export async function startNgrok(): Promise<string | null> {
  if (!NGROK_AUTHTOKEN) {
    logger.warn("NGROK_AUTHTOKEN not set — ngrok is disabled.");
    return null;
  }

  try {
    if (listener) {
      await stopNgrok();
    }

    const forwardOpts: Parameters<typeof ngrok.forward>[0] = {
      addr: PORT,
      authtoken: NGROK_AUTHTOKEN,
    };

    if (NGROK_DOMAIN) {
      (forwardOpts as Record<string, unknown>).domain = NGROK_DOMAIN;
    }

    listener = await ngrok.forward(forwardOpts);
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
  try {
    if (listener) {
      await listener.close();
      listener = null;
    }
    await ngrok.disconnect();
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
