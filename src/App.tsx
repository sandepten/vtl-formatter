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
      // Flags to handle multi-token #set expressions.
      let processingSet = false;
      let setParenCount = 0;

      const currentIndent = () =>
        " ".repeat(indentStack[indentStack.length - 1]);

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const directiveValue = token.value.trim();

        // When processing a #set, we do not flush inline mode on string tokens.
        if (
          !processingSet &&
          inlineMode &&
          token.type === "string" &&
          token.value.startsWith('"')
        ) {
          formattedVTL += "\n" + currentIndent();
          inlineMode = false;
        }

        // If not in inline mode and a newline is needed, insert it.
        if (needsNewline && !inlineMode) {
          formattedVTL += "\n" + currentIndent();
          needsNewline = false;
        }

        // If a new directive (other than a continued #set) starts while in inline mode,
        // flush inline mode.
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
              // Enter set processing mode.
              processingSet = true;
              inlineMode = true;
              // Reset parenthesis count.
              setParenCount = 0;
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
            // If processing a #set, update the parenthesis counter.
            if (processingSet) {
              if (token.value === "(") {
                setParenCount++;
              } else if (token.value === ")") {
                setParenCount--;
                // When we've closed all parentheses for the #set, exit processingSet.
                if (setParenCount === 0) {
                  processingSet = false;
                  // End the inline block so subsequent tokens start on a new line.
                  inlineMode = false;
                }
              }
              // Always append punctuation inline while processing a set.
              formattedVTL += token.value;
            } else {
              formattedVTL += token.value;
              if (token.value === ",") {
                needsNewline = true;
              }
            }
            break;
          default:
            // If not processing a set, add tokens normally.
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
