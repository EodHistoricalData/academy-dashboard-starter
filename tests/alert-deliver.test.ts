import { describe, expect, it, vi } from "vitest";
import {
  alertMessage,
  deliver,
  deliveryChannel,
  DeliveryError,
  SIGN_OFF,
} from "@/lib/alerts/deliver";

// Made-up credentials. Nothing here talks to Telegram or Resend: fetch is a fake.
const TOKEN = "TEST-TOKEN-not-a-real-bot";
const CHAT = "424242";
const RESEND = "re_test_not_a_real_key";

const message = alertMessage(["NVDA.US closed at 186.75 on 2026-10-30, above 185 (nvda)"])!;

function fakeFetch(status = 200) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    void url;
    void init;
    return new Response("{}", { status });
  });
}

describe("deliveryChannel", () => {
  it("defaults to the console", () => {
    expect(deliveryChannel({})).toEqual({ kind: "console" });
  });

  it("fails naming the missing variable, and never falls back to the console", () => {
    expect(() => deliveryChannel({ ALERT_DELIVERY: "telegram", TELEGRAM_CHAT_ID: CHAT })).toThrow(
      /TELEGRAM_BOT_TOKEN is not set/,
    );
    expect(() => deliveryChannel({ ALERT_DELIVERY: "telegram", TELEGRAM_BOT_TOKEN: TOKEN })).toThrow(
      /TELEGRAM_CHAT_ID is not set/,
    );
    expect(() => deliveryChannel({ ALERT_DELIVERY: "email", RESEND_API_KEY: RESEND })).toThrow(
      /ALERT_EMAIL_TO is not set/,
    );
  });

  it("treats an empty value as missing, the way an unset repository secret arrives", () => {
    expect(() =>
      deliveryChannel({ ALERT_DELIVERY: "telegram", TELEGRAM_BOT_TOKEN: "", TELEGRAM_CHAT_ID: CHAT }),
    ).toThrow(/TELEGRAM_BOT_TOKEN/);
  });

  it("refuses a channel it does not know", () => {
    expect(() => deliveryChannel({ ALERT_DELIVERY: "sms" })).toThrow(/console, telegram or email/);
  });
});

describe("alertMessage", () => {
  it("is null when nothing fired", () => {
    expect(alertMessage([])).toBeNull();
  });

  it("lists every fired rule and ends with the data credit", () => {
    const m = alertMessage(["one", "two"])!;
    expect(m.text.split("\n")).toEqual(["one", "two", "", SIGN_OFF]);
    expect(m.subject).toBe("Price alert: 2 rules fired");
  });
});

describe("deliver", () => {
  it("sends Telegram's sendMessage as a JSON POST", async () => {
    const fetchFn = fakeFetch();
    const channel = deliveryChannel({
      ALERT_DELIVERY: "telegram",
      TELEGRAM_BOT_TOKEN: TOKEN,
      TELEGRAM_CHAT_ID: CHAT,
    });
    await expect(deliver(channel, message, fetchFn)).resolves.toBe(200);

    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({ chat_id: CHAT, text: message.text });
  });

  it("sends an email through Resend with a bearer key", async () => {
    const fetchFn = fakeFetch();
    const channel = deliveryChannel({
      ALERT_DELIVERY: "email",
      RESEND_API_KEY: RESEND,
      ALERT_EMAIL_TO: "me@example.com",
    });
    await deliver(channel, message, fetchFn);

    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toBe("https://api.resend.com/emails");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${RESEND}`);
    expect(JSON.parse(String(init?.body))).toEqual({
      from: "Price alert <onboarding@resend.dev>",
      to: ["me@example.com"],
      subject: message.subject,
      text: message.text,
    });
  });

  it("fails with the channel and status, and no token in the error", async () => {
    const channel = deliveryChannel({
      ALERT_DELIVERY: "telegram",
      TELEGRAM_BOT_TOKEN: TOKEN,
      TELEGRAM_CHAT_ID: CHAT,
    });
    const error = await deliver(channel, message, fakeFetch(400)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DeliveryError);
    expect(String((error as Error).message)).toBe("delivery failed: telegram, HTTP 400");
    expect(String((error as Error).message)).not.toContain(TOKEN);
  });

  it("hides what fetch says when the network fails", async () => {
    const channel = deliveryChannel({
      ALERT_DELIVERY: "telegram",
      TELEGRAM_BOT_TOKEN: TOKEN,
      TELEGRAM_CHAT_ID: CHAT,
    });
    const failing = vi.fn(async () => {
      throw new TypeError(`fetch failed: https://api.telegram.org/bot${TOKEN}/sendMessage`);
    });
    const error = await deliver(channel, message, failing).catch((e: unknown) => e);
    expect(String((error as Error).message)).toBe("delivery failed: telegram, network error");
  });
});
