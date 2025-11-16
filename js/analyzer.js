console.log("PDF direct-load test running");

// FIX SAFARI WORKER ISSUE
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.10.111/pdf.worker.min.js";

const TEST_PDF_URL =
  "https://raw.githubusercontent.com/Randy2222222/Horse/main/bw_pdf_viewer.php.pdf";


// Status UI helper
function updateStatus(msg) {
  document.getElementById("pdfStatus").textContent = msg;
}

// When page loads, test loading PDF directly from GitHub
window.onload = async () => {
  updateStatus("Loading PDF from GitHub…");

  try {
    console.log("Requesting:", TEST_PDF_URL);

    const loadingTask = pdfjsLib.getDocument(TEST_PDF_URL);
    const pdf = await loadingTask.promise;

    console.log("PDF loaded!", pdf);
    updateStatus(`PDF Loaded! Pages: ${pdf.numPages}`);
    // Test reading page 1 text
const page = await pdf.getPage(1);
const content = await page.getTextContent();
const text = content.items.map(i => i.str).join(" ");

console.log("PAGE 1 TEXT:", text);
updateStatus("PDF loaded and text extracted!");

    // Try reading page 1 text
    const page = await pdf.getPage(1);
    const text = await page.getTextContent();
    const strings = text.items.map(i => i.str);
    console.log("PAGE 1 TEXT:", strings.join(" "));

  } catch (err) {
    console.error("PDF LOAD ERROR:", err);
    updateStatus("❌ ERROR: " + err.message);
  }
};
