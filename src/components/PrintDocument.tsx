import { useRef, ReactNode } from 'react';
import { Printer } from 'lucide-react';

interface PrintDocumentProps {
  children: ReactNode;
  title: string;
  buttonText?: string;
  buttonClassName?: string;
}

export default function PrintDocument({ 
  children, 
  title, 
  buttonText = 'Print',
  buttonClassName = 'flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition'
}: PrintDocumentProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!contentRef.current) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print documents');
      return;
    }

    const styles = `
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.5;
          color: #1f2937;
          background: white;
        }
        .invoice-container, .grc-container {
          padding: 20mm;
          max-width: 210mm;
          margin: 0 auto;
        }
        
        /* Tailwind-like utility classes for print */
        .text-center { text-align: center; }
        .text-left { text-align: left; }
        .text-right { text-align: right; }
        .font-bold { font-weight: 700; }
        .font-semibold { font-weight: 600; }
        .font-medium { font-weight: 500; }
        
        .text-3xl { font-size: 1.875rem; }
        .text-2xl { font-size: 1.5rem; }
        .text-xl { font-size: 1.25rem; }
        .text-lg { font-size: 1.125rem; }
        .text-sm { font-size: 0.875rem; }
        .text-xs { font-size: 0.75rem; }
        
        .text-gray-900 { color: #111827; }
        .text-gray-800 { color: #1f2937; }
        .text-gray-700 { color: #374151; }
        .text-gray-600 { color: #4b5563; }
        .text-blue-700 { color: #1d4ed8; }
        .text-green-700 { color: #15803d; }
        .text-red-700 { color: #b91c1c; }
        .text-white { color: white; }
        
        .bg-white { background-color: white; }
        .bg-gray-50 { background-color: #f9fafb; }
        .bg-gray-800 { background-color: #1f2937; }
        
        .border { border: 1px solid #d1d5db; }
        .border-t { border-top: 1px solid #d1d5db; }
        .border-b { border-bottom: 1px solid #d1d5db; }
        .border-t-2 { border-top: 2px solid #1f2937; }
        .border-b-2 { border-bottom: 2px solid #1f2937; }
        .border-gray-300 { border-color: #d1d5db; }
        .border-gray-400 { border-color: #9ca3af; }
        .border-gray-800 { border-color: #1f2937; }
        
        .rounded-lg { border-radius: 0.5rem; }
        
        .p-4 { padding: 1rem; }
        .p-8 { padding: 2rem; }
        .px-4 { padding-left: 1rem; padding-right: 1rem; }
        .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
        .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
        .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
        .pb-2 { padding-bottom: 0.5rem; }
        .pb-4 { padding-bottom: 1rem; }
        .pt-2 { padding-top: 0.5rem; }
        .pt-4 { padding-top: 1rem; }
        
        .mb-2 { margin-bottom: 0.5rem; }
        .mb-4 { margin-bottom: 1rem; }
        .mb-6 { margin-bottom: 1.5rem; }
        .mb-8 { margin-bottom: 2rem; }
        .mt-1 { margin-top: 0.25rem; }
        .mt-2 { margin-top: 0.5rem; }
        .mt-4 { margin-top: 1rem; }
        .mt-8 { margin-top: 2rem; }
        .mt-12 { margin-top: 3rem; }
        .mx-8 { margin-left: 2rem; margin-right: 2rem; }
        
        .flex { display: flex; }
        .grid { display: grid; }
        .grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
        .gap-4 { gap: 1rem; }
        .gap-6 { gap: 1.5rem; }
        .gap-8 { gap: 2rem; }
        .justify-between { justify-content: space-between; }
        .justify-end { justify-content: flex-end; }
        .items-start { align-items: flex-start; }
        
        .col-span-2 { grid-column: span 2; }
        
        .w-full { width: 100%; }
        .w-72 { width: 18rem; }
        
        .uppercase { text-transform: uppercase; }
        .tracking-wide { letter-spacing: 0.05em; }
        
        .list-disc { list-style-type: disc; }
        .list-inside { list-style-position: inside; }
        
        /* Table styles */
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 0.5rem 1rem; }
        thead tr { background-color: #1f2937; color: white; }
        tbody tr:nth-child(even) { background-color: #f9fafb; }
        
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .invoice-container, .grc-container {
            padding: 15mm;
          }
        }
      </style>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          ${styles}
        </head>
        <body>
          ${contentRef.current.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    
    // Wait for content to load then print
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <>
      <button onClick={handlePrint} className={buttonClassName}>
        <Printer className="w-4 h-4 mr-2" />
        {buttonText}
      </button>
      {/* Hidden content for printing */}
      <div style={{ display: 'none' }}>
        <div ref={contentRef}>
          {children}
        </div>
      </div>
    </>
  );
}
