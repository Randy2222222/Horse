// pdfReader.js

async function loadPDF(file) {
  const array = await file.arrayBuffer();

  const pdf = await pdfjsLib.getDocument({ data: array }).promise;
  let text = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    content.items.forEach(item => {
      text += item.str + "\n";   // ← RAW TEXT, NO PARSING
    });
  }

  return text;
}

document.getElementById("pdf-upload").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const out = document.getElementById("output");

  out.textContent = "Reading PDF...";

  const text = await loadPDF(file);

  out.textContent = text;  // ← Shows the raw text
});
