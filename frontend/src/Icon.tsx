import type { ReactNode } from "react";

export type IconName =
  | "activity"
  | "alert"
  | "bot"
  | "chat"
  | "check"
  | "clock"
  | "file"
  | "headset"
  | "history"
  | "moon"
  | "plus"
  | "send"
  | "sparkles"
  | "sun"
  | "trash"
  | "upload"
  | "user";

const paths: Record<IconName, ReactNode> = {
  activity: (
    <>
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4m0 4h.01" />
    </>
  ),
  bot: (
    <>
      <rect x="4" y="7" width="16" height="13" rx="4" />
      <path d="M12 3v4m-5 5h.01M17 12h.01M8 16h8" />
    </>
  ),
  chat: (
    <>
      <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l-2 2v-8.5a7.5 7.5 0 1 1 17 0Z" />
      <path d="M8 11h8m-8 4h5" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  file: (
    <>
      <path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10Z" />
      <path d="M13 3v7h7m-11 4h6m-6 4h6" />
    </>
  ),
  headset: (
    <>
      <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
      <path d="M5 13h2a2 2 0 0 1 2 2v4H6a3 3 0 0 1-3-3v-1a2 2 0 0 1 2-2Zm14 0h-2a2 2 0 0 0-2 2v4h3a3 3 0 0 0 3-3v-1a2 2 0 0 0-2-2Z" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" />
      <path d="M3 3v5h5m4-1v5l3 2" />
    </>
  ),
  moon: (
    <>
      <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14m-7-7h14" />
    </>
  ),
  send: (
    <>
      <path d="m21 3-7.2 18-3.5-7.3L3 10.2 21 3Z" />
      <path d="M10.3 13.7 15 9" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
      <path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18m-2 0-.9 14H5.9L5 6m4 0V4h6v2m-5 4v6m4-6v6" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4m-4 4 4-4 4 4" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 21a7 7 0 0 1 14 0" />
    </>
  ),
};

type Props = {
  name: IconName;
  size?: number;
  className?: string;
};

export default function Icon({ name, size = 18, className }: Props) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
