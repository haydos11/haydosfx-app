"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "register";

const signalRows = [
  { label: "USD", bias: "Firm", value: "+0.62", tone: "emerald" },
  { label: "EUR", bias: "Soft", value: "-0.31", tone: "amber" },
  { label: "GBP", bias: "Mixed", value: "+0.08", tone: "sky" },
  { label: "JPY", bias: "Weak", value: "-0.54", tone: "rose" },
] as const;

const tags = ["Rates", "Inflation", "Yields", "COT", "Flows", "Events", "Narrative"];

const toneMap = {
  emerald: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  amber: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  sky: "border-sky-400/25 bg-sky-400/10 text-sky-200",
  rose: "border-rose-400/25 bg-rose-400/10 text-rose-200",
} as const;

function NoiseOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.055] mix-blend-screen"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140' viewBox='0 0 140 140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.95' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
        backgroundSize: "180px 180px",
      }}
    />
  );
}

function DotGrid() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.03]"
      style={{
        backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 0.7px, transparent 0.7px)",
        backgroundSize: "20px 20px",
        maskImage: "radial-gradient(circle at center, black 28%, transparent 84%)",
      }}
    />
  );
}

function ScanLines() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.04]"
      style={{
        backgroundImage:
          "repeating-linear-gradient(to bottom, rgba(255,255,255,0.10) 0px, rgba(255,255,255,0.10) 1px, transparent 2px, transparent 10px)",
        maskImage:
          "linear-gradient(to bottom, transparent, black 16%, black 84%, transparent)",
      }}
    />
  );
}

function AmbientOrb({
  className,
  delay = 0,
  duration = 14,
}: {
  className?: string;
  delay?: number;
  duration?: number;
}) {
  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{
        opacity: [0.03, 0.12, 0.05],
        scale: [1, 1.06, 1],
        x: [0, 18, 0],
        y: [0, -14, 0],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
      className={[
        "absolute rounded-full blur-3xl",
        "bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.2),rgba(59,130,246,0.1),rgba(99,102,241,0.03),transparent_72%)]",
        className ?? "",
      ].join(" ")}
    />
  );
}

