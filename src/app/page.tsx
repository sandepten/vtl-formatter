"use client";

import { useState, useCallback } from "react";

interface Token {
  type: string;
  value: string;
}

function tokenize(vtl: string): Token[] {
  const tokens: Token[] = [];
  let current = 0;

  while (current < vtl.length) {
    const char = vtl[current];

    if (char === "#") {
      let value = "#";
      current++;
      while (current < vtl.length && /[a-zA-Z]/.test(vtl[current]!)) {
        value += vtl[current];
        current++;
      }
      tokens.push({ type: "directive", value });
      continue;
    }

    if (char === "$") {
      let value = "$";
      current++;
      while (current < vtl.length && /[a-zA-Z0-9._\[\]]/.test(vtl[current]!)) {
        value += vtl[current];
        current++;
      }
      tokens.push({ type: "variable", value });
      continue;
    }

    if (char === '"') {
      let value = '"';
      current++;
      while (current < vtl.length && vtl[current] !== '"') {
        value += vtl[current];
        current++;
      }
      value += '"';
      current++;
      tokens.push({ type: "string", value });
      continue;
    }
    if (!char) {
      continue;
    }
    if (/[{}\[\]:,()]/.test(char)) {
      tokens.push({ type: "punctuation", value: char });
      current++;
      continue;
    }

    if (/\s/.test(char)) {
      current++;
      continue; // Skip whitespace
    }

    tokens.push({ type: "unknown", value: char });
    current++;
  }

  return tokens;
}

// Helper function to adjust spacing around "in" only if it already has whitespace.
function adjustForEachCondition(condition: string): string {
  if (condition.startsWith("(") && condition.endsWith(")")) {
    let inner = condition.slice(1, -1).trim();
    // Insert a space before and after "in" if it’s immediately adjacent to a variable name.
    // This regex looks for a pattern like "$variablein$other" and replaces it with "$variable in $other"
    inner = inner.replace(/(\$\w+)(in)(\$\w+)/g, "$1 in $3");
    // Normalize spacing in case there are extra spaces
    inner = inner.replace(/\s+in\s+/g, " in ");
    return `(${inner})`;
  }
  return condition;
}

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

      const currentIndent = () =>
        " ".repeat(indentStack[indentStack.length - 1]!);

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (!token) continue;
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
              const condition = conditionResult.condition;
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
              const condition = conditionResult.condition;
              i = conditionResult.index;
              formattedVTL += "\n" + currentIndent() + "#if " + condition;
              indentStack.push(
                indentStack[indentStack.length - 1]! + indentSize,
              );
              needsNewline = true;
            } else if (directiveValue.startsWith("#foreach")) {
              // Extract the condition for #foreach.
              const conditionResult = extractCondition(tokens, i + 1);
              let condition = conditionResult.condition;
              i = conditionResult.index;
              // Adjust spacing around "in" only if already present.
              condition = adjustForEachCondition(condition);
              formattedVTL += "\n" + currentIndent() + "#foreach " + condition;
              indentStack.push(
                indentStack[indentStack.length - 1]! + indentSize,
              );
              needsNewline = true;
            } else if (directiveValue.startsWith("#set")) {
              formattedVTL +=
                (needsNewline ? "\n" + currentIndent() : "") + token.value;
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
            if (processingSet) {
              if (token.value === "(") {
                setParenCount++;
              } else if (token.value === ")") {
                setParenCount--;
                if (setParenCount === 0) {
                  processingSet = false;
                  inlineMode = false;
                }
              }
              formattedVTL += token.value;
            } else {
              formattedVTL += token.value;
              if (token.value === ",") {
                needsNewline = true;
              }
            }
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

  function extractCondition(
    tokens: Token[],
    startIndex: number,
  ): { condition: string; index: number } {
    let condition = "";
    let index = startIndex;
    let openParens = 0;

    while (index < tokens.length) {
      const token = tokens[index];
      if (!token) break;

      if (token.type === "punctuation" && token.value === "(") {
        openParens++;
      } else if (token.type === "punctuation" && token.value === ")") {
        openParens--;
      }

      condition += token.value;
      index++;

      if (openParens === 0) break;
    }

    return { condition: condition.trim(), index: index - 1 };
  }

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
            <textarea
              className="h-full w-full resize-none rounded-md bg-gray-700 p-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <button
            onClick={handleCopy}
            className={`absolute right-6 top-6 rounded-md border px-4 py-2 text-sm transition ${
              copied
                ? "border-blue-500 bg-blue-500"
                : "border-blue-600 bg-blue-600"
            } hover:bg-blue-700`}
          >
            {copied ? "✓ Copied!" : "Copy"}
          </button>
          <div className="flex-1">
            <textarea
              className="h-full w-full resize-none rounded-md bg-gray-700 p-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={output}
              readOnly
              placeholder="Formatted VTL will appear here..."
            />
          </div>
        </section>
      </main>
      <footer className="mt-8 flex justify-center">
        <button
          onClick={formatVTL}
          className="rounded-lg bg-blue-600 px-8 py-4 font-bold text-white shadow-lg transition duration-200 hover:bg-blue-700"
        >
          Format VTL →
        </button>
      </footer>
    </div>
  );
}

export default App;
