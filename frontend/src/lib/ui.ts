import type { MatStateKind, Status } from "./engine";

export const SC: Record<Status, string> = { STANDBY: "var(--stby)", NOMINAL: "var(--ok)", REDUCED: "var(--warn)", UNVERIFIED: "var(--unk)", LOW: "var(--bad)" };
/** Raw hex for canvas drawing (canvas cannot read CSS variables cheaply every frame). */
export const SC_HEX: Record<Status, string> = { STANDBY: "#8ea3b8", NOMINAL: "#4fd6a0", REDUCED: "#f5b84a", UNVERIFIED: "#a99cf5", LOW: "#ff6b5d" };
export const MC: Record<MatStateKind, string> = { ok: "var(--ok)", near: "var(--cyan)", unk: "var(--unk)", smoke: "var(--stby)" };

export const STATUS_LEAD: Record<Status, string> = {
  STANDBY: "Launch phase. Screening starts in orbit.",
  NOMINAL: "Every exposed material has NASA test evidence at these conditions.",
  REDUCED: "Some of the cabin is outside NASA's tested conditions.",
  UNVERIFIED: "No exposed material has NASA test evidence here.",
  LOW: "Oxygen is outside the tested range for most of the cabin.",
};

export const LOG_C: Record<string, string> = { caution: "var(--bad)", advisory: "var(--warn)", info: "var(--muted)", crew: "var(--ok)", declined: "var(--ink-2)", ack: "var(--cyan)", resolved: "var(--ok)" };

export const f1 = (x: number) => x.toFixed(1);
export const sign = (x: number, d = 1) => (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(d);
