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

function App() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);

  const formatVTL = useCallback(() => {
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
              formattedVTL += "\n" + currentIndent() + "#foreach " + condition;
              indentStack.push(
                indentStack[indentStack.length - 1]! + indentSize,
              );
              needsNewline = true;
            } else if (directiveValue.startsWith("#set")) {
              // Always start a new #set on its own line unless it’s the very first token.
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
    <div className="min-h-screen bg-gray-900 p-8 font-sans text-white">
      <header className="mb-8 text-center">
        <h1 className="text-5xl font-extrabold text-blue-400 drop-shadow-lg md:text-6xl">
          VTL Formatter
        </h1>
      </header>
      <main className="flex h-[calc(100vh-250px)] flex-grow flex-col gap-8 md:flex-row">
        <section className="flex flex-1 flex-col rounded-xl bg-gray-800 p-6 shadow-lg">
          <h2 className="mb-4 text-2xl font-semibold text-blue-300">
            Input VTL
          </h2>
          <div className="flex-1">
            <Textarea
              className="h-full w-full resize-none bg-gray-700 font-mono"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste your unformatted VTL here..."
            />
          </div>
        </section>
        <section className="relative flex flex-1 flex-col rounded-xl bg-gray-800 p-6 shadow-lg">
          <h2 className="mb-4 text-2xl font-semibold text-blue-300">
            Formatted VTL
          </h2>
          <Button
            onClick={handleCopy}
            className={`absolute right-6 top-6 text-sm transition ${
              copied
                ? "border-blue-500 bg-blue-500"
                : "border-blue-600 bg-blue-600"
            } hover:bg-blue-700`}
          >
            {copied ? "✓ Copied!" : "Copy"}
          </Button>
          <div className="flex-1">
            <Textarea
              className="h-full w-full resize-none bg-gray-700 font-mono"
              value={output}
              readOnly
              placeholder="Formatted VTL will appear here..."
            />
          </div>
        </section>
      </main>
      <footer className="mt-8 flex justify-center">
        <Button
          onClick={formatVTL}
          className="bg-blue-600 font-bold text-white shadow-lg transition duration-200 hover:bg-blue-700"
          size="lg"
        >
          Format VTL →
        </Button>
      </footer>
    </div>
  );
}

export default App;
