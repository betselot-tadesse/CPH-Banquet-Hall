// PDF Downloader Utility using html2pdf.js
// Exports DOM elements directly to clean downloadable .pdf files with window.print() fallback

export interface PdfExportOptions {
  filename?: string;
  orientation?: 'portrait' | 'landscape';
  margin?: number | [number, number, number, number];
  unit?: 'mm' | 'pt' | 'in';
  format?: 'a4' | 'letter';
}

export async function downloadElementAsPdf(
  element: HTMLElement | null,
  filename = 'banquet-document.pdf',
  options: PdfExportOptions = {}
): Promise<boolean> {
  if (!element) {
    window.print();
    return false;
  }

  const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

  try {
    // Dynamic import to ensure clean browser bundle execution
    const html2pdfModule = await import('html2pdf.js');
    const html2pdf = (html2pdfModule.default || html2pdfModule) as any;

    const opt = {
      margin: options.margin ?? [8, 8, 8, 8],
      filename: safeFilename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        logging: false,
        backgroundColor: '#ffffff'
      },
      jsPDF: {
        unit: options.unit || 'mm',
        format: options.format || 'a4',
        orientation: options.orientation || 'portrait'
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    await html2pdf().set(opt).from(element).save();
    return true;
  } catch (error) {
    console.warn('html2pdf direct download encounter, falling back to window.print():', error);
    window.print();
    return false;
  }
}
