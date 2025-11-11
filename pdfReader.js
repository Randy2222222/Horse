// pdfReader.js
// Reads and extracts text from Brisnet PDF files
const pdfFileInput = document.getElementById('pdfFile');
const pdfStatus = document.getElementById('pdfStatus');

// Load the PDF.js library from a CDN
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// Listen for uploads
pdfFileInput.addEventListener('change', handlePDFUpload);

async function handlePDFUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  pdfStatus.textContent = `Reading "${file.name}" ...`;

  const fileReader = new FileReader();
  fileReader.onload = async function() {
    const typedarray = new Uint8Array(this.result);
    const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;

    let fullText = '';

    // Loop through all pages
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += '\n' + pageText;
    }

    console.log('📘 Extracted Text:\n', fullText);
    pdfStatus.textContent = `✅ Extracted text from ${file.name}. Check console for output.`;
  };

  fileReader.readAsArrayBuffer(file);
}