function MacroNetwork() {
  return (
    <div className="relative">
      <motion.svg
        viewBox="0 0 1000 620"
        className="relative z-10 h-[450px] w-full max-w-[860px] opacity-[0.82]"
        fill="none"
        initial={{ opacity: 0, scale: 0.985, y: 16 }}
        animate={{ opacity: 0.82, scale: 1, y: 0 }}
        transition={{ duration: 1.5, delay: 1.05, ease: "easeOut" }}
      >
        <defs>
          <linearGradient id="mf-a" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(34,211,238,0.01)" />
            <stop offset="40%" stopColor="rgba(103,232,249,0.92)" />
            <stop offset="100%" stopColor="rgba(168,85,247,0.42)" />
          </linearGradient>
          <linearGradient id="mf-b" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(251,191,36,0.62)" />
            <stop offset="55%" stopColor="rgba(96,165,250,0.56)" />
            <stop offset="100%" stopColor="rgba(34,211,238,0.01)" />
          </linearGradient>
          <filter id="mf-glow">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path
          id="flow-main-1"
          d="M120 340C195 285 282 252 380 266C449 277 509 316 585 312C663 308 737 248 833 234C889 225 933 234 965 248"
          stroke="url(#mf-a)"
          strokeWidth="1.45"
          filter="url(#mf-glow)"
        />
        <path
          id="flow-main-2"
          d="M165 195C249 152 318 151 380 194C437 234 487 274 552 274C633 274 695 229 762 155C818 93 879 73 946 98"
          stroke="url(#mf-b)"
          strokeWidth="1.15"
          filter="url(#mf-glow)"
        />
        <path
          id="flow-main-3"
          d="M118 438C200 418 287 404 365 419C450 435 536 488 616 477C702 465 770 389 870 374C911 368 943 373 970 384"
          stroke="url(#mf-a)"
          strokeOpacity="0.42"
          strokeWidth="1"
        />

        <path d="M312 120L312 470" stroke="rgba(125,211,252,0.08)" strokeDasharray="4 10" />
        <path d="M606 90L606 490" stroke="rgba(125,211,252,0.07)" strokeDasharray="4 10" />
        <path d="M820 112L820 462" stroke="rgba(125,211,252,0.05)" strokeDasharray="4 10" />

        <circle cx="380" cy="266" r="5" fill="#67e8f9" />
        <circle cx="585" cy="312" r="5" fill="#7dd3fc" />
        <circle cx="833" cy="234" r="5" fill="#f0abfc" />
        <circle cx="380" cy="194" r="5" fill="#fde68a" />
        <circle cx="762" cy="155" r="5" fill="#67e8f9" />
        <circle cx="870" cy="374" r="5" fill="#7dd3fc" />

        <g opacity="0.95">
          <circle r="4.5" fill="#67e8f9" filter="url(#mf-glow)">
            <animateMotion dur="5.6s" repeatCount="indefinite" rotate="auto">
              <mpath href="#flow-main-1" />
            </animateMotion>
          </circle>
          <circle r="4" fill="#fde68a" filter="url(#mf-glow)">
            <animateMotion dur="6.8s" repeatCount="indefinite" rotate="auto">
              <mpath href="#flow-main-2" />
            </animateMotion>
          </circle>
          <circle r="3.7" fill="#7dd3fc" filter="url(#mf-glow)">
            <animateMotion dur="7.4s" repeatCount="indefinite" rotate="auto">
              <mpath href="#flow-main-3" />
            </animateMotion>
          </circle>
          <circle r="3.4" fill="#f0abfc" filter="url(#mf-glow)" opacity="0.9">
            <animateMotion dur="8.6s" repeatCount="indefinite" rotate="auto">
              <mpath href="#flow-main-1" />
            </animateMotion>
          </circle>
        </g>
      </motion.svg>
    </div>
  );
}

