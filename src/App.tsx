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
      continue; // Skip whitespace for now
    }

    // Handle other characters or throw an error
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
      let inJsonObject = false;
      const indentStack: number[] = [0]; // Stack to track indentation levels

      const currentIndent = () =>
        " ".repeat(indentStack[indentStack.length - 1]);
      const nextIndent = () =>
        " ".repeat(indentStack[indentStack.length - 1] + indentSize);

      let needsNewline = false; // Flag to track if a newline is needed

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const directiveValue = token.value.trim();

        if (needsNewline) {
          formattedVTL += "\n" + currentIndent();
          needsNewline = false;
        }

        switch (token.type) {
          case "directive":
            if (directiveValue === "#end") {
              indentStack.pop();
              formattedVTL += "\n" + currentIndent() + token.value;
              needsNewline = false;
            } else if (
              directiveValue.startsWith("#elseif") ||
              directiveValue.startsWith("#else")
            ) {
              formattedVTL += "\n" + currentIndent() + token.value;
              needsNewline = false;
            } else if (directiveValue.startsWith("#if")) {
              // Format #if condition on a single line
              const conditionResult = extractCondition(tokens, i + 1);
              const condition = conditionResult.condition;
              i = conditionResult.index;

              formattedVTL +=
                "\n" + currentIndent() + "#if (" + condition + ")";
              indentStack.push(
                indentStack[indentStack.length - 1] + indentSize,
              );
              needsNewline = true;
            } else {
              formattedVTL += "\n" + currentIndent() + token.value;
              if (directiveValue.startsWith("#foreach")) {
                indentStack.push(
                  indentStack[indentStack.length - 1] + indentSize,
                );
              }
              needsNewline = false;
            }
            break;
          case "punctuation":
            if (token.value === "{") {
              inJsonObject = true;
              indentStack.push(
                indentStack[indentStack.length - 1] + indentSize,
              );
              formattedVTL += token.value;
              needsNewline = true;
            } else if (token.value === "}") {
              indentStack.pop();
              formattedVTL += token.value;
              needsNewline = true;
            } else if (token.value === ",") {
              formattedVTL += token.value;
              needsNewline = true;
            } else {
              formattedVTL += token.value;
            }
            break;
          case "string":
            formattedVTL += token.value;
            break;
          case "variable":
            formattedVTL += token.value;
            break;
          default:
            formattedVTL += token.value;
        }
      }

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

  // Helper function to extract the condition from an #if block
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
        if (openParens < 0) {
          break; // Condition ends when closing parenthesis is found
        }
      } else if (token.type === "directive") {
        break; // Condition ends when another directive is found
      }

      condition += token.value;
      index++;
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
