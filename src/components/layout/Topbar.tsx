// ─── 顶部导航栏 ──────────────────────────────────
// 显示页面标题 + 用户信息 + 退出按钮 + 主题切换

"use client";

import { Menu, Home, Sun, Moon, Monitor } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";

type ThemeMode = "light" | "dark" | "auto";

const THEME_KEY = "gw-theme-mode";

function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "auto";
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark" || stored === "auto") return stored;
  } catch {}
  return "auto";
}

function applyTheme(mode: ThemeMode) {
  const isDark = mode === "dark" || (mode === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

export function Topbar({
  title,
  onToggleSidebar,
  headerSlot,
}: {
  title: string;
  onToggleSidebar: () => void;
  /** 标题右侧可以插入额外的按钮（如"保存""导出"等） */
  headerSlot?: React.ReactNode;
}) {
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getStoredTheme);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  // 应用主题并持久化
  const changeTheme = useCallback((mode: ThemeMode) => {
    setThemeMode(mode);
    try { localStorage.setItem(THEME_KEY, mode); } catch {}
    applyTheme(mode);
    setShowThemeMenu(false);
  }, []);

  // 监听系统主题变化（auto 模式）
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (getStoredTheme() === "auto") {
        applyTheme("auto");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // 点击其他地方关闭菜单
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setShowThemeMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const ThemeIcon = themeMode === "light" ? Sun : themeMode === "dark" ? Moon : Monitor;

  return (
    <header
      className="min-h-14 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* 左侧：菜单按钮 + 标题 + 工具栏插槽 */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button
          onClick={onToggleSidebar}
          className="touch-target p-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 flex-shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>
        {title ? (
          <h1 className="text-sm font-medium text-sidebar-foreground flex-shrink-0">{title}</h1>
        ) : null}
        {headerSlot && (
          <div className="flex items-center gap-2 min-w-0 flex-shrink overflow-x-auto md:overflow-visible whitespace-nowrap *:flex-shrink-0">
            {headerSlot}
          </div>
        )}
      </div>

      {/* 右侧：主题切换 + 用户信息 */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* 主题切换下拉菜单 */}
        <div className="relative" ref={themeMenuRef}>
          <button
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className="touch-target flex items-center justify-center p-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
            title={
              themeMode === "light" ? "明亮模式" :
              themeMode === "dark" ? "黑暗模式" : "跟随系统"
            }
          >
            <ThemeIcon className="w-4 h-4" />
          </button>

          {showThemeMenu && (
            <div className="absolute right-0 top-full mt-1 w-36 bg-popover border border-sidebar-border rounded-lg shadow-lg py-1 z-50">
              <button
                onClick={() => changeTheme("light")}
                className={`flex items-center gap-2 w-full px-3 py-2 min-h-[44px] text-sm text-sidebar-foreground hover:bg-sidebar-accent ${
                  themeMode === "light" ? "font-medium" : ""
                }`}
              >
                <Sun className="w-4 h-4" /> 明亮
              </button>
              <button
                onClick={() => changeTheme("dark")}
                className={`flex items-center gap-2 w-full px-3 py-2 min-h-[44px] text-sm text-sidebar-foreground hover:bg-sidebar-accent ${
                  themeMode === "dark" ? "font-medium" : ""
                }`}
              >
                <Moon className="w-4 h-4" /> 黑暗
              </button>
              <button
                onClick={() => changeTheme("auto")}
                className={`flex items-center gap-2 w-full px-3 py-2 min-h-[44px] text-sm text-sidebar-foreground hover:bg-sidebar-accent ${
                  themeMode === "auto" ? "font-medium" : ""
                }`}
              >
                <Monitor className="w-4 h-4" /> 自动
              </button>
            </div>
          )}
        </div>

        {/* 首页图标 */}
        <a href="/home"
          className="touch-target flex items-center justify-center p-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
          title="首页">
          <Home className="w-4 h-4" />
        </a>
      </div>
    </header>
  );
}
