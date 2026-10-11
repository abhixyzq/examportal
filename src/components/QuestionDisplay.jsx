import { useState } from 'react';
import { CopyIcon, CheckIcon } from './Icons';

// Check if a line appears to be C/C++ or programming code
function isCodeLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^#(include|define)\b/.test(trimmed)) return true;
  if (/^(int|float|double|char|void|long|short|bool)\s+[a-zA-Z0-9_*&]+/.test(trimmed)) return true;
  if (/^(printf|scanf|puts|gets|malloc|free)\s*\(/.test(trimmed)) return true;
  if (/^(for|while|if|switch)\s*\(/.test(trimmed)) return true;
  if (/^(else|else\s+if)\b/.test(trimmed)) return true;
  if (/^(case\s+[^:]+:|default:)/.test(trimmed)) return true;
  if (/^(do\s*\{|return\b|break;|continue;)/.test(trimmed)) return true;
  if (/^(\{|\}|__+|[a-zA-Z0-9_]+\s*=\s*[^;]+;)/.test(trimmed)) return true;
  if (/;\s*$/.test(trimmed) && /[=+\-*/%<>&|]/.test(trimmed)) return true;
  return false;
}

// Tokenize a code line into highlighted spans
function highlightTokens(line) {
  if (!line) return [' '];

  // Regex for C language syntax tokens
  const tokenRegex = /(\/\/.*$|\"(?:\\.|[^"\\])*\"|^\s*#[a-zA-Z]+(?:\s*<[^>]+>|\s*"[^"]+")?|\b(?:int|float|double|char|void|long|short|bool|return|if|else|for|while|do|switch|case|break|continue|default|sizeof|struct)\b|\b(?:printf|scanf|main|puts|gets)\b|\b\d+(?:\.\d+)?\b|[a-zA-Z_][a-zA-Z0-9_]*|[^\s\w]+|\s+)/g;
  
  const tokens = [];
  let match;
  let lastIndex = 0;

  while ((match = tokenRegex.exec(line)) !== null) {
    const text = match[0];
    let type = 'plain';

    if (text.startsWith('//')) {
      type = 'comment';
    } else if (text.startsWith('"') && text.endsWith('"') && text.length >= 2) {
      type = 'string';
    } else if (/^\s*#[a-zA-Z]+/.test(text)) {
      type = 'preprocessor';
    } else if (/^(int|float|double|char|void|long|short|bool|return|if|else|for|while|do|switch|case|break|continue|default|sizeof|struct)$/.test(text)) {
      type = 'keyword';
    } else if (/^(printf|scanf|main|puts|gets)$/.test(text)) {
      type = 'function';
    } else if (/^\d+(\.\d+)?$/.test(text)) {
      type = 'number';
    } else if (/^[=+\-*/%&|!<>?:;{}()[\],.]+$/.test(text)) {
      type = 'operator';
    }

    tokens.push({ text, type, key: `${lastIndex}-${text}` });
    lastIndex = tokenRegex.lastIndex;
  }

  if (tokens.length === 0) return [line];

  return tokens.map((tok, i) => {
    switch (tok.type) {
      case 'comment':
        return <span key={i} style={{ color: '#94a3b8', fontStyle: 'italic' }}>{tok.text}</span>;
      case 'string':
        return <span key={i} style={{ color: '#4ade80' }}>{tok.text}</span>;
      case 'preprocessor':
        return <span key={i} style={{ color: '#38bdf8', fontWeight: 600 }}>{tok.text}</span>;
      case 'keyword':
        return <span key={i} style={{ color: '#c084fc', fontWeight: 600 }}>{tok.text}</span>;
      case 'function':
        return <span key={i} style={{ color: '#60a5fa', fontWeight: 600 }}>{tok.text}</span>;
      case 'number':
        return <span key={i} style={{ color: '#fb923c' }}>{tok.text}</span>;
      case 'operator':
        return <span key={i} style={{ color: '#e2e8f0' }}>{tok.text}</span>;
      default:
        return <span key={i}>{tok.text}</span>;
    }
  });
}

export function CodeBlock({ code, language = 'C' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const lines = (code || '').split('\n');

  return (
    <div className="code-snippet-box">
      <div className="code-snippet-header">
        <div className="code-dots">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
          <span className="lang-tag">{language}</span>
        </div>
        <button
          type="button"
          className="code-copy-btn"
          onClick={handleCopy}
          title="Copy code"
        >
          {copied ? (
            <>
              <CheckIcon size={12} />
              <span>Copied</span>
            </>
          ) : (
            <>
              <CopyIcon size={12} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <div className="code-snippet-body">
        <pre className="code-pre">
          {lines.map((line, idx) => (
            <div key={idx} className="code-line-row">
              <span className="line-num">{idx + 1}</span>
              <span className="line-content">{highlightTokens(line)}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

// Render inline text with `code` backtick tags
function renderInlineSegments(text) {
  if (!text) return null;
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code key={index} className="inline-code-badge">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

// Split full question text into paragraphs and code blocks
export function parseQuestionContent(rawText) {
  if (!rawText) return [];

  // Normalize literal "\n" into real newlines if user imported CSV with escaped \n
  let normalized = rawText;
  if (!normalized.includes('\n') && normalized.includes('\\n')) {
    normalized = normalized.replace(/\\n/g, '\n');
  }

  // 1. If explicit markdown code block is used
  if (normalized.includes('```')) {
    const segments = normalized.split(/(```[\s\S]*?```)/g);
    return segments.map(seg => {
      if (seg.startsWith('```') && seg.endsWith('```')) {
        const lines = seg.slice(3, -3).trim().split('\n');
        let lang = 'C';
        if (lines[0] && /^[a-zA-Z0-9+#]+$/.test(lines[0].trim())) {
          lang = lines.shift().trim().toUpperCase();
        }
        return { type: 'code', content: lines.join('\n'), language: lang };
      }
      return { type: 'text', content: seg.trim() };
    }).filter(s => Boolean(s.content));
  }

  // 2. Intelligent line-by-line code detector
  const lines = normalized.split('\n');
  const blocks = [];
  let currentBlock = { type: null, lines: [] };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isCode = isCodeLine(line);
    const lineType = isCode ? 'code' : 'text';

    if (currentBlock.type === null) {
      currentBlock.type = lineType;
      currentBlock.lines.push(line);
    } else if (currentBlock.type === lineType) {
      currentBlock.lines.push(line);
    } else {
      // Empty line continuation in code
      if (!line.trim() && currentBlock.type === 'code' && i + 1 < lines.length && isCodeLine(lines[i + 1])) {
        currentBlock.lines.push(line);
        continue;
      }
      blocks.push({
        type: currentBlock.type,
        content: currentBlock.lines.join('\n').trim(),
        language: 'C'
      });
      currentBlock = { type: lineType, lines: [line] };
    }
  }

  if (currentBlock.lines.length > 0) {
    blocks.push({
      type: currentBlock.type,
      content: currentBlock.lines.join('\n').trim(),
      language: 'C'
    });
  }

  return blocks.filter(b => Boolean(b.content));
}

export default function QuestionDisplay({ text, className = '' }) {
  if (!text) return null;

  const blocks = parseQuestionContent(text);

  return (
    <div className={`question-formatted-container ${className}`}>
      {blocks.map((block, idx) => {
        if (block.type === 'code') {
          return (
            <CodeBlock
              key={idx}
              code={block.content}
              language={block.language || 'C'}
            />
          );
        }
        return (
          <div key={idx} className="question-desc-text">
            {renderInlineSegments(block.content)}
          </div>
        );
      })}
    </div>
  );
}
