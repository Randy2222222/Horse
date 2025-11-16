console.log("PDF.js test starting...");

// Load worker from CDN
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.10.111/pdf.worker.min.js";

// PDF on your GitHub
const TEST_PDF_URL =
  "https://raw.githubusercontent.com/Randy2222222/Horse/main/bw_pdf_viewer.php.pdf";

// Helper to update UI status
function updateStatus(msg) {
  const el = document.getElementById("pdfStatus");
  if (el) el.textContent = msg;
}

// MAIN TEST
window.onload = async () => {
  updateStatus("Loading PDF from GitHub…");
  console.log("Requesting:", TEST_PDF_URL);

  try {
    const loadingTask = pdfjsLib.getDocument({ url: TEST_PDF_URL });

    const pdf = await loadingTask.promise;

    console.log("PDF Loaded! Pages:", pdf.numPages);
    updateStatus(`PDF Loaded! Pages: ${pdf.numPages}`);

    // Read page 1 text
    const page = await pdf.getPage(1);
    const content = await page.getTextContent();
    const text = content.items.map(i => i.str).join(" ");

    console.log("PAGE 1 TEXT:", text);
    updateStatus("PDF Text Extracted Successfully!");

  } catch (err) {
    console.error("PDF LOAD ERROR:", err);
    updateStatus("❌ ERROR: " + err.message);
  }
};
