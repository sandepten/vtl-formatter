"use client";

import { useState, useCallback } from "react";
import {
  adjustForEachCondition,
  extractCondition,
  isComplexVariableReference,
  normalizeLogicalOperators,
  tokenize,
  SIMPLE_DIRECTIVES,
} from "@/lib/vtl";
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
        const tokens = tokenize(input);
        const indentSize = 2;
        let formattedVTL = "";
        const indentStack: number[] = [0];
        let needsNewline = false;
        let inlineMode = false;
        let processingSet = false;
        let setParenCount = 0;
        let lastTokenWasComment = false;
        let lastTokenWasVariable = false;

        let inJsonValueVar = false;
        let jsonVarBraceCount = 0;

        let inMacroHeader = false;
        let macroParenCount = 0;

        let inDirectiveHeader = false;
        let directiveParenCount = 0;

        let lastTokenNeedsSpace = false;

        const currentIndent = () =>
          " ".repeat(indentStack[indentStack.length - 1]!);

        for (let i = 0; i < tokens.length; i++) {
          const token = tokens[i];
          if (!token) continue;

          if (token.type === "newline") {
            continue;
          }

          if (token.type === "whitespace") {
            lastTokenNeedsSpace = true;
            continue;
          }

          if (token.type !== "comment" && token.type !== "multiline_comment") {
            lastTokenWasComment = false;
          }

          if (token.type === "unparsed") {
            if (formattedVTL.length > 0 && !formattedVTL.endsWith("\n")) {
              formattedVTL += "\n" + currentIndent();
            }
            formattedVTL += token.value;
            needsNewline = true;
            lastTokenNeedsSpace = false;
            continue;
          }

          if (token.type === "multiline_comment") {
            if (formattedVTL.length > 0 && !formattedVTL.endsWith("\n")) {
              formattedVTL += "\n" + currentIndent();
            } else if (formattedVTL.endsWith("\n")) {
              formattedVTL += currentIndent();
            }
            formattedVTL += token.value;
            needsNewline = true;
            lastTokenNeedsSpace = false;
            continue;
          }

          if (
            token.type === "punctuation" &&
            token.value === ":" &&
            i + 1 < tokens.length
          ) {
            let nextIdx = i + 1;
            while (nextIdx < tokens.length && tokens[nextIdx]?.type === "whitespace") {
              nextIdx++;
            }
            if (
              tokens[nextIdx]?.type === "variable" ||
              isComplexVariableReference(tokens, nextIdx)
            ) {
              formattedVTL += token.value + " ";
              inJsonValueVar = true;
              lastTokenNeedsSpace = false;
              continue;
            }
          }

          if (inJsonValueVar && token.type === "variable") {
            formattedVTL += token.value;
            if (
              token.value.startsWith("${") ||
              token.value.startsWith("$!{")
            ) {
              inJsonValueVar = false;
            } else if (
              !token.value.includes("{") &&
              token.value !== "$" &&
              token.value !== "$!"
            ) {
              inJsonValueVar = false;
            }
            lastTokenWasVariable = true;
            lastTokenNeedsSpace = false;
            continue;
          }

          if (inJsonValueVar && token.type === "punctuation") {
            formattedVTL += token.value;

            if (token.value === "{") {
              jsonVarBraceCount++;
            } else if (token.value === "}") {
              jsonVarBraceCount--;
              if (jsonVarBraceCount <= 0) {
                inJsonValueVar = false;
              }
            }
            lastTokenNeedsSpace = false;
            continue;
          }

          if (
            lastTokenWasVariable &&
            token.type === "string" &&
            token.value.startsWith('"')
          ) {
            let nextIdx = i + 1;
            while (nextIdx < tokens.length && tokens[nextIdx]?.type === "whitespace") {
              nextIdx++;
            }
            if (
              tokens[nextIdx]?.type === "punctuation" &&
              tokens[nextIdx]?.value === ":"
            ) {
              formattedVTL += "\n" + currentIndent();
              lastTokenWasVariable = false;
            }
          }

          if (
            !processingSet &&
            !inJsonValueVar &&
            inlineMode &&
            token.type === "string" &&
            (token.value.startsWith('"') || token.value.startsWith("'"))
          ) {
            const isShortString =
              token.value.length === 3 &&
              ((token.value.startsWith('"') && token.value.endsWith('"')) ||
                (token.value.startsWith("'") && token.value.endsWith("'")));

            if (!isShortString) {
              formattedVTL += "\n" + currentIndent();
              inlineMode = false;
            }
          }

          if (inMacroHeader) {
            formattedVTL += token.value;
            if (token.type === "punctuation") {
              if (token.value === "(") {
                macroParenCount++;
              } else if (token.value === ")") {
                macroParenCount--;
                if (macroParenCount === 0) {
                  inMacroHeader = false;
                  needsNewline = true;
                }
              }
            }
            lastTokenNeedsSpace = false;
            continue;
          }

          if (inDirectiveHeader) {
            formattedVTL += token.value;
            if (token.type === "punctuation") {
              if (token.value === "(") {
                directiveParenCount++;
              } else if (token.value === ")") {
                directiveParenCount--;
                if (directiveParenCount === 0) {
                  inDirectiveHeader = false;
                  needsNewline = true;
                }
              }
            }
            lastTokenNeedsSpace = false;
            continue;
          }

          if (token.type === "directive" && token.value === "#macro") {
            if (formattedVTL.length > 0 && !formattedVTL.endsWith("\n")) {
              formattedVTL += "\n" + currentIndent();
            } else if (formattedVTL.endsWith("\n")) {
              formattedVTL += currentIndent();
            }
            formattedVTL += token.value;
            let nextIdx = i + 1;
            while (nextIdx < tokens.length && tokens[nextIdx]?.type === "whitespace") {
              nextIdx++;
            }
            if (
              tokens[nextIdx]?.type === "punctuation" &&
              tokens[nextIdx]?.value === "("
            ) {
              inMacroHeader = true;
              macroParenCount = 0;
            }
            lastTokenNeedsSpace = false;
            continue;
          }

          const directiveValue = token.value.trim();
          const directiveName = directiveValue.replace(/^#/, "").toLowerCase();

          if (
            !processingSet &&
            !inJsonValueVar &&
            inlineMode &&
            token.type === "string" &&
            token.value.startsWith('"')
          ) {
            formattedVTL += "\n" + currentIndent();
            inlineMode = false;
          }

          if (needsNewline && !inlineMode && !inJsonValueVar) {
            formattedVTL += "\n" + currentIndent();
            needsNewline = false;
          }

          if (
            !processingSet &&
            !inJsonValueVar &&
            token.type === "directive" &&
            !directiveValue.startsWith("#set") &&
            inlineMode
          ) {
            formattedVTL += "\n" + currentIndent();
            inlineMode = false;
          }

          switch (token.type) {
            case "directive":
              if (directiveValue === "#end") {
                indentStack.pop();
                formattedVTL += "\n" + currentIndent() + token.value;
                needsNewline = true;
              } else if (directiveName === "elseif") {
                indentStack.pop();
                const conditionResult = extractCondition(tokens, i + 1);
                let condition = conditionResult.condition;
                condition = normalizeLogicalOperators(condition);
                i = conditionResult.index;
                formattedVTL += "\n" + currentIndent() + "#elseif" + condition;
                indentStack.push(
                  indentStack[indentStack.length - 1]! + indentSize,
                );
                needsNewline = true;
              } else if (directiveName === "else") {
                indentStack.pop();
                formattedVTL += "\n" + currentIndent() + "#else";
                indentStack.push(
                  indentStack[indentStack.length - 1]! + indentSize,
                );
                needsNewline = true;
              } else if (directiveName === "if") {
                const conditionResult = extractCondition(tokens, i + 1);
                let condition = conditionResult.condition;
                condition = normalizeLogicalOperators(condition);
                i = conditionResult.index;
                formattedVTL += "\n" + currentIndent() + "#if" + condition;
                indentStack.push(
                  indentStack[indentStack.length - 1]! + indentSize,
                );
                needsNewline = true;
              } else if (directiveName === "foreach") {
                const conditionResult = extractCondition(tokens, i + 1);
                let condition = conditionResult.condition;
                condition = adjustForEachCondition(condition);
                i = conditionResult.index;
                formattedVTL += "\n" + currentIndent() + "#foreach" + condition;
                indentStack.push(
                  indentStack[indentStack.length - 1]! + indentSize,
                );
                needsNewline = true;
              } else if (directiveName === "define") {
                const conditionResult = extractCondition(tokens, i + 1);
                const condition = conditionResult.condition;
                i = conditionResult.index;
                formattedVTL += "\n" + currentIndent() + "#define" + condition;
                indentStack.push(
                  indentStack[indentStack.length - 1]! + indentSize,
                );
                needsNewline = true;
              } else if (directiveName === "set") {
                if (formattedVTL.length > 0 && !formattedVTL.endsWith("\n")) {
                  formattedVTL += "\n" + currentIndent();
                } else if (formattedVTL.endsWith("\n")) {
                  formattedVTL += currentIndent();
                }
                formattedVTL += token.value;
                processingSet = true;
                inlineMode = true;
                setParenCount = 0;
              } else if (SIMPLE_DIRECTIVES.includes(directiveName)) {
                if (formattedVTL.length > 0 && !formattedVTL.endsWith("\n")) {
                  formattedVTL += "\n" + currentIndent();
                } else if (formattedVTL.endsWith("\n")) {
                  formattedVTL += currentIndent();
                }
                formattedVTL += token.value;

                if (directiveName !== "stop" && directiveName !== "break") {
                  let nextIdx = i + 1;
                  while (nextIdx < tokens.length && tokens[nextIdx]?.type === "whitespace") {
                    nextIdx++;
                  }
                  if (
                    tokens[nextIdx]?.type === "punctuation" &&
                    tokens[nextIdx]?.value === "("
                  ) {
                    inDirectiveHeader = true;
                    directiveParenCount = 0;
                  }
                } else {
                  needsNewline = true;
                }
              } else {
                if (formattedVTL.length > 0 && !formattedVTL.endsWith("\n")) {
                  formattedVTL += "\n" + currentIndent();
                } else if (formattedVTL.endsWith("\n")) {
                  formattedVTL += currentIndent();
                }
                formattedVTL += token.value;
                needsNewline = true;
              }
              lastTokenNeedsSpace = false;
              break;

            case "punctuation":
              if (token.value === "{" && !inJsonValueVar) {
                if (!formattedVTL.endsWith("\n")) {
                  formattedVTL += "\n" + currentIndent();
                } else {
                  formattedVTL += currentIndent();
                }
                formattedVTL += token.value;
                indentStack.push(
                  indentStack[indentStack.length - 1]! + indentSize,
                );
                needsNewline = true;
              } else if (token.value === "}" && !inJsonValueVar) {
                indentStack.pop();
                formattedVTL += "\n" + currentIndent() + token.value;
                needsNewline = true;
              } else if (token.value === "[" && !inJsonValueVar && !processingSet) {
                formattedVTL += token.value;
              } else if (token.value === "]" && !inJsonValueVar && !processingSet) {
                formattedVTL += token.value;
              } else if (token.value === "(" || token.value === ")") {
                if (processingSet) {
                  if (token.value === "(") {
                    setParenCount++;
                    formattedVTL += token.value;
                  } else if (token.value === ")") {
                    setParenCount--;
                    formattedVTL += token.value;
                    if (setParenCount === 0) {
                      processingSet = false;
                      inlineMode = false;
                      formattedVTL += "\n" + currentIndent();
                    }
                    lastTokenNeedsSpace = false;
                    continue;
                  }
                } else {
                  formattedVTL += token.value;
                }
              } else if (token.value === "," && !inJsonValueVar) {
                formattedVTL += token.value;
                needsNewline = true;
              } else if (token.value === ":") {
                formattedVTL += token.value + " ";
              } else {
                formattedVTL += token.value;
              }
              lastTokenNeedsSpace = false;
              break;

            case "comment":
              if (lastTokenWasComment) {
                formattedVTL += "\n" + currentIndent() + token.value;
              } else {
                if (formattedVTL && !formattedVTL.endsWith("\n") && !formattedVTL.endsWith(" ")) {
                  formattedVTL += " " + token.value;
                } else if (formattedVTL.endsWith("\n")) {
                  formattedVTL += currentIndent() + token.value;
                } else {
                  formattedVTL += token.value;
                }
              }
              lastTokenWasComment = true;
              needsNewline = true;
              lastTokenNeedsSpace = false;
              break;

            case "variable":
              if (lastTokenNeedsSpace && formattedVTL.length > 0) {
                const lastChar = formattedVTL[formattedVTL.length - 1];
                if (lastChar && !/[\s(\[{:,]/.test(lastChar)) {
                  formattedVTL += " ";
                }
              }
              formattedVTL += token.value;
              lastTokenWasVariable = true;
              lastTokenNeedsSpace = false;
              break;

            case "operator":
              if (formattedVTL.length > 0 && !formattedVTL.endsWith(" ") && !formattedVTL.endsWith("\n")) {
                formattedVTL += " ";
              }
              formattedVTL += token.value;
              formattedVTL += " ";
              lastTokenNeedsSpace = false;
              break;

            case "keyword":
              if (lastTokenNeedsSpace && formattedVTL.length > 0) {
                const lastChar = formattedVTL[formattedVTL.length - 1];
                if (lastChar && !/[\s]/.test(lastChar)) {
                  formattedVTL += " ";
                }
              }
              formattedVTL += token.value;
              lastTokenNeedsSpace = true;
              break;

            case "string":
              if (lastTokenNeedsSpace && formattedVTL.length > 0) {
                const lastChar = formattedVTL[formattedVTL.length - 1];
                if (lastChar && !/[\s(\[{:,]/.test(lastChar)) {
                  formattedVTL += " ";
                }
              }
              formattedVTL += token.value;
              lastTokenWasVariable = false;
              lastTokenNeedsSpace = false;
              break;

            case "number":
              if (lastTokenNeedsSpace && formattedVTL.length > 0) {
                const lastChar = formattedVTL[formattedVTL.length - 1];
                if (lastChar && !/[\s(\[{:,]/.test(lastChar)) {
                  formattedVTL += " ";
                }
              }
              formattedVTL += token.value;
              lastTokenNeedsSpace = false;
              break;

            case "identifier":
              if (lastTokenNeedsSpace && formattedVTL.length > 0) {
                const lastChar = formattedVTL[formattedVTL.length - 1];
                if (lastChar && !/[\s(\[{:,]/.test(lastChar)) {
                  formattedVTL += " ";
                }
              }
              formattedVTL += token.value;
              lastTokenNeedsSpace = false;
              break;

            case "text":
              if (lastTokenNeedsSpace && formattedVTL.length > 0) {
                const lastChar = formattedVTL[formattedVTL.length - 1];
                if (lastChar && !/[\s]/.test(lastChar)) {
                  formattedVTL += " ";
                }
              }
              formattedVTL += token.value;
              lastTokenNeedsSpace = false;
              break;

            default:
              if (lastTokenNeedsSpace && formattedVTL.length > 0) {
                const lastChar = formattedVTL[formattedVTL.length - 1];
                if (lastChar && !/[\s(\[{:,]/.test(lastChar)) {
                  formattedVTL += " ";
                }
              }
              formattedVTL += token.value;
              lastTokenWasVariable = false;
              lastTokenNeedsSpace = false;
          }
        }

        formattedVTL = formattedVTL.replace(/\n\s*\n/g, "\n");
        formattedVTL = formattedVTL.replace(/ +$/gm, "");
        setOutput(formattedVTL.trim());
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
