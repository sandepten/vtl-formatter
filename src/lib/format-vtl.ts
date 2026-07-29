import {
  adjustForEachCondition,
  extractCondition,
  isComplexVariableReference,
  normalizeLogicalOperators,
  tokenize,
} from "@/lib/vtl";

export function formatVtlTemplate(input: string): string {
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

  let inJsonValueVar = false;
  let jsonVarBraceCount = 0;

  let inMacroHeader = false;
  let macroParenCount = 0;

  let inDirectiveHeader = false;
  let directiveParenCount = 0;

  let lastTokenNeedsSpace = false;
  let pendingNewlines = 0;

  const currentIndent = () => " ".repeat(indentStack[indentStack.length - 1]!);

  /**
   * Build a line prefix without double-counting breaks.
   * pendingNewlines=2 means one intentional blank line between blocks.
   */
  const takeLinePrefix = (force = true): string => {
    if (inlineMode || inJsonValueVar) {
      if (!force) {
        return "";
      }
    }

    if (formattedVTL.length === 0) {
      pendingNewlines = 0;
      needsNewline = false;
      return "";
    }

    const wantBreak = force || needsNewline || pendingNewlines > 0;
    if (!wantBreak) {
      return "";
    }

    const totalNewlines = Math.max(
      force || needsNewline ? 1 : 0,
      pendingNewlines,
    );

    formattedVTL = formattedVTL.replace(/[ \t]+$/g, "");

    let trailing = 0;
    for (
      let j = formattedVTL.length - 1;
      j >= 0 && formattedVTL[j] === "\n";
      j--
    ) {
      trailing++;
    }

    pendingNewlines = 0;
    needsNewline = false;

    const toAdd = Math.max(0, totalNewlines - trailing);
    return "\n".repeat(toAdd) + currentIndent();
  };

  const appendOnOwnLine = (value: string) => {
    formattedVTL += takeLinePrefix(true) + value;
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;

    if (token.type === "newline") {
      const count = token.value.length;
      pendingNewlines = Math.max(pendingNewlines, count);
      needsNewline = true;
      continue;
    }

    if (token.type === "whitespace") {
      lastTokenNeedsSpace = true;
      continue;
    }

    if (token.type !== "comment" && token.type !== "multiline_comment") {
      lastTokenWasComment = false;
    }

    if (token.type === "unparsed") {
      appendOnOwnLine(token.value);
      needsNewline = true;
      lastTokenNeedsSpace = false;
      continue;
    }

    if (token.type === "multiline_comment") {
      appendOnOwnLine(token.value);
      needsNewline = true;
      lastTokenNeedsSpace = false;
      continue;
    }

    if (
      token.type === "punctuation" &&
      token.value === ":" &&
      i + 1 < tokens.length
    ) {
      let nextIdx = i + 1;
      while (
        nextIdx < tokens.length &&
        tokens[nextIdx]?.type === "whitespace"
      ) {
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

    if (inJsonValueVar && token.type === "variable") {
      formattedVTL += token.value;
      if (token.value.startsWith("${") || token.value.startsWith("$!{")) {
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

    if (
      lastTokenWasVariable &&
      token.type === "string" &&
      token.value.startsWith('"')
    ) {
      let nextIdx = i + 1;
      while (
        nextIdx < tokens.length &&
        tokens[nextIdx]?.type === "whitespace"
      ) {
        nextIdx++;
      }
      if (
        tokens[nextIdx]?.type === "punctuation" &&
        tokens[nextIdx]?.value === ":"
      ) {
        formattedVTL += takeLinePrefix(true);
        lastTokenWasVariable = false;
      }
    }

    if (
      !processingSet &&
      !inJsonValueVar &&
      inlineMode &&
      token.type === "string" &&
      (token.value.startsWith('"') || token.value.startsWith("'"))
    ) {
      const isShortString =
        token.value.length === 3 &&
        ((token.value.startsWith('"') && token.value.endsWith('"')) ||
          (token.value.startsWith("'") && token.value.endsWith("'")));

      if (!isShortString) {
        formattedVTL += takeLinePrefix(true);
        inlineMode = false;
      }
    }

    if (inMacroHeader) {
      if (
        lastTokenNeedsSpace &&
        formattedVTL.length > 0 &&
        token.value !== ")"
      ) {
        const lastChar = formattedVTL[formattedVTL.length - 1];
        if (lastChar && !/[\s(]/.test(lastChar)) {
          formattedVTL += " ";
        }
      }
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

    if (inDirectiveHeader) {
      if (
        lastTokenNeedsSpace &&
        formattedVTL.length > 0 &&
        token.value !== ")"
      ) {
        const lastChar = formattedVTL[formattedVTL.length - 1];
        if (
          lastChar &&
          lastChar !== " " &&
          lastChar !== "(" &&
          lastChar !== ","
        ) {
          formattedVTL += " ";
        }
      }
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

    if (token.type === "directive" && token.value === "#macro") {
      appendOnOwnLine(token.value);
      let nextIdx = i + 1;
      while (
        nextIdx < tokens.length &&
        tokens[nextIdx]?.type === "whitespace"
      ) {
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

    if (
      !processingSet &&
      !inJsonValueVar &&
      inlineMode &&
      token.type === "string" &&
      token.value.startsWith('"')
    ) {
      formattedVTL += takeLinePrefix(true);
      inlineMode = false;
    }

    // Self-prefixing tokens manage their own breaks via takeLinePrefix/appendOnOwnLine
    const selfPrefixes =
      token.type === "directive" ||
      (token.type === "punctuation" &&
        (token.value === "{" || token.value === "}"));

    if (
      !selfPrefixes &&
      (needsNewline || pendingNewlines > 0) &&
      !inlineMode &&
      !inJsonValueVar
    ) {
      formattedVTL += takeLinePrefix(false);
    }

    if (
      !processingSet &&
      !inJsonValueVar &&
      token.type === "directive" &&
      !directiveValue.startsWith("#set") &&
      inlineMode
    ) {
      formattedVTL += takeLinePrefix(true);
      inlineMode = false;
    }

    switch (token.type) {
      case "directive":
        if (directiveValue === "#end") {
          indentStack.pop();
          appendOnOwnLine(token.value);
          needsNewline = true;
        } else if (directiveName === "elseif") {
          indentStack.pop();
          const conditionResult = extractCondition(tokens, i + 1);
          let condition = conditionResult.condition;
          condition = normalizeLogicalOperators(condition);
          i = conditionResult.index;
          appendOnOwnLine("#elseif" + condition);
          indentStack.push(indentStack[indentStack.length - 1]! + indentSize);
          needsNewline = true;
        } else if (directiveName === "else") {
          indentStack.pop();
          appendOnOwnLine("#else");
          indentStack.push(indentStack[indentStack.length - 1]! + indentSize);
          needsNewline = true;
        } else if (directiveName === "if") {
          const conditionResult = extractCondition(tokens, i + 1);
          let condition = conditionResult.condition;
          condition = normalizeLogicalOperators(condition);
          i = conditionResult.index;
          appendOnOwnLine("#if" + condition);
          indentStack.push(indentStack[indentStack.length - 1]! + indentSize);
          needsNewline = true;
        } else if (directiveName === "foreach") {
          const conditionResult = extractCondition(tokens, i + 1);
          let condition = conditionResult.condition;
          condition = adjustForEachCondition(condition);
          i = conditionResult.index;
          appendOnOwnLine("#foreach" + condition);
          indentStack.push(indentStack[indentStack.length - 1]! + indentSize);
          needsNewline = true;
        } else if (directiveName === "define") {
          const conditionResult = extractCondition(tokens, i + 1);
          const condition = conditionResult.condition;
          i = conditionResult.index;
          appendOnOwnLine("#define" + condition);
          indentStack.push(indentStack[indentStack.length - 1]! + indentSize);
          needsNewline = true;
        } else if (directiveName === "set") {
          appendOnOwnLine(token.value);
          processingSet = true;
          inlineMode = true;
          setParenCount = 0;
        } else {
          // parse/include/evaluate/break/stop/return + custom macro calls
          appendOnOwnLine(token.value);

          let nextIdx = i + 1;
          while (
            nextIdx < tokens.length &&
            (tokens[nextIdx]?.type === "whitespace" ||
              tokens[nextIdx]?.type === "newline")
          ) {
            nextIdx++;
          }
          if (
            tokens[nextIdx]?.type === "punctuation" &&
            tokens[nextIdx]?.value === "("
          ) {
            inDirectiveHeader = true;
            directiveParenCount = 0;
            // Newlines/spaces between name and "(" are insignificant
            pendingNewlines = 0;
          } else {
            needsNewline = true;
          }
        }
        lastTokenNeedsSpace = false;
        break;

      case "punctuation":
        if (token.value === "{" && !inJsonValueVar) {
          appendOnOwnLine(token.value);
          indentStack.push(indentStack[indentStack.length - 1]! + indentSize);
          needsNewline = true;
        } else if (token.value === "}" && !inJsonValueVar) {
          indentStack.pop();
          appendOnOwnLine(token.value);
          needsNewline = true;
        } else if (token.value === "[" && !inJsonValueVar && !processingSet) {
          formattedVTL += token.value;
        } else if (
          token.value === "]" &&
          !inJsonValueVar &&
          !processingSet
        ) {
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
                needsNewline = true;
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
        if (lastTokenWasComment) {
          appendOnOwnLine(token.value);
        } else if (
          formattedVTL &&
          !formattedVTL.endsWith("\n") &&
          !formattedVTL.endsWith(" ")
        ) {
          formattedVTL += " " + token.value;
        } else if (formattedVTL.endsWith("\n")) {
          formattedVTL += currentIndent() + token.value;
        } else {
          formattedVTL += token.value;
        }
        lastTokenWasComment = true;
        needsNewline = true;
        lastTokenNeedsSpace = false;
        break;

      case "variable":
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
        if (
          formattedVTL.length > 0 &&
          !formattedVTL.endsWith(" ") &&
          !formattedVTL.endsWith("\n")
        ) {
          formattedVTL += " ";
        }
        formattedVTL += token.value;
        formattedVTL += " ";
        lastTokenNeedsSpace = false;
        break;

      case "keyword":
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
      case "number":
      case "identifier":
      case "text":
      case "raw_text":
      case "markup":
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

  formattedVTL = formattedVTL.replace(/ +$/gm, "");
  // Keep at most one blank line between blocks; never collapse all blanks away
  formattedVTL = formattedVTL.replace(/\n{3,}/g, "\n\n");
  return formattedVTL.trim();
}
