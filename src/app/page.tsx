"use client";

import { useState, useCallback } from "react";
import { formatVtlTemplate } from "@/lib/format-vtl";
import { Copy, Check, Sparkles, Code2, ArrowRight, Github, Zap } from "lucide-react";

function App() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);

  const formatVTL = useCallback(() => {
    setIsFormatting(true);

    setTimeout(() => {
      try {
        setOutput(formatVtlTemplate(input));
      } catch (error: unknown) {
        console.error("Error formatting VTL:", error);
        setOutput(`Error: ${(error as Error).message}`);
      }
      setIsFormatting(false);
    }, 300);
  }, [input]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  }, [output]);

  const inputLineCount = input.split("\n").length;
  const outputLineCount = output.split("\n").length;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#09090b]">
      {/* Background layers */}
      <div className="grid-pattern absolute inset-0" />
      <div className="noise-overlay" />
      
      {/* Ambient glow effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-[300px] -top-[300px] h-[600px] w-[600px] rounded-full bg-amber-500/5 blur-[120px]" />
        <div className="absolute -bottom-[200px] -right-[200px] h-[500px] w-[500px] rounded-full bg-amber-600/5 blur-[100px]" />
        <div className="absolute left-1/2 top-1/3 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-orange-500/3 blur-[80px]" />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex h-full flex-col">
        {/* Header */}
        <header className="animate-fade-in-up border-b border-white/5 px-6 py-5 md:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/20">
                <Code2 className="h-5 w-5 text-black" />
              </div>
              <div>
                <h1 className="font-display text-xl font-semibold tracking-tight text-white md:text-2xl">
                  VTL Formatter
                </h1>
                <p className="hidden text-sm text-zinc-500 md:block">
                  Apache Velocity Template Language
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <a
                href="https://github.com/sandepten/vtl-formatter"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
              >
                <Github className="h-4 w-4" />
              </a>
            </div>
          </div>
        </header>

        {/* Main editor area */}
        <main className="flex flex-1 flex-col overflow-hidden p-4 md:p-6 lg:p-8">
          <div className="mx-auto flex h-full w-full max-w-7xl flex-1 flex-col gap-4 md:flex-row md:gap-6">
            {/* Input Panel */}
            <section className="animate-slide-in-left delay-100 flex h-full min-h-[300px] flex-1 flex-col rounded-2xl border border-zinc-800 bg-zinc-900/90 p-1 opacity-0 md:min-h-0">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-zinc-600" />
                    <div className="h-3 w-3 rounded-full bg-zinc-600" />
                    <div className="h-3 w-3 rounded-full bg-zinc-600" />
                  </div>
                  <span className="font-display text-sm font-medium text-zinc-200">
                    Input
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span>{inputLineCount} lines</span>
                </div>
              </div>
              
              <div className="flex-1 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                <textarea
                  className="h-full w-full resize-none bg-transparent p-4 font-mono text-sm leading-relaxed text-zinc-100 placeholder-zinc-500 focus:outline-none"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Paste your unformatted VTL code here..."
                  spellCheck={false}
                />
              </div>
            </section>

            {/* Center action area */}
            <div className="animate-fade-in delay-200 flex flex-shrink-0 items-center justify-center opacity-0 md:flex-col md:gap-4 md:py-8">
              <button
                onClick={formatVTL}
                disabled={!input.trim() || isFormatting}
                className="btn-shine group relative flex h-12 w-[140px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 font-display text-sm font-semibold text-black shadow-lg shadow-amber-500/30 transition-all hover:from-amber-500 hover:to-amber-600 hover:shadow-xl hover:shadow-amber-500/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none md:h-14 md:w-[160px]"
              >
                {isFormatting ? (
                  <>
                    <Sparkles className="h-4 w-4 animate-spin" />
                    <span>Formatting</span>
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 transition-transform group-hover:scale-110" />
                    <span>Format</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
              
              {/* Decorative line */}
              <div className="hidden h-24 w-px bg-gradient-to-b from-transparent via-zinc-600 to-transparent md:block" />
            </div>

            {/* Output Panel */}
            <section className="animate-slide-in-right delay-300 flex h-full min-h-[300px] flex-1 flex-col rounded-2xl border border-zinc-800 bg-zinc-900/90 p-1 opacity-0 md:min-h-0">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-emerald-500" />
                    <div className="h-3 w-3 rounded-full bg-zinc-600" />
                    <div className="h-3 w-3 rounded-full bg-zinc-600" />
                  </div>
                  <span className="font-display text-sm font-medium text-zinc-200">
                    Output
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400">{output ? `${outputLineCount} lines` : ""}</span>
                  <button
                    onClick={handleCopy}
                    disabled={!output}
                    className={`flex h-8 w-[72px] items-center justify-center gap-1.5 rounded-lg border text-xs font-medium transition-all ${
                      copied
                        ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
                        : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                <textarea
                  className="h-full w-full resize-none bg-transparent p-4 font-mono text-sm leading-relaxed text-zinc-100 placeholder-zinc-500 focus:outline-none"
                  value={output}
                  readOnly
                  placeholder="Formatted VTL will appear here..."
                  spellCheck={false}
                />
              </div>
            </section>
          </div>
        </main>

        {/* Footer */}
        <footer className="animate-fade-in delay-400 border-t border-zinc-800 px-6 py-4 opacity-0">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>All processing done locally</span>
              </div>
            </div>
            <p className="text-xs text-zinc-400">
              Built by{" "}
              <a
                href="https://github.com/sandepten"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-300 transition-colors hover:text-amber-400"
              >
                Sandeep Kumar
              </a>
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
