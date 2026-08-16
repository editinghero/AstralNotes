import { useCallback, useEffect, useState } from "react";

export const THEMES = [
  {
    id: "peach",
    label: "Peach",
    bg: "#22191a",
    accent: "#f0788a",
    swatch: ["#22191a", "#f0788a", "#fff3e0"],
  },
  {
    id: "mauve",
    label: "Mauve",
    bg: "#12121a",
    accent: "#cba6f7",
    swatch: ["#12121a", "#cba6f7", "#f5b78f"],
  },
  {
    id: "teal",
    label: "Teal",
    bg: "#101418",
    accent: "#8fe0d2",
    swatch: ["#101418", "#8fe0d2", "#f2a3b3"],
  },
  {
    id: "sky",
    label: "Sky",
    bg: "#0f1116",
    accent: "#9dc4ff",
    swatch: ["#0f1116", "#9dc4ff", "#c4b0f5"],
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const STORAGE_KEY = "cn:theme";

/** Point the installable-app metadata (manifest, icon, theme colour) at the active theme. */
function applyAppIdentity(id: ThemeId) {
  if (typeof document === "undefined") return;
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0];

  const set = (
    selector: string,
    attr: string,
    value: string,
    create?: () => HTMLElement,
  ) => {
    let el = document.head.querySelector(selector) as HTMLElement | null;
    if (!el && create) {
      el = create();
      document.head.appendChild(el);
    }
    el?.setAttribute(attr, value);
  };

  set('link[rel="manifest"]', "href", `/manifest-${id}.webmanifest`, () => {
    const link = document.createElement("link");
    link.setAttribute("rel", "manifest");
    return link;
  });
  set(
    'link[rel="icon"][type="image/svg+xml"]',
    "href",
    `/icons/icon-${id}.svg`,
    () => {
      const link = document.createElement("link");
      link.setAttribute("rel", "icon");
      link.setAttribute("type", "image/svg+xml");
      return link;
    },
  );
  set('link[rel="apple-touch-icon"]', "href", `/icons/icon-${id}.svg`, () => {
    const link = document.createElement("link");
    link.setAttribute("rel", "apple-touch-icon");
    return link;
  });
  set('meta[name="theme-color"]', "content", theme.bg, () => {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    return meta;
  });
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeId>("peach");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    const next =
      stored && THEMES.some((t) => t.id === stored) ? stored : "peach";
    setTheme(next);
    document.documentElement.dataset["theme"] = next;
    applyAppIdentity(next);
  }, []);

  const apply = useCallback((next: ThemeId) => {
    setTheme(next);
    document.documentElement.dataset["theme"] = next;
    localStorage.setItem(STORAGE_KEY, next);
    applyAppIdentity(next);
  }, []);

  return { theme, setTheme: apply };
}
