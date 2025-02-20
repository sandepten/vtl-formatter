import { useState } from 'react'
import './App.css'

function App() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [copied, setCopied] = useState(false)

  const formatVTL = () => {
    const formatted = input.trim();
    const lines = formatted.split(/\n/);
    let indentLevel = 0;
    let inObject = false;

    const processComplexLine = (line: string, currentIndent: number): string => {
      // Split by JSON properties and VTL directives while preserving the delimiters
      const parts = line.split(/(?=(#(?:if|else|elseif|end|set)|"[^"]+"\s*:))/g).filter(Boolean);
      let result = '';
      let localIndent = currentIndent;

      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        // Handle VTL directives
        if (trimmed.startsWith('#')) {
          if (trimmed.startsWith('#if') || trimmed.startsWith('#foreach')) {
            result += '\n' + '  '.repeat(localIndent) + trimmed;
            localIndent++;
          } else if (trimmed.startsWith('#else') || trimmed.startsWith('#elseif')) {
            localIndent--;
            result += '\n' + '  '.repeat(localIndent) + trimmed;
            localIndent++;
          } else if (trimmed.startsWith('#end')) {
            localIndent--;
            result += '\n' + '  '.repeat(localIndent) + trimmed;
          } else if (trimmed.startsWith('#set')) {
            result += '\n' + '  '.repeat(localIndent) + trimmed;
          }
          continue;
        }

        // Handle JSON properties
        if (trimmed.match(/"[^"]+"\s*:/)) {
          result += '\n' + '  '.repeat(localIndent) + trimmed;
          // If there's content after the property, process it
          const afterColon = trimmed.split(/:\s*/)[1];
          if (afterColon) {
            result += ' ' + afterColon;
          }
        } else {
          // Handle values or other content
          result += ' ' + trimmed;
        }
      }

      return result;
    };

    const formattedLines = lines.map(line => {
      const originalLine = line.trim();
      if (!originalLine) return '';

      // Handle array start/end
      if (originalLine.startsWith('[')) {
        return '[';
      }
      if (originalLine.endsWith(']')) {
        return '  '.repeat(Math.max(0, indentLevel)) + ']';
      }

      // Handle VTL directives at the start of lines
      if (originalLine.startsWith('#')) {
        if (originalLine.startsWith('#set')) {
          return '  '.repeat(Math.max(0, indentLevel)) + originalLine;
        }

        if (originalLine.match(/^#foreach|^#if/)) {
          const indent = '  '.repeat(Math.max(0, indentLevel));
          indentLevel++;
          return indent + originalLine;
        }

        if (originalLine.match(/^#else|^#elseif/)) {
          return '  '.repeat(Math.max(0, indentLevel - 1)) + originalLine;
        }

        if (originalLine.match(/^#end/)) {
          indentLevel = Math.max(0, indentLevel - 1);
          return '  '.repeat(Math.max(0, indentLevel)) + originalLine;
        }
      }

      // Handle comma-only lines
      if (originalLine === ',') {
        return '  '.repeat(Math.max(0, indentLevel)) + ',';
      }

      // Handle object start
      if (originalLine === '{') {
        inObject = true;
        const prefix = '  '.repeat(Math.max(0, indentLevel));
        indentLevel++;
        return prefix + '{';
      }

      // Handle complex mixed content
      if (originalLine.includes('{') || (inObject && originalLine.includes(':'))) {
        if (originalLine.startsWith('{')) {
          inObject = true;
          indentLevel++;
        }

        // Process the complex line
        const processed = processComplexLine(originalLine, indentLevel);
        return processed.trim();
      }

      // Handle closing brace
      if (originalLine.endsWith('}')) {
        inObject = false;
        indentLevel = Math.max(0, indentLevel - 1);
        return '  '.repeat(Math.max(0, indentLevel)) + '}';
      }

      return '  '.repeat(Math.max(0, indentLevel)) + originalLine;
    });

    // Join lines and clean up
    const result = formattedLines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')  // Reduce multiple blank lines
      .replace(/{\s+}/g, '{}')  // Clean up empty objects
      .replace(/\s+,/g, ',')   // Clean up spaces before commas
      .replace(/,(\s*\n\s*),/g, ',') // Clean up multiple commas
      .replace(/\n\s*\n/g, '\n')  // Remove empty lines
      .split('\n')
      .filter(line => line.trim())  // Remove empty lines
      .map(line => line.trimEnd())  // Remove trailing spaces
      .join('\n');

    setOutput(result);
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

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
            className={`copy-button ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
          >
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
          <textarea
            value={output}
            readOnly
            placeholder="Formatted VTL will appear here..."
          />
        </div>
      </div>
    </div>
  )
}

export default App