function MiniTicker() {
  const items = [
    "USD firm vs G10",
    "US 2Y yields rising",
    "ECB pricing softens",
    "JPY remains pressured",
    "Gold stable on risk hedge",
    "Volatility contained into data",
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2, delay: 2.2 }}
      className="absolute bottom-0 left-0 right-0 overflow-hidden border-t border-white/6 bg-black/35 backdrop-blur-md"
    >
      <motion.div
        className="flex w-max gap-8 px-6 py-3 text-[11px] uppercase tracking-[0.28em] text-slate-500"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
      >
        {[...items, ...items, ...items].map((item, i) => (
          <div key={`${item}-${i}`} className="flex items-center gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300/70 shadow-[0_0_10px_rgba(103,232,249,0.55)]" />
            <span>{item}</span>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}

function SignalCard() {
  return (
    <motion.div
      initial={{ opacity: 0, x: -28, y: 18, filter: "blur(8px)" }}
      animate={{ opacity: 1, x: 0, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 1, delay: 1.45, ease: "easeOut" }}
      className="absolute left-0 top-14 z-20 w-[320px] rounded-2xl border border-white/8 bg-black/38 p-4 shadow-[0_0_40px_rgba(0,0,0,0.45)] backdrop-blur-xl"
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-slate-600">
            Signal monitor
          </p>
          <h3 className="mt-1 text-sm font-medium text-white/90">
            Cross-market alignment
          </h3>
        </div>
        <motion.div
          animate={{ opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 2.3, repeat: Infinity }}
          className="rounded-full border border-cyan-400/20 bg-cyan-400/8 px-2.5 py-1 text-[11px] text-cyan-200"
        >
          Live
        </motion.div>
      </div>

      <div className="space-y-2.5">
        {signalRows.map((row, i) => (
          <motion.div
            key={row.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.65 + i * 0.08 }}
            className="flex items-center justify-between rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2.5"
          >
            <div>
              <p className="text-sm font-medium text-white/90">{row.label}</p>
              <p className="text-xs text-slate-500">{row.bias} macro bias</p>
            </div>
            <div className={`rounded-full border px-2.5 py-1 text-xs ${toneMap[row.tone]}`}>
              {row.value}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function WorkflowCard() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 28, y: 18, filter: "blur(8px)" }}
      animate={{ opacity: 1, x: 0, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 1, delay: 1.65, ease: "easeOut" }}
      className="absolute bottom-14 right-10 z-20 w-[290px] rounded-2xl border border-white/8 bg-white/[0.025] p-4 backdrop-blur-xl"
    >
      <p className="text-[11px] uppercase tracking-[0.28em] text-slate-600">
        Workflow
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300/80">
        {tags.map((item) => (
          <span
            key={item}
            className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1"
          >
            {item}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

function LeftSideScene() {
  return (
    <div className="relative hidden min-h-screen overflow-hidden border-r border-white/6 xl:flex xl:w-[58%]">
      <AmbientOrb className="-left-28 top-16 h-[380px] w-[380px]" delay={0.8} duration={14} />
      <AmbientOrb className="left-[30%] top-[44%] h-[440px] w-[440px]" delay={1.3} duration={16} />
      <AmbientOrb className="right-0 top-12 h-[300px] w-[300px]" delay={2.2} duration={13} />

      <ScanLines />
      <DotGrid />
      <NoiseOverlay />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, delay: 0.35 }}
        className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(34,211,238,0.05),transparent_24%),radial-gradient(circle_at_76%_18%,rgba(59,130,246,0.04),transparent_18%),radial-gradient(circle_at_52%_82%,rgba(14,165,233,0.03),transparent_24%)]"
      />

      <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-cyan-400/20 to-transparent" />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.38)_76%,rgba(0,0,0,0.82)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.7),transparent_22%,transparent_78%,rgba(0,0,0,0.72))]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.65),transparent_18%,transparent_82%,rgba(0,0,0,0.82))]" />

      <div className="relative z-10 flex w-full flex-col justify-between px-10 py-12 2xl:px-16">
        <motion.div
          initial={{ opacity: 0, y: 26, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.1, delay: 0.75, ease: "easeOut" }}
          className="max-w-2xl"
        >
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/12 bg-cyan-400/5 px-3 py-1 text-[11px] uppercase tracking-[0.32em] text-cyan-200/75">
            <motion.span
              animate={{ opacity: [0.45, 1, 0.45] }}
              transition={{ duration: 2.2, repeat: Infinity }}
              className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.75)]"
            />
            Macro intelligence terminal
          </div>

          <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.05em] text-white 2xl:text-6xl">
            MacroFlow
            <span className="block bg-gradient-to-r from-cyan-200 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
              institutional narrative,
            </span>
            <span className="block text-white/85">built for traders.</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-slate-400 2xl:text-lg">
            Rates, inflation, positioning, event risk and cross-market flow —
            brought together into one premium workspace for preparation,
            webinars and real directional bias.
          </p>
        </motion.div>

        <div className="relative mt-10 flex-1">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, filter: "blur(14px)" }}
            animate={{ opacity: 0.08, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 1.8, delay: 0.55, ease: "easeOut" }}
            className="absolute left-[14%] top-[7%] z-0 w-[500px] max-w-[50vw]"
          >
            <Image
              src="/branding/macroflow-logo.png"
              alt="MacroFlow"
              width={900}
              height={520}
              className="h-auto w-full object-contain drop-shadow-[0_0_35px_rgba(56,189,248,0.12)]"
              priority
            />
          </motion.div>

          <div className="absolute inset-x-0 top-10 flex justify-center">
            <MacroNetwork />
          </div>

          <SignalCard />
          <WorkflowCard />

          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, rotate: [0, 6, 0] }}
            transition={{
              opacity: { duration: 1.2, delay: 1.2 },
              rotate: { duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2.2 },
            }}
            className="absolute left-[18%] top-[18%] h-60 w-60 rounded-full border border-fuchsia-400/16 shadow-[0_0_80px_rgba(168,85,247,0.05)]"
          />
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, rotate: [0, -8, 0] }}
            transition={{
              opacity: { duration: 1.2, delay: 1.25 },
              rotate: { duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2.4 },
            }}
            className="absolute left-[22%] top-[22%] h-40 w-40 rounded-full border border-cyan-300/18"
          />
        </div>
      </div>

      <MiniTicker />
    </div>
  );
}

