/**
 * Where a run's message goes, chosen by ALERT_DELIVERY:
 *
 *   console    print it (the default when ALERT_DELIVERY is not set)
 *   telegram   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 *   email      RESEND_API_KEY, ALERT_EMAIL_TO, sent from Resend's test sender
 *
 * A channel with a variable missing is an error at the start of the run, before any fetch,
 * never a quiet fall back to the console: a green run whose message reached nobody is the
 * mute alert.
 *
 * Nothing here logs or throws a URL or a header. The Telegram token sits in the request
 * path and the Resend key in a header, so an error carries the channel and the status only.
 */
export type Env = Record<string, string | undefined>;

export type Channel =
  | { kind: "console" }
  | { kind: "telegram"; token: string; chatId: string }
  | { kind: "email"; apiKey: string; to: string };

export type Message = { subject: string; text: string };

export const SIGN_OFF = "End-of-day data from EODHD APIs";

/** Resend's test sender: until you verify a domain, it reaches only your own address. */
export const EMAIL_FROM = "Price alert <onboarding@resend.dev>";

export class ConfigError extends Error {}

export class DeliveryError extends Error {
  constructor(
    readonly channel: Channel["kind"],
    readonly status: number | "network error",
  ) {
    super(`delivery failed: ${channel}, ${typeof status === "number" ? `HTTP ${status}` : status}`);
  }
}

/** The channel ALERT_DELIVERY names, with its credentials, or a ConfigError naming what is missing. */
export function deliveryChannel(env: Env): Channel {
  const kind = (env.ALERT_DELIVERY ?? "").trim() || "console";
  // An empty value counts as missing: an unset repository secret arrives as "".
  const need = (name: string): string => {
    const value = env[name]?.trim();
    if (!value) {
      throw new ConfigError(`ALERT_DELIVERY is ${kind}, but ${name} is not set.`);
    }
    return value;
  };

  if (kind === "console") return { kind };
  if (kind === "telegram") {
    return { kind, token: need("TELEGRAM_BOT_TOKEN"), chatId: need("TELEGRAM_CHAT_ID") };
  }
  if (kind === "email") {
    return { kind, apiKey: need("RESEND_API_KEY"), to: need("ALERT_EMAIL_TO") };
  }
  throw new ConfigError(
    `ALERT_DELIVERY is "${kind}". Use console, telegram or email.`,
  );
}

/** One message for every rule that fired, or null when none did: nothing is sent then. */
export function alertMessage(fired: string[]): Message | null {
  if (fired.length === 0) return null;
  const n = fired.length;
  return {
    subject: `Price alert: ${n} rule${n === 1 ? "" : "s"} fired`,
    text: [...fired, "", SIGN_OFF].join("\n"),
  };
}

/** Send one message. Returns the HTTP status, or null for the console. */
export async function deliver(
  channel: Channel,
  message: Message,
  fetchFn: typeof fetch = fetch,
): Promise<number | null> {
  if (channel.kind === "console") {
    console.log(`${message.subject}\n${message.text}`);
    return null;
  }

  let res: Response;
  try {
    res =
      channel.kind === "telegram"
        ? await fetchFn(`https://api.telegram.org/bot${channel.token}/sendMessage`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            // Telegram takes up to 4096 characters; a run's message is far below that.
            body: JSON.stringify({ chat_id: channel.chatId, text: message.text }),
          })
        : await fetchFn("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              authorization: `Bearer ${channel.apiKey}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              from: EMAIL_FROM,
              to: [channel.to],
              subject: message.subject,
              text: message.text,
            }),
          });
  } catch {
    // The error from fetch can name the request; say only which channel failed.
    throw new DeliveryError(channel.kind, "network error");
  }
  if (!res.ok) throw new DeliveryError(channel.kind, res.status);
  return res.status;
}
