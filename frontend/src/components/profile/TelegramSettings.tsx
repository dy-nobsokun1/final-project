"use client";

import { Send } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { connectTelegram, disconnectTelegram, getTelegramStatus } from "@/lib/api/actions";

type Status = { enabled: boolean; connected: boolean };

/**
 * Notification settings. Email notifications are always on. Telegram is optional: "Connect"
 * opens our bot with a one-time code; once the user presses Start there, "Check again" shows it linked.
 */
export function TelegramSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    void getTelegramStatus().then(setStatus);
  }, []);

  async function handleCheckAgain() {
    const next = await getTelegramStatus();
    setStatus(next);
    setMessage(next.connected ? null : "Not connected yet. Did you press Start in Telegram?");
  }

  async function handleConnect() {
    setIsBusy(true);
    const result = await connectTelegram();
    setIsBusy(false);
    if (!result.link) {
      setMessage(result.error ?? "Could not create a Telegram link.");
      return;
    }
    window.open(result.link, "_blank", "noopener");
    setMessage('Telegram opened. Press "Start" there, then click "Check again".');
  }

  async function handleDisconnect() {
    setIsBusy(true);
    const result = await disconnectTelegram();
    setIsBusy(false);
    setMessage(result.error ?? "Telegram disconnected.");
    if (!result.error) setStatus((current) => current && { ...current, connected: false });
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p>Email notifications are on for new messages, outbids, won auctions and payments.</p>
      {status === null ? (
        <p className="text-muted-foreground">Checking Telegram...</p>
      ) : !status.enabled ? (
        <p className="text-muted-foreground">Telegram notifications are not set up on this server yet.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Send aria-hidden="true" className="size-4" />
          <span className="font-medium">{status.connected ? "Telegram connected" : "Telegram not connected"}</span>
          {status.connected ? (
            <Button variant="secondary" size="sm" onClick={handleDisconnect} disabled={isBusy}>Disconnect</Button>
          ) : (
            <>
              <Button size="sm" onClick={handleConnect} disabled={isBusy}>Connect Telegram</Button>
              <Button variant="ghost" size="sm" onClick={() => void handleCheckAgain()}>
                Check again
              </Button>
            </>
          )}
        </div>
      )}
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}
