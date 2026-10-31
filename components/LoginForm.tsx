"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getSupabaseBrowserClient } from "@/lib/supabase";

type Mode = "login" | "signup";

function safeNextPath(): string {
  const raw = new URLSearchParams(window.location.search).get("next");
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

function friendlyAuthError(message: string): string {
  if (/Invalid login credentials/i.test(message)) {
    return "邮箱或密码不正确。";
  }
  if (/Email not confirmed/i.test(message)) {
    return "邮箱还没有确认，请先打开确认邮件。";
  }
  if (/User already registered/i.test(message)) {
    return "这个邮箱已经注册过了，请直接登录。";
  }
  if (/Password should be at least/i.test(message)) {
    return "密码至少需要 6 位。";
  }
  return message;
}

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (
      new URLSearchParams(window.location.search).get("error") === "auth"
    ) {
      setError("登录链接已失效或已使用，请重新登录。");
    }
  }, []);

  function changeMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const normalizedEmail = email.trim();

      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
          },
        });

        if (signUpError) throw signUpError;

        if (data.session) {
          router.replace(safeNextPath());
          router.refresh();
          return;
        }

        setNotice("注册成功。请打开邮箱确认链接，然后回来登录。");
        setMode("login");
        setPassword("");
        return;
      }

      const { error: signInError } =
        await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

      if (signInError) throw signInError;

      router.replace(safeNextPath());
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? friendlyAuthError(caught.message)
          : "操作失败，请稍后重试。",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-400">
          BanLog Account
        </p>
        <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-neutral-900">
          {mode === "login" ? "登录 BanLog" : "创建账号"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          {mode === "login"
            ? "继续你的追番记录与每日放送。"
            : "使用邮箱注册，所有追番记录都会安全地保存在云端。"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label
            htmlFor="login-email"
            className="mb-1.5 block text-xs font-medium text-neutral-600"
          >
            邮箱
          </label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            inputMode="email"
            required
            placeholder="you@example.com"
            className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-900/5"
          />
        </div>

        <div>
          <label
            htmlFor="login-password"
            className="mb-1.5 block text-xs font-medium text-neutral-600"
          >
            密码
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={6}
            required
            placeholder="至少 6 位"
            className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-900/5"
          />
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700"
          >
            {error}
          </p>
        ) : null}

        {notice ? (
          <p
            role="status"
            className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-700"
          >
            {notice}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="flex h-11 w-full items-center justify-center rounded-xl bg-neutral-900 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:cursor-wait disabled:opacity-60"
        >
          {loading
            ? "请稍候…"
            : mode === "login"
              ? "登录"
              : "创建账号"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-neutral-500">
        {mode === "login" ? "还没有账号？" : "已经有账号？"}{" "}
        <button
          type="button"
          onClick={() => changeMode(mode === "login" ? "signup" : "login")}
          className="font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-4 transition-colors hover:decoration-neutral-900"
        >
          {mode === "login" ? "注册一个" : "去登录"}
        </button>
      </p>
    </div>
  );
}
