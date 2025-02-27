"use client";

import { useState, useCallback } from "react";
import {
  adjustForEachCondition,
  extractCondition,
  normalizeLogicalOperators,
  tokenize,
} from "@/lib/vtl";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
            inlineMode &&
            token.type === "string" &&
            token.value.startsWith('"')
          ) {
            formattedVTL += "\n" + currentIndent();
            inlineMode = false;
          }

          if (needsNewline && !inlineMode) {
            formattedVTL += "\n" + currentIndent();
            needsNewline = false;
          }

          if (
            !processingSet &&
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
              if (token.value === "{") {
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
              } else if (token.value === "}") {
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
              } else if (token.value === ",") {
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
            default:
              formattedVTL += token.value;
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
    <div className="fixed inset-0 overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 font-sans text-white">
      {/* Decorative elements */}
      <div className="pointer-events-none absolute left-0 top-0 z-0 h-full w-full overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-blue-500 opacity-10 blur-3xl"></div>
        <div className="absolute -right-20 top-1/2 h-80 w-80 rounded-full bg-blue-600 opacity-10 blur-3xl"></div>
        <div className="absolute -bottom-40 left-1/3 h-80 w-80 rounded-full bg-blue-400 opacity-10 blur-3xl"></div>
      </div>

      <div className="relative z-10 flex h-full flex-col p-4 sm:p-6">
        <header className="mb-4 text-center">
          <h1 className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-4xl font-extrabold text-transparent drop-shadow-lg md:text-5xl lg:text-6xl">
            VTL Formatter
          </h1>
          <p className="mt-2 text-base text-blue-300/80 md:text-lg">
            Format your Velocity Template Language code with ease
          </p>
        </header>

        {/* New layout structure with centered button */}
        <div className="flex flex-1 flex-col items-center justify-center">
          <main className="mx-auto grid w-full max-w-screen-2xl flex-1 gap-4 md:grid-cols-2 md:gap-6">
            {/* Input Section */}
            <section className="flex h-full flex-col rounded-xl border border-white/5 bg-gray-900/50 p-4 shadow-xl backdrop-blur-md transition-all duration-200 md:p-6">
              <h2 className="mb-2 text-lg font-semibold text-blue-300 md:mb-3">
                Input VTL
              </h2>
              <div className="flex-1 overflow-hidden rounded-md border border-gray-800">
                <ScrollArea className="h-full w-full">
                  <Textarea
                    className="h-[72vh] w-full border-0 bg-gray-800/50 font-mono focus-visible:ring-1 focus-visible:ring-blue-500"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Paste your unformatted VTL here..."
                  />
                </ScrollArea>
              </div>
            </section>

            {/* Output Section */}
            <section className="relative flex h-full flex-col rounded-xl border border-white/5 bg-gray-900/50 p-4 shadow-xl backdrop-blur-md transition-all duration-200 md:p-6">
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
                <ScrollArea className="h-full w-full">
                  <Textarea
                    className="h-[72vh] w-full border-0 bg-gray-800/50 font-mono focus-visible:ring-1 focus-visible:ring-blue-500"
                    value={output}
                    readOnly
                    placeholder="Formatted VTL will appear here..."
                  />
                </ScrollArea>
              </div>
            </section>
          </main>

          {/* Centered Format Button */}
          <div className="mt-6 flex justify-center">
            <Button
              onClick={formatVTL}
              className="bg-blue-600 px-8 py-2 font-medium text-white shadow-lg transition duration-300 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-700/20 disabled:pointer-events-none disabled:opacity-70"
              size="lg"
              disabled={!input.trim() || isFormatting}
            >
              {isFormatting ? (
                <>
                  <span className="animate-pulse">Formatting</span>
                  <span className="ml-1 inline-flex animate-bounce">...</span>
                </>
              ) : (
                <>Format VTL</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
