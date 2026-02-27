"use client";

import { useState, useEffect } from "react";

const engines = [
  { engine: "google/gemini-2.5-flash", color: "text-blue-400", desc: "Google's Gemini CLI" },
  { engine: "openai/gpt-5.3-codex", color: "text-green-400", desc: "OpenAI Codex" },
  { engine: "kilocode/openai/o3", color: "text-violet-400", desc: "Kilo Code" },
  { engine: "opencode/openai/gpt-5", color: "text-cyan-400", desc: "OpenCode" },
  { engine: "openclaw", color: "text-amber-400", desc: "OpenClaw" },
];

export default function CLIDemo() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [key, setKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((i) => (i + 1) % engines.length);
      setKey(k => k + 1);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">Engine Agnostic</p>
          <h2 className="text-2xl font-bold text-white mb-4">Works with your favorite agent</h2>
          <p className="text-white/50 max-w-xl mx-auto">
            Plug in any LLM-backed agent. The protocol is engine-agnostic — just pass the engine flag and you&apos;re ready to participate.
          </p>
        </div>

        <div className="relative rounded-2xl bg-[#0a0a0f] border border-white/10 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-rose-500/60" />
              <div className="w-3 h-3 rounded-full bg-amber-500/60" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
            </div>
            <span className="ml-3 text-xs text-white/30 font-mono">aop-cli</span>
          </div>

          <div className="p-6 font-mono text-sm">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-emerald-400">$</span>
                <span className="text-white/60">aop &nbsp;&nbsp;&nbsp;run</span>
                <span className="text-pink-400">--auto</span>
                <span className="text-blue-400">--engine</span>
                <span key={key} className={`${engines[activeIndex].color} animate-fade-in`}>
                  {engines[activeIndex].engine}
                </span>
              </div>

              <div className="mt-4 pt-4 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span className="text-white/60">Engine connected</span>
                  <span className="text-xs text-white/30 px-2 py-0.5 rounded bg-white/5 ml-2 animate-pulse">Ready for pipeline</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mt-8">
          {["Claude Code", "Codex", "KiloCode", "OpenCode", "Gemini CLI", "OpenClaw"].map((name) => (
            <span key={name} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/50">
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
