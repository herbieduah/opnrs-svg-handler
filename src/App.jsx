import { useState, useEffect, useCallback } from "react";
import Editor from "react-simple-code-editor";
import prettier from "prettier/standalone";
import parserBabel from "prettier/parser-babel";
import parserHtml from "prettier/parser-html";
import "./App.css";

function svgToReactNative(svg) {
  if (!svg || typeof svg !== "string") return "// Invalid SVG input";

  try {
    // Remove XML declaration, DOCTYPE, and comments
    svg = svg
      .replace(/<\?xml[^>]*\?>/gi, "")
      .replace(/<!DOCTYPE[^>]*>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "");

    // Extract the content between <svg> and </svg>, preserving attributes
    const svgMatch = svg.match(/<svg([^>]*)>([\s\S]*?)<\/svg>/i);
    if (!svgMatch) return "// No valid SVG content found";

    const [, svgAttrs, svgContent] = svgMatch;

    // Remove xmlns attributes and width/height (we'll set dynamically)
    let attributes = svgAttrs
      .replace(/xmlns(:xlink)?="[^"]*"/g, "")
      .replace(/(width|height)="[^"]*"/g, "")
      .trim();

    // Convert hyphenated attributes to camelCase
    attributes = attributes.replace(
      /([a-zA-Z0-9]+)-([a-zA-Z0-9]+)=/g,
      (_, a, b) => {
        return `${a}${b.charAt(0).toUpperCase()}${b.slice(1)}=`;
      }
    );

    // Convert SVG tags to react-native-svg equivalents
    let content = svgContent
      // Capitalize tags (e.g., path -> Path)
      .replace(/<([a-z]+)/gi, (m, tag) => {
        if (tag === "svg") return "<Svg";
        return `<${tag.charAt(0).toUpperCase()}${tag.slice(1)}`;
      })
      .replace(/<\/([a-z]+)/gi, (m, tag) => {
        if (tag === "svg") return "</Svg";
        return `</${tag.charAt(0).toUpperCase()}${tag.slice(1)}`;
      })
      // Convert class to className
      .replace(/class=/g, "className=")
      // Convert hyphenated attributes to camelCase in content
      .replace(/([a-zA-Z0-9]+)-([a-zA-Z0-9]+)=/g, (_, a, b) => {
        return `${a}${b.charAt(0).toUpperCase()}${b.slice(1)}=`;
      })
      // Remove style and script tags
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      // Ensure self-closing tags are properly formatted
      .replace(/<([A-Za-z0-9]+)([^>]*)\/>/g, "<$1$2 />")
      .replace(
        /<([A-Za-z0-9]+)([^>]*)>([\s\S]*?)<\/\1>/g,
        (m, tag, attrs, inner) => {
          if (inner.trim() === "") return `<${tag}${attrs} />`;
          return m;
        }
      )
      // Apply fillColor to Path elements
      .replace(
        /<Path([^>]*?)fill="[^"]*"([^>]*?)\/>/g,
        "<Path$1fill={fillColor}$2 />"
      )
      .replace(
        /<Path([^>]*?)fill="[^"]*"([^>]*?)>([\s\S]*?)<\/Path>/g,
        "<Path$1fill={fillColor}$2>$3</Path>"
      );

    // Remove empty lines and normalize whitespace
    content = content
      .replace(/^\s*\n/gm, "")
      .replace(/\n\s*\n/g, "\n")
      .trim();

    // Indent content
    content = content
      .split("\n")
      .map((line) => `      ${line}`)
      .join("\n");

    // Generate the final component
    return (
      `import React from "react"\n` +
      `import Svg, { Path } from "react-native-svg"\n\n` +
      `interface ThemeSVGProps {\n` +
      `  width: number // Accepts width as a prop\n` +
      `  fillColor: string\n` +
      `}\n\n` +
      `const FinalVersion: React.FC<ThemeSVGProps> = ({ width, fillColor }) => {\n` +
      `  const height = (width * 1024) / 1024 // Maintain the aspect ratio based on the original SVG size\n\n` +
      `  return (\n` +
      `    <Svg width={width} height={height} ${attributes} fill={fillColor}>\n` +
      `${content}\n` +
      `    </Svg>\n` +
      `  )\n` +
      `}\n\n` +
      `export default FinalVersion`
    );
  } catch (error) {
    console.error("SVG parsing error:", error);
    return "// Error parsing SVG: " + error.message;
  }
}

