"use client";

import { useState, useCallback } from "react";
import {
  adjustForEachCondition,
  extractCondition,
  isComplexVariableReference,
  normalizeLogicalOperators,
  tokenize,
} from "@/lib/vtl";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";

function App() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);

  const formatVTL = useCallback(() => {
    setIsFormatting(true);

    // Use setTimeout to allow UI to update before processing
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
        let lastTokenWasComment = false; // For handling consecutive comments
        let lastTokenWasVariable = false; // Track if the last token was a variable

        // Track when we're in a JSON key-value pair with a variable value
        let inJsonValueVar = false;
        let jsonVarBraceCount = 0;

        // For handling inline macro headers.
        let inMacroHeader = false;
        let macroParenCount = 0;

        const currentIndent = () =>
          " ".repeat(indentStack[indentStack.length - 1]!);

        for (let i = 0; i < tokens.length; i++) {
          const token = tokens[i];
          if (!token) continue;

          // Reset comment flag if token is not a comment.
          if (token.type !== "comment") {
            lastTokenWasComment = false;
          }

          // Check if we're starting a JSON key-value pair with a variable value
          if (
            token.type === "punctuation" &&
            token.value === ":" &&
            i + 1 < tokens.length &&
            (tokens[i + 1]?.type === "variable" ||
              isComplexVariableReference(tokens, i + 1))
          ) {
            formattedVTL += token.value;
            inJsonValueVar = true;
            continue;
          }

          // Handle variables in JSON values (both simple $var and complex ${var} formats)
          if (inJsonValueVar && token.type === "variable") {
            formattedVTL += token.value;
            // If this is the start of a complex variable reference with separate $ and {
            if (
              token.value === "$" &&
              i + 1 < tokens.length &&
              tokens[i + 1]?.type === "punctuation" &&
              tokens[i + 1]?.value === "{"
            ) {
              // Don't set lastTokenWasVariable or modify inJsonValueVar yet - wait for the opening brace
              continue;
            }
            // If this is a complete variable reference or a simple $var
            if (token.value.includes("{") && token.value.includes("}")) {
              inJsonValueVar = false;
            } else if (!token.value.includes("{")) {
              inJsonValueVar = false;
            }
            lastTokenWasVariable = true;
            continue;
          }

          // Handle braces as part of a complex variable reference
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
            continue;
          }

          // Check if we need to insert a newline after a variable when followed by a JSON key
          if (
            lastTokenWasVariable &&
            token.type === "string" &&
            token.value.startsWith('"') &&
            i + 2 < tokens.length &&
            tokens[i + 1]?.type === "punctuation" &&
            tokens[i + 1]?.value === ":"
          ) {
            formattedVTL += "\n" + currentIndent();
            lastTokenWasVariable = false;
          }

          // NEW: Avoid inserting a newline for inline tokens that are just a quote
          if (
            !processingSet &&
            !inJsonValueVar &&
            inlineMode &&
            token.type === "string" &&
            (token.value.startsWith('"') || token.value.startsWith("'"))
          ) {
            if (
              !(
                token.value.length === 3 &&
                ((token.value.startsWith('"') && token.value.endsWith('"')) ||
                  (token.value.startsWith("'") && token.value.endsWith("'")))
              )
            ) {
              formattedVTL += "\n" + currentIndent();
              inlineMode = false;
            }
          }

          // If in a macro header, output tokens inline.
          if (inMacroHeader) {
            formattedVTL += token.value;
            if (token.type === "punctuation") {
              if (token.value === "(") {
                macroParenCount++;
              } else if (token.value === ")") {
                macroParenCount--;
                if (macroParenCount === 0) {
                  inMacroHeader = false;
                }
              }
            }
            continue;
          }

          // Special handling: if we see a #macro directive, output its header inline.
          if (token.type === "directive" && token.value === "#macro") {
            formattedVTL += token.value;
            if (
              tokens[i + 1] &&
              tokens[i + 1]!.type === "punctuation" &&
              tokens[i + 1]!.value === "("
            ) {
              inMacroHeader = true;
              macroParenCount = 0;
            }
            continue;
          }

          const directiveValue = token.value.trim();

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
              } else if (directiveValue.startsWith("#elseif")) {
                indentStack.pop();
                const conditionResult = extractCondition(tokens, i + 1);
                let condition = conditionResult.condition;
                condition = normalizeLogicalOperators(condition);
                i = conditionResult.index;
                formattedVTL += "\n" + currentIndent() + "#elseif " + condition;
                indentStack.push(
                  indentStack[indentStack.length - 1]! + indentSize,
                );
                needsNewline = true;
              } else if (directiveValue.startsWith("#else")) {
                indentStack.pop();
                formattedVTL += "\n" + currentIndent() + "#else";
                indentStack.push(
                  indentStack[indentStack.length - 1]! + indentSize,
                );
                needsNewline = true;
              } else if (directiveValue.startsWith("#if")) {
                const conditionResult = extractCondition(tokens, i + 1);
                let condition = conditionResult.condition;
                condition = normalizeLogicalOperators(condition);
                i = conditionResult.index;
                formattedVTL += "\n" + currentIndent() + "#if " + condition;
                indentStack.push(
                  indentStack[indentStack.length - 1]! + indentSize,
                );
                needsNewline = true;
              } else if (directiveValue.startsWith("#foreach")) {
                const conditionResult = extractCondition(tokens, i + 1);
                let condition = conditionResult.condition;
                condition = adjustForEachCondition(condition);
                i = conditionResult.index;
                formattedVTL +=
                  "\n" + currentIndent() + "#foreach " + condition;
                indentStack.push(
                  indentStack[indentStack.length - 1]! + indentSize,
                );
                needsNewline = true;
              } else if (directiveValue.startsWith("#set")) {
                // Always start a new #set on its own line unless it's the very first token.
                if (formattedVTL.length > 0 && !formattedVTL.endsWith("\n")) {
                  formattedVTL += "\n" + currentIndent();
                }
                formattedVTL += token.value;
                processingSet = true;
                inlineMode = true;
                setParenCount = 0;
              } else {
                formattedVTL += "\n" + currentIndent() + token.value;
                if (directiveValue.startsWith("#foreach")) {
                  indentStack.push(
                    indentStack[indentStack.length - 1]! + indentSize,
                  );
                }
                needsNewline = true;
              }
              break;
            case "punctuation":
              if (token.value === "{" && !inJsonValueVar) {
                // Start a JSON block – force a new line and increase indent.
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
                // End of a JSON block – reduce indent.
                indentStack.pop();
                formattedVTL += "\n" + currentIndent() + token.value;
                needsNewline = true;
              } else if (token.value === "(" || token.value === ")") {
                if (processingSet) {
                  if (token.value === "(") {
                    setParenCount++;
                    formattedVTL += token.value;
                  } else if (token.value === ")") {
                    setParenCount--;
                    // Append the closing parenthesis.
                    formattedVTL += token.value;
                    if (setParenCount === 0) {
                      processingSet = false;
                      inlineMode = false;
                      // Force a newline after finishing the #set directive.
                      formattedVTL += "\n" + currentIndent();
                    }
                    continue; // Skip further processing for this token.
                  }
                } else {
                  formattedVTL += token.value;
                }
              } else if (token.value === "," && !inJsonValueVar) {
                formattedVTL += token.value;
                needsNewline = true;
              } else {
                formattedVTL += token.value;
              }
              break;
            case "comment":
              // If the previous token was a comment, force a newline before this one.
              if (lastTokenWasComment) {
                formattedVTL += "\n" + currentIndent() + token.value;
              } else {
                if (formattedVTL && !formattedVTL.endsWith("\n")) {
                  formattedVTL += " " + token.value;
                } else {
                  formattedVTL += token.value;
                }
              }
              lastTokenWasComment = true;
              break;
            case "variable":
              formattedVTL += token.value;
              lastTokenWasVariable = true;
              break;
            default:
              formattedVTL += token.value;
              lastTokenWasVariable = token.type === "variable";
          }
        }
        formattedVTL = formattedVTL.replace(/\n\s*\n/g, "\n");
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

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 font-sans text-white">
      {/* Decorative elements */}
      <div className="pointer-events-none absolute left-0 top-0 z-0 h-full w-full overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-blue-500 opacity-10 blur-3xl"></div>
        <div className="absolute -right-20 top-1/2 h-80 w-80 rounded-full bg-blue-600 opacity-10 blur-3xl"></div>
        <div className="absolute -bottom-40 left-1/3 h-80 w-80 rounded-full bg-blue-400 opacity-10 blur-3xl"></div>
      </div>

      <div className="relative z-10 flex h-full flex-col p-4 sm:p-6">
        <header className="mb-4 text-center">
          <h1 className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-4xl font-extrabold text-transparent drop-shadow-lg md:text-5xl lg:text-6xl">
            Apache Velocity Formatter
          </h1>
          <p className="mt-2 text-base text-blue-300/80 md:text-lg">
            Format your Apache Velocity Template Language (VTL) code with ease
          </p>
        </header>

        <div className="flex flex-1 flex-col">
          <main className="relative mx-auto flex w-full flex-1 flex-col gap-4 md:flex-row md:gap-6">
            {/* Input Section */}
            <section className="flex h-full flex-1 flex-col rounded-xl border border-white/5 bg-gray-900/50 p-4 shadow-xl backdrop-blur-md transition-all duration-200 md:p-6">
              <h2 className="mb-2 text-lg font-semibold text-blue-300 md:mb-3">
                Input VTL
              </h2>
              <div className="flex-1 overflow-hidden rounded-md border border-gray-800">
                <Textarea
                  className="h-full w-full border-0 bg-gray-800/50 font-mono focus-visible:ring-1 focus-visible:ring-blue-500"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Paste your unformatted VTL here..."
                />
              </div>
            </section>

            {/* Format Button - Fixed width to prevent layout shift */}
            <div className="flex items-center justify-center md:px-2">
              <Button
                onClick={formatVTL}
                className="min-w-[110px] bg-blue-600 px-3 py-2 font-medium text-white shadow-lg transition duration-300 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-700/20 disabled:pointer-events-none disabled:opacity-70 md:h-12 md:min-w-[110px]"
                disabled={!input.trim() || isFormatting}
              >
                {isFormatting ? (
                  <span className="mx-auto flex items-center whitespace-nowrap">
                    <span className="animate-pulse">Format</span>
                    <span className="ml-1 inline-flex animate-bounce">...</span>
                  </span>
                ) : (
                  <span className="mx-auto flex items-center whitespace-nowrap">
                    <span>Format</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="ml-1"
                    >
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </span>
                )}
              </Button>
            </div>

            {/* Output Section */}
            <section className="relative flex h-full flex-1 flex-col rounded-xl border border-white/5 bg-gray-900/50 p-4 shadow-xl backdrop-blur-md transition-all duration-200 md:p-6">
              <div className="mb-2 flex items-center justify-between md:mb-3">
                <h2 className="text-lg font-semibold text-blue-300">
                  Formatted VTL
                </h2>
                <Button
                  onClick={handleCopy}
                  size="sm"
                  variant="ghost"
                  className={`${
                    copied
                      ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                      : "text-gray-300 hover:bg-blue-500/20 hover:text-blue-300"
                  } border transition-all duration-200`}
                >
                  <Copy size={16} className="mr-1" />
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>

              <div className="flex-1 overflow-hidden rounded-md border border-gray-800">
                <Textarea
                  className="h-full w-full border-0 bg-gray-800/50 font-mono focus-visible:ring-1 focus-visible:ring-blue-500"
                  value={output}
                  readOnly
                  placeholder="Formatted VTL will appear here..."
                />
              </div>
            </section>
          </main>

          {/* Attribution Footer */}
          <footer className="mt-4 text-center">
            <p className="text-xs text-white/40">
              Made with Love -{" "}
              <a
                href="https://github.com/sandepten"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-white/60 hover:underline"
              >
                Sandeep Kumar
              </a>
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}

export default App;
