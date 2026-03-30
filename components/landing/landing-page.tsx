"use client";

import Link from "next/link";
import {
  TrendingUp, ArrowRight, Sparkles, Brain, Target, BarChart3,
  Shield, BookOpen, Zap, ChevronRight, CheckCircle2, MessageCircle,
  LineChart, Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Landing Page ─────────────────────────────────────────────────────────────

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#08070a] text-white antialiased overflow-x-hidden">
      <Nav />
      <Hero />
      <Problem />
      <Solution />
      <HowItWorks />
      <Features />
      <WhyDifferent />
      <Premium />
      <FinalCTA />
      <Footer />
    </div>
  );
}

// ── Nav ──────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.04] bg-[#08070a]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-cyan-400 to-violet-500">
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
            TradeFlow
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-zinc-400 transition-colors hover:text-white">
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white transition-shadow hover:shadow-lg hover:shadow-cyan-500/20"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative px-5 pt-24 pb-20 md:pt-32 md:pb-28">
      {/* Glow effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-cyan-500/[0.07] blur-[120px]" />
        <div className="absolute right-1/4 top-1/3 h-[300px] w-[400px] rounded-full bg-violet-500/[0.05] blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-3xl text-center space-y-6">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/[0.06] px-3 py-1 text-xs font-medium text-cyan-400">
          <Sparkles className="h-3 w-3" /> AI-powered trading journal
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl md:leading-[1.1]">
          Trade better with an assistant{" "}
          <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
            that adapts to you.
          </span>
        </h1>

        <p className="mx-auto max-w-xl text-lg text-zinc-400 leading-relaxed">
          TradeFlow learns your style, tracks your behavior, and coaches you through every trade.
          No generic tips. No cookie-cutter plans. Just you, your data, and an AI that actually gets it.
        </p>

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-6 py-3 text-sm font-bold text-white transition-all hover:shadow-xl hover:shadow-cyan-500/20 hover:scale-[1.02]"
          >
            Get Started Free <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-sm font-medium text-zinc-300 transition-all hover:bg-white/[0.06] hover:text-white"
          >
            See How It Works <ChevronRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

// ── Problem ──────────────────────────────────────────────────────────────────

function Problem() {
  const problems = [
    "You take trades without a plan, then regret them.",
    "You revenge trade after a loss and make it worse.",
    "You journal sometimes, but never review properly.",
    "You know the theory, but can't execute consistently.",
  ];

  return (
    <section className="px-5 py-20 border-t border-white/[0.04]">
      <div className="mx-auto max-w-4xl text-center space-y-8">
        <p className="text-xs font-bold uppercase tracking-widest text-red-400/80">Sound familiar?</p>
        <h2 className="text-2xl font-extrabold md:text-3xl">
          Most traders know what to do.<br />
          <span className="text-zinc-500">They just can't make themselves do it.</span>
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {problems.map((p) => (
            <div key={p} className="flex items-start gap-3 rounded-xl border border-red-500/10 bg-red-500/[0.03] px-4 py-3 text-left">
              <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
              <p className="text-sm text-zinc-400">{p}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Solution ─────────────────────────────────────────────────────────────────

function Solution() {
  return (
    <section className="px-5 py-20 border-t border-white/[0.04]">
      <div className="mx-auto max-w-4xl text-center space-y-6">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-400/80">The solution</p>
        <h2 className="text-2xl font-extrabold md:text-3xl">
          An assistant that learns you,<br />
          <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
            not just your trades.
          </span>
        </h2>
        <p className="mx-auto max-w-xl text-zinc-400 leading-relaxed">
          TradeFlow starts with a 5-question onboarding that understands your level, goals, and weaknesses.
          From there, every insight, every review, every suggestion is personalized to you.
        </p>

        <div className="grid gap-4 sm:grid-cols-3 mt-8">
          {[
            { icon: Brain, label: "Learns your style", desc: "Adapts coaching based on your experience and goals" },
            { icon: Target, label: "Spots your patterns", desc: "Identifies recurring mistakes before you do" },
            { icon: MessageCircle, label: "Talks your language", desc: "Direct, gentle, or tough — you choose the tone" },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 text-center space-y-2">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10">
                <Icon className="h-5 w-5 text-cyan-400" />
              </div>
              <p className="text-sm font-bold text-white">{label}</p>
              <p className="text-xs text-zinc-500">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── How It Works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    { num: "01", title: "Answer 5 questions", desc: "Your level, goals, problems, and preferred coaching style.", icon: Sparkles },
    { num: "02", title: "Get your assistant", desc: "A personalized AI coach configured to your exact needs.", icon: Brain },
    { num: "03", title: "Log and review trades", desc: "Manual entry, CSV import, or screenshot — your journal adapts.", icon: LineChart },
    { num: "04", title: "Improve every day", desc: "AI autopsy, playbook tracking, and behavioral pattern detection.", icon: Zap },
  ];

  return (
    <section id="how-it-works" className="px-5 py-20 border-t border-white/[0.04] scroll-mt-16">
      <div className="mx-auto max-w-4xl space-y-10">
        <div className="text-center space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-violet-400/80">How it works</p>
          <h2 className="text-2xl font-extrabold md:text-3xl">Four steps to trading clarity.</h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {steps.map(({ num, title, desc, icon: Icon }) => (
            <div key={num} className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all hover:border-cyan-500/20 hover:bg-cyan-500/[0.02]">
              <div className="flex items-start gap-4">
                <span className="text-3xl font-extrabold text-cyan-500/20 group-hover:text-cyan-500/40 transition-colors">{num}</span>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-cyan-400" />
                    <p className="text-sm font-bold text-white">{title}</p>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Features ─────────────────────────────────────────────────────────────────

function Features() {
  const features = [
    { icon: BookOpen, title: "Smart Journal", desc: "Log trades manually, from CSV, or from screenshots. AI extracts the data for you." },
    { icon: Brain, title: "AI Trade Autopsy", desc: "Every closed trade gets a structured review: what went right, what went wrong, and the key lesson." },
    { icon: Layers, title: "Playbook System", desc: "Define repeatable setups with entry, invalidation, and target rules. Use templates or let AI generate them." },
    { icon: BarChart3, title: "Advanced Charts", desc: "Lightweight Charts with SMC overlays, indicators, drawings, and live price updates." },
    { icon: Shield, title: "Paper Trading", desc: "Practice with simulated funds, real instrument configs, leverage, and accurate PnL." },
    { icon: Target, title: "Decision Engine", desc: "Checklist your confluences before entering. The engine tells you if the setup is valid." },
  ];

  return (
    <section className="px-5 py-20 border-t border-white/[0.04]">
      <div className="mx-auto max-w-5xl space-y-10">
        <div className="text-center space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-400/80">Features</p>
          <h2 className="text-2xl font-extrabold md:text-3xl">Everything a serious trader needs.</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3 transition-all hover:border-white/[0.12] hover:bg-white/[0.04]">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/15 to-violet-500/15">
                <Icon className="h-4.5 w-4.5 text-cyan-400" />
              </div>
              <p className="text-sm font-bold text-white">{title}</p>
              <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Why Different ────────────────────────────────────────────────────────────

function WhyDifferent() {
  const points = [
    "It remembers your mistakes — and reminds you before you repeat them.",
    "It doesn't just log trades — it tells you WHY you lost.",
    "It doesn't give generic advice — it gives YOUR advice, based on YOUR data.",
    "It grows with you — from beginner to advanced, it adapts.",
  ];

  return (
    <section className="px-5 py-20 border-t border-white/[0.04]">
      <div className="mx-auto max-w-3xl text-center space-y-8">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-violet-400/80">Why it feels different</p>
          <h2 className="text-2xl font-extrabold md:text-3xl">
            This is not another trading journal.
          </h2>
        </div>

        <div className="space-y-3 text-left max-w-xl mx-auto">
          {points.map((p) => (
            <div key={p} className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
              <p className="text-sm text-zinc-400">{p}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Premium ──────────────────────────────────────────────────────────────────

function Premium() {
  return (
    <section className="px-5 py-20 border-t border-white/[0.04]">
      <div className="mx-auto max-w-2xl text-center space-y-4">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">Built for traders who are serious about improvement</p>
        <h2 className="text-2xl font-extrabold md:text-3xl bg-gradient-to-r from-cyan-400 via-white to-violet-400 bg-clip-text text-transparent">
          Your edge is not a strategy.<br />
          It is self-awareness.
        </h2>
        <p className="text-zinc-500 text-sm leading-relaxed">
          TradeFlow is the tool that turns your trading data into personal growth.
          Every trade reviewed. Every pattern tracked. Every weakness addressed.
        </p>
      </div>
    </section>
  );
}

// ── Final CTA ────────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="px-5 py-24 border-t border-white/[0.04]">
      <div className="relative mx-auto max-w-lg text-center space-y-6">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[500px] rounded-full bg-cyan-500/[0.06] blur-[100px]" />
        </div>

        <h2 className="text-2xl font-extrabold md:text-3xl">
          Ready to trade with clarity?
        </h2>
        <p className="text-zinc-500 text-sm">
          Start free. No credit card required.
        </p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-8 py-3.5 text-sm font-bold text-white transition-all hover:shadow-xl hover:shadow-cyan-500/20 hover:scale-[1.02]"
        >
          Create Your Account <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

// ── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-white/[0.04] px-5 py-8">
      <div className="mx-auto max-w-6xl flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-zinc-600">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-cyan-500/30 to-violet-500/30">
            <TrendingUp className="h-3 w-3 text-zinc-400" />
          </div>
          TradeFlow
        </div>
        <p className="text-xs text-zinc-700">
          Built for traders who want to improve, not just track.
        </p>
      </div>
    </footer>
  );
}
