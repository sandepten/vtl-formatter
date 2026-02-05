import type { Token } from "@/types";

export function tokenize(vtl: string): Token[] {
  const tokens: Token[] = [];
  let current = 0;

  while (current < vtl.length) {
    const char = vtl[current];

    // Handle unparsed content #[[...]]#
    if (
      char === "#" &&
      vtl[current + 1] === "[" &&
      vtl[current + 2] === "["
    ) {
      let value = "#[[";
      current += 3;
      while (current < vtl.length) {
        if (
          vtl[current] === "]" &&
          vtl[current + 1] === "]" &&
          vtl[current + 2] === "#"
        ) {
          value += "]]#";
          current += 3;
          break;
        }
        value += vtl[current];
        current++;
      }
      tokens.push({ type: "unparsed", value });
      continue;
    }

    // Handle multi-line comments #* ... *#
    if (char === "#" && vtl[current + 1] === "*") {
      let value = "#*";
      current += 2;
      while (current < vtl.length) {
        if (vtl[current] === "*" && vtl[current + 1] === "#") {
          value += "*#";
          current += 2;
          break;
        }
        value += vtl[current];
        current++;
      }
      tokens.push({ type: "multiline_comment", value });
      continue;
    }

    // Handle single-line comments that start with "##"
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

    // Handle formal directive syntax #{directive}
    if (char === "#" && vtl[current + 1] === "{") {
      let value = "#{";
      current += 2;
      while (current < vtl.length && vtl[current] !== "}") {
        value += vtl[current];
        current++;
      }
      if (vtl[current] === "}") {
        value += "}";
        current++;
      }
      // Convert #{directive} to #directive for easier processing
      const directiveName = value.slice(2, -1);
      tokens.push({ type: "directive", value: "#" + directiveName });
      continue;
    }

    // Handle directives starting with #
    if (char === "#") {
      let value = "#";
      current++;
      while (current < vtl.length && /[a-zA-Z]/.test(vtl[current]!)) {
        value += vtl[current];
        current++;
      }
      // Only push as directive if we captured something after #
      if (value.length > 1) {
        tokens.push({ type: "directive", value });
      } else {
        // Lone # is treated as text
        tokens.push({ type: "text", value });
      }
      continue;
    }

    // Handle silent variable references starting with $!
    if (char === "$" && vtl[current + 1] === "!") {
      let value = "$!";
      current += 2;

      // Handle $!{...} syntax for silent formal variable references
      if (current < vtl.length && vtl[current] === "{") {
        value += "{";
        current++;
        let braceCount = 1;

        while (current < vtl.length && braceCount > 0) {
          if (vtl[current] === "{") braceCount++;
          if (vtl[current] === "}") braceCount--;
          value += vtl[current];
          current++;
        }

        tokens.push({ type: "variable", value });
        continue;
      }

      // Handle simple $!variable syntax
      while (current < vtl.length) {
        const ch = vtl[current]!;
        
        // Basic identifier characters
        if (/[a-zA-Z0-9_]/.test(ch)) {
          value += ch;
          current++;
          continue;
        }
        
        // Property access with dot
        if (ch === ".") {
          value += ch;
          current++;
          continue;
        }
        
        // Array access with brackets
        if (ch === "[") {
          value += ch;
          current++;
          let bracketCount = 1;
          while (current < vtl.length && bracketCount > 0) {
            if (vtl[current] === "[") bracketCount++;
            if (vtl[current] === "]") bracketCount--;
            value += vtl[current];
            current++;
          }
          continue;
        }
        
        // Method calls with parentheses (only after identifier/property)
        if (ch === "(" && value.length > 2) {
          value += ch;
          current++;
          let parenCount = 1;
          while (current < vtl.length && parenCount > 0) {
            if (vtl[current] === "(") parenCount++;
            if (vtl[current] === ")") parenCount--;
            value += vtl[current];
            current++;
          }
          continue;
        }
        
        // Stop on any other character
        break;
      }
      tokens.push({ type: "variable", value });
      continue;
    }

    // Handle variable references starting with $
    if (char === "$") {
      let value = "$";
      current++;

      // Handle ${...} syntax for complex variable references
      if (current < vtl.length && vtl[current] === "{") {
        value += "{";
        current++;
        let braceCount = 1;

        while (current < vtl.length && braceCount > 0) {
          if (vtl[current] === "{") braceCount++;
          if (vtl[current] === "}") braceCount--;
          value += vtl[current];
          current++;
        }

        tokens.push({ type: "variable", value });
        continue;
      }

      // Handle simple $variable syntax with method calls
      while (current < vtl.length) {
        const ch = vtl[current]!;
        
        // Basic identifier characters
        if (/[a-zA-Z0-9_]/.test(ch)) {
          value += ch;
          current++;
          continue;
        }
        
        // Property access with dot
        if (ch === ".") {
          value += ch;
          current++;
          continue;
        }
        
        // Array access with brackets
        if (ch === "[") {
          value += ch;
          current++;
          let bracketCount = 1;
          while (current < vtl.length && bracketCount > 0) {
            if (vtl[current] === "[") bracketCount++;
            if (vtl[current] === "]") bracketCount--;
            value += vtl[current];
            current++;
          }
          continue;
        }
        
        // Method calls with parentheses (only after identifier/property)
        if (ch === "(" && value.length > 1) {
          value += ch;
          current++;
          let parenCount = 1;
          while (current < vtl.length && parenCount > 0) {
            if (vtl[current] === "(") parenCount++;
            if (vtl[current] === ")") parenCount--;
            value += vtl[current];
            current++;
          }
          continue;
        }
        
        // Stop on any other character
        break;
      }
      tokens.push({ type: "variable", value });
      continue;
    }

    // Handle double-quoted strings with escape sequences
    if (char === '"') {
      let value = '"';
      current++;
      while (current < vtl.length) {
        // Handle escape sequences
        if (vtl[current] === "\\" && current + 1 < vtl.length) {
          value += vtl[current];
          current++;
          value += vtl[current];
          current++;
          continue;
        }
        if (vtl[current] === '"') {
          value += '"';
          current++;
          break;
        }
        value += vtl[current];
        current++;
      }
      tokens.push({ type: "string", value });
      continue;
    }

    // Handle single-quoted strings with escape sequences
    if (char === "'") {
      let value = "'";
      current++;
      while (current < vtl.length) {
        // Handle escape sequences
        if (vtl[current] === "\\" && current + 1 < vtl.length) {
          value += vtl[current];
          current++;
          value += vtl[current];
          current++;
          continue;
        }
        if (vtl[current] === "'") {
          value += "'";
          current++;
          break;
        }
        value += vtl[current];
        current++;
      }
      tokens.push({ type: "string", value });
      continue;
    }

    // Handle range operator ..
    if (char === "." && vtl[current + 1] === ".") {
      tokens.push({ type: "operator", value: ".." });
      current += 2;
      continue;
    }

    // Handle multi-character operators (must check before single char)
    if (char === "=" && vtl[current + 1] === "=") {
      tokens.push({ type: "operator", value: "==" });
      current += 2;
      continue;
    }
    if (char === "!" && vtl[current + 1] === "=") {
      tokens.push({ type: "operator", value: "!=" });
      current += 2;
      continue;
    }
    if (char === "<" && vtl[current + 1] === "=") {
      tokens.push({ type: "operator", value: "<=" });
      current += 2;
      continue;
    }
    if (char === ">" && vtl[current + 1] === "=") {
      tokens.push({ type: "operator", value: ">=" });
      current += 2;
      continue;
    }
    if (char === "&" && vtl[current + 1] === "&") {
      tokens.push({ type: "operator", value: "&&" });
      current += 2;
      continue;
    }
    if (char === "|" && vtl[current + 1] === "|") {
      tokens.push({ type: "operator", value: "||" });
      current += 2;
      continue;
    }

    // Handle single-character operators
    if (char === "=" || char === "+" || char === "-" || char === "*" || char === "/" || char === "%" || char === "<" || char === ">" || char === "!") {
      tokens.push({ type: "operator", value: char });
      current++;
      continue;
    }

    if (!char) {
      current++;
      continue;
    }

    // Handle punctuation
    if (/[{}\[\]:,()]/.test(char)) {
      tokens.push({ type: "punctuation", value: char });
      current++;
      continue;
    }

    // Handle whitespace - PRESERVE spaces, only normalize consecutive spaces to single space
    if (/\s/.test(char)) {
      let value = "";
      const hasNewline = char === "\n";
      
      // Collect all consecutive whitespace
      while (current < vtl.length && /\s/.test(vtl[current]!)) {
        value += vtl[current];
        current++;
      }
      
      // Check if there's a newline in the whitespace
      if (hasNewline || value.includes("\n")) {
        tokens.push({ type: "newline", value: "\n" });
      } else {
        // Preserve a single space for non-newline whitespace
        tokens.push({ type: "whitespace", value: " " });
      }
      continue;
    }

    // Handle keywords (and, or, not, eq, ne, lt, gt, le, ge, in, true, false, null)
    if (/[a-zA-Z]/.test(char)) {
      let value = "";
      while (current < vtl.length && /[a-zA-Z0-9_]/.test(vtl[current]!)) {
        value += vtl[current];
        current++;
      }
      
      // Check if it's a VTL keyword/operator
      const keywords = ["and", "or", "not", "eq", "ne", "lt", "gt", "le", "ge", "in", "true", "false", "null"];
      if (keywords.includes(value.toLowerCase())) {
        tokens.push({ type: "keyword", value });
      } else {
        tokens.push({ type: "identifier", value });
      }
      continue;
    }

    // Handle numbers
    if (/[0-9]/.test(char)) {
      let value = "";
      while (current < vtl.length) {
        const ch = vtl[current]!;
        if (/[0-9]/.test(ch)) {
          value += ch;
          current++;
          continue;
        }
        // Handle decimal point, but not range operator (..)
        if (ch === "." && vtl[current + 1] !== ".") {
          value += ch;
          current++;
          continue;
        }
        break;
      }
      tokens.push({ type: "number", value });
      continue;
    }

    // Any other character is treated as text
    tokens.push({ type: "text", value: char });
    current++;
  }

  return tokens;
}