function FormInput({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] uppercase tracking-[0.25em] text-slate-600">
        {label}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/8 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-700 outline-none transition focus:border-cyan-300/35 focus:bg-black/50 focus:shadow-[0_0_0_4px_rgba(34,211,238,0.06)]"
      />
    </label>
  );
}

function RightSidePanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("signin");
  const [fullName, setFullName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  const nextPath = searchParams.get("next") || "/test-cot";

  const title = useMemo(
    () => (mode === "signin" ? "Enter workspace" : "Create access"),
    [mode],
  );

  async function handleSignIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorText("");
    setSuccessText("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setLoading(false);
      setErrorText(error.message);
      return;
    }

    router.push(nextPath);
    router.refresh();
  }

  async function handleRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorText("");
    setSuccessText("");

    const cleanEmail = email.trim();

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim() || null,
          invite_code: inviteCode.trim() || null,
        },
      },
    });

    if (error) {
      setLoading(false);
      setErrorText(error.message);
      return;
    }

    const user = data.user;

    if (user) {
      const profileResult = await supabase.from("profiles").upsert({
        id: user.id,
        email: cleanEmail,
        full_name: fullName.trim() || null,
        role: "user",
      });

      if (profileResult.error) {
        setLoading(false);
        setErrorText(profileResult.error.message);
        return;
      }

      const subResult = await supabase.from("subscriptions").upsert({
        user_id: user.id,
        status: "inactive",
        plan: "free",
      });

      if (subResult.error) {
        setLoading(false);
        setErrorText(subResult.error.message);
        return;
      }
    }

    setLoading(false);

    if (data.session) {
      router.push(nextPath);
      router.refresh();
      return;
    }

    setSuccessText(
      "Account created. Check your email to confirm your address if your Supabase auth settings require email verification.",
    );
    setMode("signin");
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    if (mode === "signin") {
      await handleSignIn(e);
      return;
    }

    await handleRegister(e);
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center px-6 py-10 xl:w-[42%] xl:px-10">
      <AmbientOrb className="right-4 top-20 h-[260px] w-[260px]" delay={1.1} duration={13} />
      <AmbientOrb className="bottom-16 left-10 h-[220px] w-[220px]" delay={1.8} duration={15} />

      <motion.div
        initial={{ opacity: 0, y: 42, scale: 0.985, filter: "blur(12px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 1.1, delay: 1.55, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[460px]"
      >
        <div className="overflow-hidden rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-[1px] shadow-[0_18px_100px_rgba(0,0,0,0.6)]">
          <div className="rounded-[29px] border border-white/6 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.05),transparent_28%),linear-gradient(180deg,rgba(2,4,8,0.98),rgba(4,7,13,0.98))] p-7 sm:p-8">
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white/8 bg-white/[0.025]">
                <Image
                  src="/branding/macroflow-logo.png"
                  alt="MacroFlow logo"
                  fill
                  className="object-contain p-1.5"
                  priority
                />
              </div>

              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/12 bg-cyan-400/5 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-cyan-200/75">
                  Premium access
                </div>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
                  MacroFlow
                </h2>
                <p className="mt-1 text-[11px] uppercase tracking-[0.35em] text-slate-600">
                  Research • narrative • execution
                </p>
              </div>
            </div>

            <div className="mt-8 inline-flex rounded-full border border-white/8 bg-white/[0.025] p-1">
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setErrorText("");
                  setSuccessText("");
                }}
                className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.25em] transition ${
                  mode === "signin"
                    ? "bg-cyan-400/10 text-cyan-200 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.16)]"
                    : "text-slate-500 hover:text-slate-200"
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setErrorText("");
                  setSuccessText("");
                }}
                className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.25em] transition ${
                  mode === "register"
                    ? "bg-fuchsia-400/10 text-fuchsia-200 shadow-[inset_0_0_0_1px_rgba(217,70,239,0.16)]"
                    : "text-slate-500 hover:text-slate-200"
                }`}
              >
                Register
              </button>
            </div>

            <div className="mt-8">
              <h3 className="text-xl font-medium text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Access your premium macro dashboard, currency health models,
                event risk map and webinar workflow.
              </p>
            </div>

            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
              {mode === "register" && (
                <FormInput
                  label="Full name"
                  placeholder="Max Pips"
                  value={fullName}
                  onChange={setFullName}
                  autoComplete="name"
                />
              )}

              <FormInput
                label="Email"
                type="email"
                placeholder="you@macroflow.com"
                value={email}
                onChange={setEmail}
                autoComplete="email"
              />

              <FormInput
                label="Password"
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={setPassword}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />

              {mode === "register" && (
                <FormInput
                  label="Invite code"
                  placeholder="Optional for early access"
                  value={inviteCode}
                  onChange={setInviteCode}
                />
              )}

              {errorText ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {errorText}
                </div>
              ) : null}

              {successText ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  {successText}
                </div>
              ) : null}

              <motion.button
                whileHover={{ y: -1, scale: 1.01 }}
                whileTap={{ scale: 0.995 }}
                type="submit"
                disabled={loading}
                className="group relative mt-2 inline-flex w-full items-center justify-center overflow-hidden rounded-xl border border-cyan-300/12 bg-[linear-gradient(90deg,rgba(8,145,178,0.75),rgba(37,99,235,0.72),rgba(79,70,229,0.68))] px-4 py-3.5 text-sm font-medium text-white shadow-[0_10px_35px_rgba(8,145,178,0.14)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="absolute inset-0 -translate-x-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.14),transparent)] transition duration-1000 group-hover:translate-x-full" />
                <span className="relative z-10">
                  {loading
                    ? "Please wait..."
                    : mode === "signin"
                      ? "Enter MacroFlow"
                      : "Create account"}
                  <span className="ml-2 inline-block transition group-hover:translate-x-0.5">→</span>
                </span>
              </motion.button>
            </form>

            <div className="mt-6 flex items-center gap-3 text-xs text-slate-600">
              <div className="h-px flex-1 bg-white/8" />
              secure research workspace
              <div className="h-px flex-1 bg-white/8" />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                ["AI Narrative", "Contextual market read"],
                ["Currency Health", "Multi-factor score"],
                ["Macro Calendar", "Event risk mapped"],
                ["Positioning", "COT and flow view"],
              ].map(([heading, sub], i) => (
                <motion.div
                  key={heading}
                  initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 0.8, delay: 1.95 + i * 0.08 }}
                  className="rounded-2xl border border-white/8 bg-white/[0.02] p-3.5"
                >
                  <div className="text-sm font-medium text-white/92">{heading}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">{sub}</div>
                </motion.div>
              ))}
            </div>

            <p className="mt-6 text-center text-xs text-slate-600">
              Built for premium dashboards, member access and webinar workflow.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function MacroflowPremiumAuthV2() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.95, ease: "easeOut" }}
        className="pointer-events-none absolute inset-0 z-[60] bg-black"
      />

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.96),rgba(0,0,0,1))]" />
      <div className="absolute inset-0 opacity-[0.02] [background:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:22px_22px]" />
      <NoiseOverlay />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.02, 0.05, 0.025] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1.0 }}
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.08),transparent_34%)]"
      />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.42)_76%,rgba(0,0,0,0.84)_100%)]" />
      <div className="absolute inset-y-0 left-[58%] hidden w-px -translate-x-px bg-gradient-to-b from-transparent via-cyan-300/14 to-transparent xl:block" />

      <div className="relative flex min-h-screen flex-col xl:flex-row">
        <LeftSideScene />
        <RightSidePanel />
      </div>
    </main>
  );
}