// pdfReader1.js — SIMPLE RAW TEXT EXTRACTOR ONLY

// Load PDF → return raw text line-by-line
async function loadPDF(file) {
  const array = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: array }).promise;

  let text = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    content.items.forEach(item => {
      text += item.str + "\n";   // RAW TEXT ONLY — NO PARSING
    });
  }

  return text;
}

// Run Create button handler
document.getElementById("runAnalysis").addEventListener("click", async () => {
  const file = document.getElementById("pdfFile").files[0];
  const out = document.getElementById("output");

  if (!file) {
    out.textContent = "Please select a PDF first.";
    return;
  }

  out.textContent = "Reading PDF...";

  try {
    const rawText = await loadPDF(file);
    out.textContent = rawText;   // DISPLAY RAW TEXT ONLY
  } catch (err) {
    out.textContent = "Error reading PDF:\n" + err;
  }
});