// Helper function to check if tokens represent a complex variable reference
export function isComplexVariableReference(
  tokens: Token[],
  startIndex: number,
): boolean {
  if (startIndex >= tokens.length) return false;

  const token = tokens[startIndex];
  if (!token) return false;

  // Direct ${...} or $!{...} pattern
  if (
    token.type === "variable" &&
    (token.value.startsWith("${") || token.value.startsWith("$!{"))
  ) {
    return true;
  }

  // Split $ { pattern (separated by whitespace in the original)
  if (
    token.type === "variable" &&
    (token.value === "$" || token.value === "$!") &&
    startIndex + 1 < tokens.length &&
    tokens[startIndex + 1]!.type === "punctuation" &&
    tokens[startIndex + 1]!.value === "{"
  ) {
    return true;
  }

  return false;
}

// Helper to insert a space around && and || if missing.
export function normalizeLogicalOperators(condition: string): string {
  // Normalize && and || with spaces
  let result = condition.replace(/\s*(&&|\|\|)\s*/g, " $1 ");
  // Normalize comparison operators with spaces
  result = result.replace(/\s*(==|!=|<=|>=|<|>)\s*/g, " $1 ");
  // Normalize 'and', 'or', 'not' keywords
  result = result.replace(/\s+(and|or|not|eq|ne|lt|gt|le|ge)\s+/gi, " $1 ");
  return result;
}