function App() {
  const [svgInput, setSvgInput] = useState("");
  const [debouncedInput, setDebouncedInput] = useState(svgInput);
  const [converted, setConverted] = useState("// JSX output will appear here");
  const [error, setError] = useState(null); // For general conversion errors
  const [formattingError, setFormattingError] = useState(null); // For Prettier errors
  const [copySuccess, setCopySuccess] = useState(''); // State for copy feedback

  // Debounce svgInput for performance, especially with large inputs
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedInput(svgInput), 750); // Increased to 750ms for large SVGs
    return () => clearTimeout(handler);
  }, [svgInput]);

  // --- Highlight Syntax (Simplified) ---
  const highlight = (code, language) => {
    // Only apply highlighting logic for HTML/SVG input
    if (language === 'html') {
      const syntaxHighlight = (text) =>
       text
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         // Very basic JSX/HTML tag highlighting
         .replace(/(&lt;)(\/)?([a-zA-Z0-9]+)/g, '$1$2<span class="token tag">$3</span>')
         // Highlight attributes (simple version)
         .replace(/([a-zA-Z-]+)=(".*?"|'.*?'|\{.*?\})/g, '<span class="token attr-name">$1</span>=<span class="token attr-value">$2</span>')
         // Highlight comments
         .replace(/(\/\/.*|\/\*[\s\S]*?\*\/)/g, '<span class="token comment">$1</span>');
      return syntaxHighlight(code);
    }
    // Return raw code for JSX output (no highlighting)
    return code
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  };

  // --- Copy to Clipboard --- 
  const handleCopy = useCallback(() => {
    if (converted && !converted.startsWith("// Error")) {
      navigator.clipboard.writeText(converted).then(() => {
        setCopySuccess('Copied!');
        setTimeout(() => setCopySuccess(''), 1500); // Clear message after 1.5s
      }, (err) => {
        setCopySuccess('Failed to copy!');
        console.error('Could not copy text: ', err);
        setTimeout(() => setCopySuccess(''), 1500);
      });
    } else {
      setCopySuccess('Nothing to copy');
      setTimeout(() => setCopySuccess(''), 1500);
    }
  }, [converted]);

  // Prettify SVG input for display (but not for conversion)
  // Use a separate useEffect for SVG input formatting logic
  useEffect(() => {
    let isMounted = true; // Flag to prevent state update on unmounted component
    async function formatSvgInput() {
      if (typeof svgInput === "string" && svgInput.trim()) {
        setFormattingError(null); // Clear previous formatting errors related to SVG input
        try {
          if (svgInput.length < 100000) {
            await prettier.format(svgInput, {
              parser: "html",
              plugins: [parserHtml],
            });
          } else {
            console.warn("Skipping Prettier formatting for SVG input due to large size");
            if (isMounted) {
              setFormattingError("SVG input too large to format, displaying raw SVG");
            }
          }
        } catch (err) {
          console.warn("SVG formatting error:", err);
          if (isMounted) {
            setFormattingError("SVG formatting failed: " + err.message);
          }
        }
      } else {
        // Clear formatting error if input is empty
        if (isMounted) {
           setFormattingError(null);
        }
      }
    }
    formatSvgInput();
    return () => { isMounted = false; }; // Cleanup function
  }, [svgInput]);

  // Convert SVG to React Native component
  useEffect(() => {
      let isMounted = true; // Flag to prevent state update on unmounted component
      async function convertAndFormat() {
          if (debouncedInput) {
              setError(null); // Clear previous conversion errors
              setFormattingError(null); // Clear previous formatting errors

              try {
                  const jsx = svgToReactNative(debouncedInput);
                  console.log("Raw JSX length:", jsx.length); // Log raw JSX size

                  if (jsx.startsWith("// Error") || jsx.startsWith("// No valid") || jsx.startsWith("// Invalid")) {
                      // If svgToReactNative returned an error comment
                      if (isMounted) {
                          setConverted(jsx);
                          setError(jsx.substring(3).trim()); // Show the error message
                      }
                  } else {
                      // Conversion seemed successful, now attempt formatting
                      let formattedJsx = jsx;
                      if (jsx.length < 100000) {
                          try {
                              formattedJsx = await prettier.format(jsx, {
                                  parser: "babel",
                                  plugins: [parserBabel],
                              });
                              if (isMounted) {
                                  setConverted(formattedJsx);
                              }
                          } catch (formatErr) {
                              console.error("JSX Formatting Error:", formatErr);
                              if (isMounted) {
                                  setConverted(jsx); // Fallback to unformatted JSX
                                  setFormattingError(
                                      formatErr.message.includes("languages") ? 
                                      "JSX formatting failed (plugin issue). Displaying raw output." : 
                                      "JSX formatting failed: " + formatErr.message
                                  );
                              }
                          }
                      } else {
                          console.warn("Skipping Prettier formatting due to large JSX size");
                          if (isMounted) {
                              setConverted(jsx); // Display raw JSX
                              setFormattingError("Output too large to format, displaying raw JSX");
                          }
                      }
                  }
              } catch (conversionError) {
                  // Catch errors from svgToReactNative itself (rare due to internal try-catch)
                  console.error("Conversion Error:", conversionError);
                  const errorMsg = "Conversion failed: " + conversionError.message;
                  if (isMounted) {
                      setConverted(`// ${errorMsg}`);
                      setError(errorMsg);
                      setFormattingError(null); // Clear any previous formatting error
                  }
              }
          } else {
              // Clear output and errors if input is empty
              if (isMounted) {
                  setConverted("");
                  setError(null);
                  setFormattingError(null);
              }
          }
      }
      convertAndFormat();
      return () => { isMounted = false; }; // Cleanup function
  }, [debouncedInput]); // Rerun when debouncedInput changes

  return (
    // Outer container for title and editors
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Title Section */}
      <h1 style={{ textAlign: "center", padding: "10px 0", margin: 0, borderBottom: "1px solid #ccc" }}>
        SVG to React Native SVG Converter
      </h1>

      {/* Editors Container */}
      <div
        style={{
          display: "flex",
          flex: 1, // Take remaining vertical space
          width: "100vw", // Keep full width
          // Removed height: "100vh" as flex: 1 handles height
          fontFamily: "sans-serif",
          overflow: "hidden", // Prevent content escaping
        }}
      >
        {/* Left Panel: SVG Input */}
        <div style={{ flex: 1, padding: "10px", borderRight: "1px solid #ccc", overflow: "auto", display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ marginTop: 0 }}>SVG Input</h2>
          {/* Display general conversion error first if it exists */}
          {error && (
            <p style={{ color: "red", margin: "8px 0 0", fontSize: 14 }}>
              Error: {error}
            </p>
          )}
          {/* Display formatting error (SVG or JSX) if no conversion error */}
          {formattingError && !error && (
            <p style={{ color: "#ff9800", margin: "4px 0 0", fontSize: 13 }}>
              {formattingError} 
            </p>
          )}
          {/* SVG Input Editor */}
          <Editor
            value={svgInput} // Always show raw input for editing
            onValueChange={(code) => setSvgInput(code)}
            highlight={(code) => highlight(code, "html")} // Syntax highlighting for HTML/SVG
            padding={16}
            style={{
              flex: 1, // Allow editor to grow
              fontSize: 14,
              outline: "none",
              lineHeight: 1.5, // Improved readability
            }}
            textareaClassName="editor-textarea"
          />
        </div>
        {/* Right Panel: React Native SVG Output */}
        <div style={{ flex: 1, padding: "10px", overflow: "auto", display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <h2 style={{ marginTop: 0, marginBottom: 0 }}>React Native SVG Output</h2>
            <button onClick={handleCopy} style={{ padding: '5px 10px', cursor: 'pointer' }}>
              Copy JSX
            </button>
            {copySuccess && <span style={{ marginLeft: '10px', color: 'green', fontSize: '12px' }}>{copySuccess}</span>}
          </div>
          {/* Display Errors/Warnings */}
          {error && <div style={{ color: 'red', marginBottom: '10px', whiteSpace: 'pre-wrap', flexShrink: 0 }}>{error}</div>}
          {formattingError && !error && (
            <p style={{ color: "#ff9800", margin: "4px 0 0", fontSize: 13 }}>
              {formattingError}
            </p>
          )}
          {/* JSX Output Editor */}
          <Editor
            value={converted}
            onValueChange={() => {}} // Output is read-only
            highlight={(code) => highlight(code, "jsx")} // No syntax highlighting for JSX
            padding={10}
            readOnly
            style={{
              flex: 1, // Allow editor to grow
              fontSize: 14,
              backgroundColor: "#eef2f7", // Indicate read-only
              outline: "none",
              lineHeight: 1.5, // Improved readability
              color: "black", // Ensure text is black
            }}
            textareaClassName="editor-textarea"
          />
        </div>
      </div>
    </div>
  );
}

export default App;
