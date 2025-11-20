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
       
       // replaced next line with line afer that
        //const pageText = content.items.map(it => it.str || "").join(" ");
       const pageText = content.items.map(it => it.str || "").join("\n");
        fullText += pageText + "\n\n";
      }


     
     // --- Insert missing newlines before Post Positions (including unicode symbols) ---
    // fullText = fullText.replace(/\b([1-9]|1[0-9]|20)[^\r\nA-Za-z0-9]+([A-Za-z])/g, "\n$1 $2");
     // --- Insert newline after the Post Time block ---
    // fullText = fullText.replace(/Post Time:[^\n]+/g, m => m + "\n");
     // --- added the 2 code lines above 4 lines including his comments
      window._pdfReader.pdfText = fullText;
      updateStatus(`PDF loaded successfully (${pdf.numPages} pages)`);

     // Parse bottom section (optional for now) put this code in till line 55
if (window.parsePPTable) {
    try {
        const parsed = window.parsePPTable(fullText);
        window._pdfReader.parsedPP = parsed;
        console.log("Parsed PP:", parsed);
    } catch(err) {
        console.error("Parser error:", err);
    }
}
     // end of code added
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

  // Attach runAnalysis to check for loaded PDF (optional helper) 
 // Comment out next 2 funtions
  //function attachRunButton() {
   //const runBtn = document.getElementById("runAnalysis");
    //if (!runBtn) return;
   // runBtn.removeEventListener("click", runCheck);
   // runBtn.addEventListener("click", runCheck); 
  //}
 
  //function runCheck() {
  //if (!window._pdfReader.pdfDoc) {
  // alert("No PDF loaded. Please upload a Brisnet PDF first.");
      //return;
    //}
 // Quick confirm (you can replace this with your analyzer entrypoint)
 // alert("PDF loaded. Pages: " + window._pdfReader.pdfDoc.numPages + "\nExtracted text length: " + 
 // }
 
 // Now add new code till comment: Attach on Dom
 function attachRunButton() {
  const runBtn = document.getElementById("runAnalysis");
  if (!runBtn) return;
  runBtn.removeEventListener("click", runCreate);
  runBtn.addEventListener("click", runCreate);
}
 
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
  
  // commenting out one line then adding code till console.log(
 // out.textContent = JSON.stringify(pp, null, 2);
  let text = "";

for (let h of pp) {
  text += "POST POSITION: " + h.post + "\n";
  text += "------------------------------------\n";
  text += h.raw + "\n\n";
}

out.textContent = text;
  // end of added code before console.log(

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