// Updated helper for foreach conditions: also normalize "in" spacing
// and logical operators.
export function adjustForEachCondition(condition: string): string {
  if (condition.startsWith("(") && condition.endsWith(")")) {
    let inner = condition.slice(1, -1).trim();
    // Fix spacing around 'in' keyword
    inner = inner.replace(
      /(\$[a-zA-Z0-9._\[\]()!]+|\$\{[^}]+\}|\$!\{[^}]+\})\s*in\s*(\$[a-zA-Z0-9._\[\]()!]+|\$\{[^}]+\}|\$!\{[^}]+\}|\[[^\]]+\])/gi,
      "$1 in $2",
    );
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
  
  // Skip any leading whitespace/newlines
  while (
    index < tokens.length &&
    (tokens[index]?.type === "whitespace" || tokens[index]?.type === "newline")
  ) {
    index++;
  }
  
  while (index < tokens.length) {
    const token = tokens[index];
    if (!token) break;
    
    // Skip whitespace in conditions but add single space
    if (token.type === "whitespace" || token.type === "newline") {
      // Only add space if condition doesn't already end with space
      if (condition.length > 0 && !condition.endsWith(" ")) {
        condition += " ";
      }
      index++;
      continue;
    }
    
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

// List of block-level directives that require #end
export const BLOCK_DIRECTIVES = ["if", "foreach", "macro", "define"];

// List of simple directives that don't need special handling
export const SIMPLE_DIRECTIVES = ["parse", "include", "stop", "break", "evaluate"];
