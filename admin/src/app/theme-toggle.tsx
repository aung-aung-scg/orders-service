"use client";

import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  useEffect(() => {
    try {
      const theme = localStorage.getItem("orders-theme");
      if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
    } catch {
      // The current page can still switch themes without storage.
    }
  }, []);

  function toggle() {
    const root = document.documentElement;
    const dark = getComputedStyle(root).colorScheme === "dark";
    const theme = dark ? "light" : "dark";
    root.dataset.theme = theme;
    try { localStorage.setItem("orders-theme", theme); } catch {}
  }

  return (
    <Button type="button" size="icon" variant="ghost" aria-label="Toggle color theme" onClick={toggle}>
      <Moon className="dark:hidden" /><Sun className="hidden dark:block" />
    </Button>
  );
}
