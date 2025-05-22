import { useState, useEffect, useCallback } from "react";
import Editor from "react-simple-code-editor";
import prettier from "prettier/standalone";
import parserBabel from "prettier/parser-babel";
import parserHtml from "prettier/parser-html";
import "./App.css";

// Simple syntax highlighting function
function highlight(code, language) {
  // For now, just return the code without highlighting to avoid errors
  // You can add proper syntax highlighting later if needed
  return code;
}

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

    // Extract width and height from original SVG before removing them
    const widthMatch = svgAttrs.match(/width\s*=\s*["']?([^"'\s>]+)/i);
    const heightMatch = svgAttrs.match(/height\s*=\s*["']?([^"'\s>]+)/i);
    const widthValue = widthMatch ? widthMatch[1] : "100";
    const heightValue = heightMatch ? heightMatch[1] : "100";

    console.log("Width/Height extraction:", {
      widthMatch,
      heightMatch,
      widthValue,
      heightValue,
    });

    // Remove xmlns attributes and width/height (we'll set dynamically)
    let attributes = svgAttrs
      .replace(/xmlns(:xlink)?="[^"]*"/g, "")
      .replace(/(width|height)="[^"]*"/g, "")
      .trim();

    // Ensure viewBox is preserved if it exists
    if (!attributes.includes("viewBox")) {
      // Try to extract viewBox from original SVG
      const viewBoxMatch = svgAttrs.match(/viewBox="([^"]*)"/i);
      if (viewBoxMatch) {
        attributes += ` viewBox="${viewBoxMatch[1]}"`;
      }
    }

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
      // Handle Path elements - only replace fill attributes if they exist
      .replace(
        /<Path([^>]*)\s+fill\s*=\s*"[^"]*"([^>]*>)/g,
        (match, before, after) => {
          // This path had a fill attribute, replace it with fill={fillColor}
          console.log("Replacing fill in path:", {
            match: match.substring(0, 100) + "...",
          });
          return `<Path${before} fill={fillColor} ${after}`;
        }
      );

    // Remove empty lines and normalize whitespace
    content = content
      .replace(/^\s*\n/gm, "")
      .replace(/\n\s*\n/g, "\n")
      .trim();

    // Indent content properly for JSX
    content = content
      .split("\n")
      .map((line) => `        ${line}`)
      .join("\n");

    // Extract viewBox from original SVG if it exists, or create one from width/height
    const viewBoxMatch = svgAttrs.match(/viewBox\s*=\s*["']([^"']+)["']/i);
    let viewBox = viewBoxMatch
      ? viewBoxMatch[1]
      : `0 0 ${widthValue} ${heightValue}`;

    console.log("Final SVG generation:", {
      widthValue,
      heightValue,
      viewBox,
      contentLength: content.length,
    });

    // Generate just the SVG JSX code (like in exampleOutput.txt)
    return `<Svg width={width} height={height} viewBox="${viewBox}" fill={fillColor}>\n${content}\n</Svg>`;
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
  const [copySuccess, setCopySuccess] = useState(""); // State for copy feedback
  const [isDragOver, setIsDragOver] = useState(false); // State for drag over feedback
  const [fileError, setFileError] = useState(null); // State for file-related errors

  // Debounce svgInput for performance, especially with large inputs
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedInput(svgInput), 750); // Increased to 750ms for large SVGs
    return () => clearTimeout(handler);
  }, [svgInput]);

  // Prevent default drag and drop behavior on the entire document
  useEffect(() => {
    const preventDefaults = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDocumentDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Only prevent if not dropping on our target area
      if (!e.target.closest('[data-drop-zone="true"]')) {
        console.log("Prevented file drop outside target area");
      }
    };

    // Add event listeners to prevent default drag/drop behavior
    document.addEventListener("dragenter", preventDefaults, false);
    document.addEventListener("dragover", preventDefaults, false);
    document.addEventListener("drop", handleDocumentDrop, false);

    return () => {
      document.removeEventListener("dragenter", preventDefaults, false);
      document.removeEventListener("dragover", preventDefaults, false);
      document.removeEventListener("drop", handleDocumentDrop, false);
    };
  }, []);

  // --- Highlight Syntax (Simplified) ---
  const highlight = (code, language) => {
    // Only apply highlighting logic for HTML/SVG input
    if (language === "html") {
      const syntaxHighlight = (text) =>
        text
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          // Very basic JSX/HTML tag highlighting
          .replace(
            /(&lt;)(\/)?([a-zA-Z0-9]+)/g,
            '$1$2<span class="token tag">$3</span>'
          )
          // Highlight attributes (simple version)
          .replace(
            /([a-zA-Z-]+)=(".*?"|'.*?'|\{.*?\})/g,
            '<span class="token attr-name">$1</span>=<span class="token attr-value">$2</span>'
          )
          // Highlight comments
          .replace(
            /(\/\/.*|\/\*[\s\S]*?\*\/)/g,
            '<span class="token comment">$1</span>'
          );
      return syntaxHighlight(code);
    }
    // Return raw code for JSX output (no highlighting)
    return code.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  };

  // --- Copy to Clipboard ---
  const handleCopy = useCallback(() => {
    if (converted && !converted.startsWith("// Error")) {
      navigator.clipboard.writeText(converted).then(
        () => {
          setCopySuccess("Copied!");
          setTimeout(() => setCopySuccess(""), 1500); // Clear message after 1.5s
        },
        (err) => {
          setCopySuccess("Failed to copy!");
          console.error("Could not copy text: ", err);
          setTimeout(() => setCopySuccess(""), 1500);
        }
      );
    } else {
      setCopySuccess("Nothing to copy");
      setTimeout(() => setCopySuccess(""), 1500);
    }
  }, [converted]);

  // --- Drag and Drop Handlers ---
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setFileError(null);

    const files = e.dataTransfer.files;
    if (files.length === 0) {
      setFileError("No files dropped");
      return;
    }

    const file = files[0];

    // Check if it's an SVG file
    if (
      !file.type.includes("svg") &&
      !file.name.toLowerCase().endsWith(".svg")
    ) {
      setFileError("Please drop an SVG file (.svg)");
      return;
    }

    // Read the file content
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target.result;
        setSvgInput(content);
        setFileError(null);
      } catch (err) {
        setFileError("Error reading file: " + err.message);
      }
    };
    reader.onerror = () => {
      setFileError("Failed to read the file");
    };
    reader.readAsText(file);
  }, []);

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
            console.warn(
              "Skipping Prettier formatting for SVG input due to large size"
            );
            if (isMounted) {
              setFormattingError(
                "SVG input too large to format, displaying raw SVG"
              );
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
    return () => {
      isMounted = false;
    }; // Cleanup function
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

          if (
            jsx.startsWith("// Error") ||
            jsx.startsWith("// No valid") ||
            jsx.startsWith("// Invalid")
          ) {
            // If svgToReactNative returned an error comment
            if (isMounted) {
              setConverted(jsx);
              setError(jsx.substring(3).trim()); // Show the error message
            }
          } else {
            // For SVG JSX output, we don't need Prettier formatting
            // Just display the raw JSX output
            if (isMounted) {
              setConverted(jsx);
              setFormattingError(null); // Clear any previous formatting error
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
    return () => {
      isMounted = false;
    }; // Cleanup function
  }, [debouncedInput]); // Rerun when debouncedInput changes

  return (
    // Outer container for title and editors
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Title Section */}
      <h1
        style={{
          textAlign: "center",
          padding: "10px 0",
          margin: 0,
          borderBottom: "1px solid #ccc",
        }}
      >
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
        <div
          style={{
            flex: 1,
            padding: "10px",
            borderRight: "1px solid #ccc",
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            backgroundColor: isDragOver ? "#f0f8ff" : "transparent",
            border: isDragOver ? "2px dashed #007acc" : "none",
            transition: "all 0.2s ease",
            position: "relative",
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          data-drop-zone="true"
        >
          <h2 style={{ marginTop: 0 }}>
            SVG Input
            <span
              style={{ fontSize: "14px", color: "#666", fontWeight: "normal" }}
            >
              (Paste SVG code or drag & drop .svg file)
            </span>
          </h2>
          {/* Display file error first if it exists */}
          {fileError && (
            <p style={{ color: "red", margin: "8px 0 0", fontSize: 14 }}>
              File Error: {fileError}
            </p>
          )}
          {/* Display general conversion error if it exists and no file error */}
          {error && !fileError && (
            <p style={{ color: "red", margin: "8px 0 0", fontSize: 14 }}>
              Error: {error}
            </p>
          )}
          {/* Display formatting error (SVG or JSX) if no other errors */}
          {formattingError && !error && !fileError && (
            <p style={{ color: "#ff9800", margin: "4px 0 0", fontSize: 13 }}>
              {formattingError}
            </p>
          )}
          {/* Drag overlay */}
          {isDragOver && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 122, 204, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                color: "#007acc",
                fontWeight: "bold",
                zIndex: 10,
                pointerEvents: "none",
              }}
            >
              Drop SVG file here
            </div>
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
        <div
          style={{
            flex: 1,
            padding: "10px",
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "5px",
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 0 }}>
              React Native SVG Output
            </h2>
            <button
              onClick={handleCopy}
              style={{ padding: "5px 10px", cursor: "pointer" }}
            >
              Copy JSX
            </button>
            {copySuccess && (
              <span
                style={{ marginLeft: "10px", color: "green", fontSize: "12px" }}
              >
                {copySuccess}
              </span>
            )}
          </div>
          {/* Display Errors/Warnings */}
          {error && (
            <div
              style={{
                color: "red",
                marginBottom: "10px",
                whiteSpace: "pre-wrap",
                flexShrink: 0,
              }}
            >
              {error}
            </div>
          )}
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
