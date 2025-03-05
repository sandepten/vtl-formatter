import type { Token } from "@/types";

export function tokenize(vtl: string): Token[] {
  const tokens: Token[] = [];
  let current = 0;
  while (current < vtl.length) {
    const char = vtl[current];

    // Handle comments that start with "##"
    if (char === "#" && vtl[current + 1] === "#") {
      let value = "##";
      current += 2;
      while (current < vtl.length && vtl[current] !== "\n") {
        value += vtl[current];
        current++;
      }
      tokens.push({ type: "comment", value });
      continue;
    }

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

    // Handle double-quoted strings
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

    // Handle single-quoted strings
    if (char === "'") {
      let value = "'";
      current++;
      while (current < vtl.length && vtl[current] !== "'") {
        value += vtl[current];
        current++;
      }
      value += "'";
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
      // Skip whitespace (newlines will be reinserted by the formatter)
      current++;
      continue;
    }

    tokens.push({ type: "unknown", value: char });
    current++;
  }
  return tokens;
}

// Helper to insert a space around && and || if missing.
export function normalizeLogicalOperators(condition: string): string {
  return condition.replace(/\s*(&&|\|\|)\s*/g, " $1 ");
}

// Updated helper for foreach conditions: also normalize "in" spacing
// and logical operators.
export function adjustForEachCondition(condition: string): string {
  if (condition.startsWith("(") && condition.endsWith(")")) {
    let inner = condition.slice(1, -1).trim();
    inner = inner.replace(
      /(\$[a-zA-Z0-9._\[\]]+)(in)(\$[a-zA-Z0-9._\[\]]+|\$\{[^}]+\})/g,
      "$1 in $3",
    );
    inner = inner.replace(/\s+in\s+/g, " in ");
    inner = normalizeLogicalOperators(inner);
    return `(${inner})`;
  }
  return condition;
}

export function extractCondition(
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
