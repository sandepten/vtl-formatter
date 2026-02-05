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
        let lastTokenWasComment = false;
        let lastTokenWasVariable = false;

        // Track when we're in a JSON key-value pair with a variable value
        let inJsonValueVar = false;
        let jsonVarBraceCount = 0;

        // For handling inline macro headers
        let inMacroHeader = false;
        let macroParenCount = 0;

        // For handling inline directive headers (parse, include, evaluate, define)
        let inDirectiveHeader = false;
        let directiveParenCount = 0;

        // Track if we need to preserve spaces between tokens
        let lastTokenNeedsSpace = false;

        const currentIndent = () =>
          " ".repeat(indentStack[indentStack.length - 1]!);

        for (let i = 0; i < tokens.length; i++) {
          const token = tokens[i];
          if (!token) continue;

          // Skip newline tokens (we handle newlines ourselves)
          if (token.type === "newline") {
            continue;
          }

          // Handle whitespace tokens - preserve spacing context
          if (token.type === "whitespace") {
            lastTokenNeedsSpace = true;
            continue;
          }

          // Reset comment flag if token is not a comment
          if (token.type !== "comment" && token.type !== "multiline_comment") {
            lastTokenWasComment = false;
          }

          // Handle unparsed content #[[...]]#
          if (token.type === "unparsed") {
            if (formattedVTL.length > 0 && !formattedVTL.endsWith("\n")) {
              formattedVTL += "\n" + currentIndent();
            }
            formattedVTL += token.value;
            needsNewline = true;
            lastTokenNeedsSpace = false;
            continue;
          }

          // Handle multi-line comments
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

          // Check if we're starting a JSON key-value pair with a variable value
          if (
            token.type === "punctuation" &&
            token.value === ":" &&
            i + 1 < tokens.length
          ) {
            // Look ahead, skipping whitespace
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

          // Handle variables in JSON values
          if (inJsonValueVar && token.type === "variable") {
            formattedVTL += token.value;
            // Check if this is a complete variable reference
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
            lastTokenNeedsSpace = false;
            continue;
          }

          // Check if we need to insert a newline after a variable when followed by a JSON key
          if (
            lastTokenWasVariable &&
            token.type === "string" &&
            token.value.startsWith('"')
          ) {
            // Look ahead to check if this is a JSON key
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

          // Handle inline tokens that are strings
          if (
            !processingSet &&
            !inJsonValueVar &&
            inlineMode &&
            token.type === "string" &&
            (token.value.startsWith('"') || token.value.startsWith("'"))
          ) {
            // Check if this is a short single-character string (used in JSON)
            const isShortString =
              token.value.length === 3 &&
              ((token.value.startsWith('"') && token.value.endsWith('"')) ||
                (token.value.startsWith("'") && token.value.endsWith("'")));

            if (!isShortString) {
              formattedVTL += "\n" + currentIndent();
              inlineMode = false;
            }
          }

          // If in a macro header, output tokens inline
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

          // If in a directive header (parse, include, evaluate), output tokens inline
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

          // Handle #macro directive
          if (token.type === "directive" && token.value === "#macro") {
            if (formattedVTL.length > 0 && !formattedVTL.endsWith("\n")) {
              formattedVTL += "\n" + currentIndent();
            } else if (formattedVTL.endsWith("\n")) {
              formattedVTL += currentIndent();
            }
            formattedVTL += token.value;
            // Look ahead for opening paren
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

          // Handle newlines for non-inline, non-JSON contexts
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
                // #define also creates a block that needs #end
                const conditionResult = extractCondition(tokens, i + 1);
                const condition = conditionResult.condition;
                i = conditionResult.index;
                formattedVTL += "\n" + currentIndent() + "#define" + condition;
                indentStack.push(
                  indentStack[indentStack.length - 1]! + indentSize,
                );
                needsNewline = true;
              } else if (directiveName === "set") {
                // Start a new #set on its own line unless it's the very first token
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
                // Handle #parse, #include, #evaluate, #stop, #break
                if (formattedVTL.length > 0 && !formattedVTL.endsWith("\n")) {
                  formattedVTL += "\n" + currentIndent();
                } else if (formattedVTL.endsWith("\n")) {
                  formattedVTL += currentIndent();
                }
                formattedVTL += token.value;

                // For directives with arguments, handle them inline
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
                // Generic directive handling
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
                // Start a JSON block – force a new line and increase indent
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
                // End of a JSON block – reduce indent
                indentStack.pop();
                formattedVTL += "\n" + currentIndent() + token.value;
                needsNewline = true;
              } else if (token.value === "[" && !inJsonValueVar && !processingSet) {
                // Array start - check if it's a simple array or needs formatting
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
                      // Force a newline after finishing the #set directive
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
              // Handle single-line comments
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
              // Add space before variable if needed
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
              // Add spaces around operators
              if (formattedVTL.length > 0 && !formattedVTL.endsWith(" ") && !formattedVTL.endsWith("\n")) {
                formattedVTL += " ";
              }
              formattedVTL += token.value;
              // Add space after operator (will be handled by next token or we add it here)
              formattedVTL += " ";
              lastTokenNeedsSpace = false;
              break;

            case "keyword":
              // Handle keywords like 'in', 'and', 'or', 'not', etc.
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
              // Preserve space before text if needed
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

        // Clean up multiple blank lines
        formattedVTL = formattedVTL.replace(/\n\s*\n/g, "\n");
        // Clean up trailing spaces on lines
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
