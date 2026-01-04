import { useState } from 'react';
import { X, Download, Printer, FileText } from 'lucide-react';
import { downloadDocumentAsHTML } from '../lib/documentArchiveService';

interface ArchivedDocument {
  id: string;
  document_type: 'invoice' | 'grc';
  document_number: string;
  document_html: string;
  created_at: string;
}

interface DocumentViewerProps {
  document: ArchivedDocument;
  onClose: () => void;
}

export default function DocumentViewer({ document, onClose }: DocumentViewerProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = () => {
    setIsPrinting(true);
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(document.document_html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
        setIsPrinting(false);
      };
    } else {
      setIsPrinting(false);
      alert('Please allow popups to print the document');
    }
  };

  const handleDownload = () => {
    const filename = `${document.document_number}.html`;
    downloadDocumentAsHTML(document.document_html, filename);
  };

  const documentTypeLabel = document.document_type === 'invoice' ? 'Invoice' : 'GRC';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-bold text-gray-800">
                Archived {documentTypeLabel}
              </h3>
              <p className="text-sm text-gray-600">{document.document_number}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </button>
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm disabled:opacity-50"
            >
              <Printer className="w-4 h-4 mr-2" />
              {isPrinting ? 'Printing...' : 'Print'}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Document Preview */}
        <div className="flex-1 overflow-auto p-4 bg-gray-100">
          <div className="bg-white shadow-lg mx-auto" style={{ maxWidth: '800px' }}>
            <iframe
              srcDoc={document.document_html}
              title={`${documentTypeLabel} Preview`}
              className="w-full border-0"
              style={{ height: '70vh' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <p className="text-xs text-gray-500 text-center">
            Archived on {new Date(document.created_at).toLocaleString('en-IN')} • 
            This is a legally preserved copy of the original document
          </p>
        </div>
      </div>
    </div>
  );
}
