import { useState } from 'react';
import Editor from 'react-simple-code-editor';
import prettier from 'prettier/standalone';
import parserBabel from 'prettier/parser-babel';
import { highlight } from './codeHighlight';
import './App.css';

function svgToReactNative(svg) {
  if (!svg) return '';
  try {
    // Remove XML declaration if present
    svg = svg.replace(/<\?xml(.|\n)*?\?>/g, '');
    // Remove comments
    svg = svg.replace(/<!--(.|\n)*?-->/g, '');
    // Remove DOCTYPE
    svg = svg.replace(/<!DOCTYPE(.|\n)*?>/gi, '');
    // Remove xlink namespace
    svg = svg.replace(/xmlns:xlink="[^"]*"/g, '');
    // Remove width/height attributes (optional for RN)
    svg = svg.replace(/(width|height)="[^"]*"/g, '');
    // Convert hyphenated attributes to camelCase
    svg = svg.replace(/([a-zA-Z0-9]+)-([a-zA-Z0-9]+)=/g, (_, a, b) => `${a}${b.charAt(0).toUpperCase()}${b.slice(1)}=`);
    // Convert class to className
    svg = svg.replace(/class=/g, 'className=');
    // Convert SVG tags to react-native-svg equivalents
    svg = svg.replace(/<svg([^>]*)>/, '<Svg$1>');
    svg = svg.replace(/<\/svg>/, '</Svg>');
    svg = svg.replace(/<([a-z]+)/g, (m, tag) => {
      if (tag === 'svg') return '<Svg';
      return '<' + tag.charAt(0).toUpperCase() + tag.slice(1);
    });
    svg = svg.replace(/<\/([a-z]+)/g, (m, tag) => {
      if (tag === 'svg') return '</Svg';
      return '</' + tag.charAt(0).toUpperCase() + tag.slice(1);
    });
    // Self-close tags if not already closed
    svg = svg.replace(/(<[A-Za-z0-9]+[^>]*)(?<!\/)>/g, (m) => {
      // Don't self-close if it already has a closing tag
      if (m.endsWith('/>')) return m;
      return m;
    });
    // Remove any style tags (not supported in react-native-svg)
    svg = svg.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    // Remove any script tags
    svg = svg.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    // Remove empty lines
    svg = svg.replace(/^\s*\n/gm, '');
    // Indent for JSX
    svg = svg.replace(/\n/g, '\n  ');
    // Remove trailing/leading whitespace
    svg = svg.trim();
    // Wrap in exportable component
    return (
      `import * as React from 'react';\n` +
      `import { Svg, Path, Circle, Rect, Ellipse, G, Defs, LinearGradient, Stop, Polygon, Polyline, Line, Text, TSpan } from 'react-native-svg';\n\n` +
      `export default function SvgComponent(props) {\n  return (\n    ${svg}\n  );\n}`
    );
  } catch {
    return '// Error parsing SVG';
  }
}

import { useEffect } from 'react';

function App() {
  const [svgInput, setSvgInput] = useState('');
  const [debouncedInput, setDebouncedInput] = useState(svgInput);
  const [converted, setConverted] = useState('');

  // Debounce svgInput for performance
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedInput(svgInput), 250);
    return () => clearTimeout(handler);
  }, [svgInput]);

  // Prettify SVG input for display (but not for conversion)
  let prettySvgInput = svgInput;
  try {
    console.log('Attempting to format SVG input...');
    if (typeof svgInput === 'string') {
      prettySvgInput = prettier.format(svgInput, { parser: 'html', plugins: [parserBabel] });
    }
  } catch {
    // ignore formatting errors
  }

  useEffect(() => {
    if (debouncedInput) {
      try {
        console.log('SVG converted to JSX, attempting to format JSX...');
        const jsx = svgToReactNative(debouncedInput);
        // Temporarily comment out JSX formatting
        // const formattedJsx = prettier.format(jsx, {
        //   parser: 'babel',
        //   plugins: [parserBabel],
        // });
        // setConverted(formattedJsx);
        setConverted(jsx); // Use unformatted JSX for now
      } catch (error) {
        // ignore formatting errors
      }
    }
  }, [debouncedInput]);

  const handleCopy = () => {
    navigator.clipboard.writeText(converted);
  };

  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        minHeight: '100vh',
        background: 'linear-gradient(120deg, #f6f8fc 0%, #e6e9f0 100%)',
        alignItems: 'center',
        justifyContent: 'center',
        margin: 0,
        padding: 0,
      }}
    >
      <div
        style={{
          width: '50%',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '90vh',
          padding: '2rem',
          boxSizing: 'border-box',
          borderRight: '1px solid #e0e0e0',
          background: '#fff',
          borderTopLeftRadius: 18,
          borderBottomLeftRadius: 18,
          boxShadow: '0 4px 24px 0 rgba(60,60,120,0.07)',
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontWeight: 700, fontSize: 20, color: '#2d3559' }}>SVG Input</h2>
        </div>
        <div style={{ flex: 1, overflow: 'auto', borderRadius: 10, boxShadow: '0 1px 4px #0001', background: '#f9fafd' }}>
          <Editor
            value={prettySvgInput}
            onValueChange={value => {
              // Extract first <svg ...>...</svg> block
              const match = value.match(/<svg[\s\S]*?<\/svg>/i);
              setSvgInput(match ? match[0] : '');
            }}
            // highlight={code => highlight(code, 'markup')} // Temporarily disabled for debugging
            padding={16}
            style={{
              fontFamily: 'Fira Mono, monospace',
              fontSize: 15,
              minHeight: '100%',
              outline: 'none',
              border: 'none',
              background: 'transparent',
              color: '#2d3559',
              overflow: 'auto',
              height: '100%',
              resize: 'none',
            }}
            textareaId="svg-input"
            placeholder="Paste SVG XML here..."
          />
        </div>
      </div>
      <div
        style={{
          width: '50%',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '90vh',
          padding: '2rem',
          boxSizing: 'border-box',
          position: 'relative',
          background: '#fff',
          borderTopRightRadius: 18,
          borderBottomRightRadius: 18,
          boxShadow: '0 4px 24px 0 rgba(60,60,120,0.07)',
        }}
      >
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontWeight: 700, fontSize: 20, color: '#2d3559' }}>React Native SVG Component</h2>
          <button
            onClick={handleCopy}
            style={{ marginLeft: 16, padding: '6px 16px', borderRadius: 6, border: 'none', background: '#646cff', color: 'white', cursor: 'pointer', fontWeight: 500, fontSize: 14, boxShadow: '0 1px 4px #0001' }}
          >
            Copy
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', borderRadius: 10, boxShadow: '0 1px 4px #0001', background: '#f9fafd' }}>
          <Editor
            value={converted}
            onValueChange={() => {}}
            // highlight={code => highlight(code, 'jsx')} // Temporarily disabled for debugging
            padding={16}
            style={{
              fontFamily: 'Fira Mono, monospace',
              fontSize: 15,
              minHeight: '100%',
              outline: 'none',
              border: 'none',
              background: 'transparent',
              color: '#2d3559',
              overflow: 'auto',
              height: '100%',
              resize: 'none',
            }}
            textareaId="jsx-output"
            readOnly
          />
        </div>
      </div>
    </div>
  );
}

export default App;
