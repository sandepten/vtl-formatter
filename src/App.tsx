import { useState, useCallback } from "react";
import "./App.css";

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
      while (current < vtl.length && /[a-zA-Z]/.test(vtl[current])) {
        value += vtl[current];
        current++;
      }
      tokens.push({ type: "directive", value });
      continue;
    }

    if (char === "$") {
      let value = "$";
      current++;
      while (current < vtl.length && /[a-zA-Z0-9._\[\]]/.test(vtl[current])) {
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
      // Flag indicating that we're in an inline block (for #set)
      let inlineMode = false;

      const currentIndent = () =>
        " ".repeat(indentStack[indentStack.length - 1]);

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const directiveValue = token.value.trim();

        // If inline mode is active and we encounter a JSON key token (string starting with a quote),
        // flush inline mode: break the line and use the same indent as the current line.
        if (
          inlineMode &&
          token.type === "string" &&
          token.value.startsWith('"')
        ) {
          formattedVTL += "\n" + currentIndent();
          inlineMode = false;
        }

        // If we're not in inline mode and a newline is needed, insert it.
        if (needsNewline && !inlineMode) {
          formattedVTL += "\n" + currentIndent();
          needsNewline = false;
        }

        // If a new directive (other than a continued #set) starts while in inline mode,
        // flush inline mode.
        if (
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
                indentStack[indentStack.length - 1] + indentSize,
              );
              needsNewline = true;
            } else if (directiveValue.startsWith("#else")) {
              indentStack.pop();
              formattedVTL += "\n" + currentIndent() + "#else";
              indentStack.push(
                indentStack[indentStack.length - 1] + indentSize,
              );
              needsNewline = true;
            } else if (directiveValue.startsWith("#if")) {
              const conditionResult = extractCondition(tokens, i + 1);
              const condition = conditionResult.condition;
              i = conditionResult.index;
              formattedVTL += "\n" + currentIndent() + "#if " + condition;
              indentStack.push(
                indentStack[indentStack.length - 1] + indentSize,
              );
              needsNewline = true;
            } else if (directiveValue.startsWith("#set")) {
              // Print the #set directive inline.
              formattedVTL +=
                (needsNewline ? "\n" + currentIndent() : "") + token.value;
              // Enable inline mode so that following tokens (if any) will trigger a flush
              // and be printed on new lines with the same indent.
              inlineMode = true;
            } else {
              formattedVTL += "\n" + currentIndent() + token.value;
              if (directiveValue.startsWith("#foreach")) {
                indentStack.push(
                  indentStack[indentStack.length - 1] + indentSize,
                );
              }
              needsNewline = true;
            }
            break;
          case "punctuation":
            formattedVTL += token.value;
            if (token.value === ",") {
              needsNewline = true;
            }
            break;
          default:
            formattedVTL += token.value;
        }
      }

      // Remove unnecessary empty lines
      formattedVTL = formattedVTL.replace(/\n\s*\n/g, "\n");

      setOutput(formattedVTL.trim());
    } catch (error) {
      console.error("Error formatting VTL:", error);
      setOutput(`Error: ${error.message}`);
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
    <div className="vtl-formatter">
      <h1>VTL Formatter</h1>
      <div className="formatter-container">
        <div className="input-section">
          <h2>Input VTL</h2>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste your unformatted VTL here..."
          />
        </div>
        <div className="controls">
          <button onClick={formatVTL}>Format VTL →</button>
        </div>
        <div className="output-section">
          <h2>Formatted VTL</h2>
          <button
            className={`copy-button ${copied ? "copied" : ""}`}
            onClick={handleCopy}
          >
            {copied ? "✓ Copied!" : "Copy"}
          </button>
          <textarea
            value={output}
            readOnly
            placeholder="Formatted VTL will appear here..."
          />
        </div>
      </div>
    </div>
  );
}

export default App;
