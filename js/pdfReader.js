// js/pdfReader.js
// iPad-friendly FileReader-based PDF loader for pdf.js

(function () {
 // find pdfjs global
  const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib || null;
if (!pdfjsLib) {
   console.error("pdfReader: pdfjsLib not found. Make sure pdf.min.js is in <head>.");
  // show status if element exists
   const st = document.getElementById("pdfStatus");
  if (st) st.textContent = "ERROR: pdf.js not loaded.";
   return;
   }

 // Shared state exported to window so analyzer can access if needed
  window._pdfReader = {
    pdfText: "",
    pdfDoc: null,
    lastError: null
  };

  function updateStatus(msg) {
    const s = document.getElementById("pdfStatus");
    if (s) s.textContent = msg;
    console.log("pdfReader status:", msg);
  }

  async function processArrayBuffer(arrayBuffer) {
    try {
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      window._pdfReader.pdfDoc = pdf;

     // Extract text page by page (robust for most Brisnet PDFs)
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
       
     // defensively map strings
       const pageText = content.items.map(it => it.str || "").join("\n");
        fullText += pageText + "\n\n";
      }
        window._pdfReader.pdfText = fullText;
        updateStatus(`PDF loaded successfully (${pdf.numPages} pages)`);
    
     // Beggining of Parser code
if (window.parsePPTable) {
  window._pdfReader.parsedPP = window.parsePPTable(fullText);
}
if (window.parseHorseBlockFull && window._pdfReader.parsedPP) {
  window._pdfReader.horses = window._pdfReader.parsedPP.map(b => {
    return { post: b.post, name: b.name, ...window.parseHorseBlockFull(b) };
  });
}

  // Detect bugs
      window._pdfReader.lastError = null;
      console.log("pdfReader: PDF text length:", fullText.length);
      return true;
    } catch (err) {
      window._pdfReader.lastError = err;
      console.error("pdfReader: Error processing PDF", err);
     
     // Provide a precise status for iPad debugging:
      updateStatus("Error loading PDF: " + (err && err.message ? err.message : String(err)));
      return false;
    }
  }

  // Handler attached to <input id="pdfFile">
  async function handleFileInputChange(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      updateStatus("No file selected.");
      return;
    }

    updateStatus(`Reading "${file.name}" ...`);

    // Use FileReader (works on iPad)
    try {
      const reader = new FileReader();
      reader.onload = async function (ev) {
        const arrayBuffer = ev.target.result;
       
       // Process with pdf.js
        await processArrayBuffer(arrayBuffer);
      };
      reader.onerror = function (ev) {
        console.error("pdfReader: FileReader error", ev);
        updateStatus("File read error: " + (ev && ev.target && ev.target.error && ev.target.error.message ? ev.target.error.message : "unknown"));
      };

      // read as arrayBuffer (safe and widely supported)
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error("pdfReader: unexpected error", err);
      updateStatus("Unexpected error reading file: " + (err && err.message ? err.message : String(err)));
    }
  }

  // Attach (or re-attach) listener safely (idempotent)
  function attachListener() {
    const input = document.getElementById("pdfFile");
    if (!input) {
      console.warn("pdfReader: #pdfFile not found in DOM");
      return;
    }
   
    // remove previous listeners to avoid duplicates
    input.removeEventListener("change", handleFileInputChange);
    input.addEventListener("change", handleFileInputChange);
    console.log("pdfReader: listener attached to #pdfFile");
  }
 
 // Attach Button Create and Funtion to Run it
 function attachRunButton() {
   const runBtn = document.getElementById("runAnalysis");
   if (!runBtn) return;
   runBtn.removeEventListener("click", runCreate);
   runBtn.addEventListener("click", runCreate);
}
 // Start of horizontal text lineup code⬇️
 function formatHorseDisplay(h) {
  let out = "";

  // POST + NAME + TAG
  out += `${h.post.toString().padEnd(3)} ${h.name} ${h.tag || ""}\n`;

  // OWNER
  out += `     Own: ${h.owner}\n`;

  // ODDS + SILKS
  out += `${(h.odds || "").padEnd(6)} ${h.silks}\n`;

  // JOCKEY
  out += `     ${h.jockey.name} (${h.jockey.record})\n\n`;

  // SIRE / DAM / BREEDER / TRAINER
  out += `Sire: ${h.sire}\n`;
  out += `Dam: ${h.dam}\n`;
  out += `Brdr: ${h.breeder}\n`;
  out += `Trnr: ${h.trainer}\n\n`;

  // LIFE & YEAR-BY-YEAR
  out += `Life: ${h.life}\n`;
  for (const y of Object.keys(h.by_year)) {
    out += `${y}: ${h.by_year[y]}\n`;
  }
  out += "\n";

  // NOTES
  if (h.notes.length > 0) {
    out += "NOTES:\n";
    for (let n of h.notes) out += `  ${n}\n`;
    out += "\n";
  }

  // PAST PERFORMANCES (raw but in order)
  if (h.pastPerformances.length > 0) {
    out += "PAST PERFORMANCES:\n";
    for (const pp of h.pastPerformances) {
      out += `  ${pp.raw}\n`;
    }
  }

  return out;
}
 // End of horizontal lineup code ⬆️
 function runCreate() {
  if (!window._pdfReader.pdfDoc) {
    alert("No PDF loaded. Please upload a Brisnet PDF first.");
    return;
  }

  // 🔹 At this point the PDF is loaded AND Parsed
  const pp = window._pdfReader.parsedPP;
  if (!pp || !pp.length) {
    alert("Parsing failed — no PP data found.");
    return;
  }
  
  // For now, just display the JSON in #output
  const out = document.getElementById("output");
  // Replacing: let text code ⬇️
  let text = "";
for (let h of window._pdfReader.horses) {
  text += formatHorseDisplay(h) + "\n\n";
}
out.textContent = text;
  // End relacement of: let text = ⬆️
 // let text = "";
   // for (let h of pp) {
   // text += "POST POSITION: " + h.post + "\n";
    // text += "------------------------------------\n";
    // text += h.raw + "\n\n";
// }
  // out.textContent = text; 
  console.log("CREATE OK — PP Parsed:", pp);
}
    
 // Attach on DOM ready (non-blocking)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      attachListener();
      attachRunButton();
    });
  } else {
    attachListener();
    attachRunButton();
  }

})(); // end module
