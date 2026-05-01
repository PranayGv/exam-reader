import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { db } from '../db';
import './PDFViewer.css';
import { Bot, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PDFViewer({ pdfMeta, onProgressUpdate }) {
  const [numPages, setNumPages] = useState(null);
  const [scale, setScale] = useState(1.2);
  const [fileData, setFileData] = useState(null);
  const contentRef = useRef(null);
  const [initialScrollSet, setInitialScrollSet] = useState(false);
  
  // Selection state
  const [selection, setSelection] = useState({ text: '', x: 0, y: 0, show: false });

  useEffect(() => {
    const loadPdf = async () => {
      try {
        setFileData(null);
        setNumPages(null);
        const fileBlob = await db.getPdf(pdfMeta.id);
        const arrayBuffer = await fileBlob.arrayBuffer();
        setFileData(arrayBuffer);
      } catch (err) {
        console.error('Error loading PDF:', err);
      }
    };

    if (pdfMeta?.id) {
      setInitialScrollSet(false);
      loadPdf();
    }
  }, [pdfMeta]);

  useEffect(() => {
    if (numPages && contentRef.current && !initialScrollSet) {
      const timer = setTimeout(() => {
        const el = contentRef.current;
        if (pdfMeta.progress > 0 && el.scrollHeight > el.clientHeight) {
          el.scrollTop = (pdfMeta.progress / 100) * (el.scrollHeight - el.clientHeight);
        }
        setInitialScrollSet(true);
      }, 800); // Wait for pages to render their canvas
      return () => clearTimeout(timer);
    }
  }, [numPages, pdfMeta.progress, initialScrollSet]);

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
  }

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (!numPages || !fileData) return;

    if (scrollHeight <= clientHeight) {
      // Container hasn't fully rendered the PDF pages yet, or PDF is tiny
      // Ignore to prevent false 100% completion bugs on load
      return;
    }
    
    const progress = (scrollTop / (scrollHeight - clientHeight)) * 100;
    
    if (onProgressUpdate) {
      onProgressUpdate(Math.min(100, Math.max(0, progress)));
    }
  };

  const handleSelection = () => {
    const sel = window.getSelection();
    const text = sel.toString().trim();
    
    if (text.length > 0) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      setSelection({
        text,
        x: rect.left + rect.width / 2,
        y: rect.top - 40, // Above the selection
        show: true
      });
    } else {
      setSelection({ ...selection, show: false });
    }
  };

  const askChatGPT = () => {
    const query = encodeURIComponent(selection.text);
    window.open(`https://chatgpt.com/?q=${query}`, '_blank');
    setSelection({ ...selection, show: false });
    window.getSelection().removeAllRanges();
  };

  if (!fileData) return <div className="pdf-loading">Loading PDF...</div>;

  return (
    <div className="pdf-viewer-container" onMouseUp={handleSelection}>
      <div className="pdf-toolbar glass-panel">
        <div className="pdf-title">{pdfMeta.name}</div>
        <div className="pdf-controls">
          <button className="btn-icon" onClick={() => setScale(s => Math.max(0.5, s - 0.2))}><ZoomOut size={18} /></button>
          <button className="btn-icon" onClick={() => setScale(s => Math.min(3, s + 0.2))}><ZoomIn size={18} /></button>
          <div className="divider"></div>
          <span className="page-info">
            {numPages ? `${numPages} Pages` : 'Loading...'}
          </span>
        </div>
      </div>

      <div className="pdf-content" onScroll={handleScroll} ref={contentRef}>
        <div className="pdf-continuous-wrapper">
          <Document
            file={fileData}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<div className="p-4 text-muted">Loading document...</div>}
            error={<div className="p-4 text-danger">Failed to load PDF.</div>}
          >
            {Array.from(new Array(numPages || 0), (el, index) => (
              <Page 
                key={`page_${index + 1}`}
                pageNumber={index + 1} 
                scale={scale} 
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="mb-4 shadow-md"
              />
            ))}
          </Document>
        </div>
      </div>

      {selection.show && (
        <button 
          className="chatgpt-popup"
          style={{ left: selection.x, top: selection.y }}
          onClick={askChatGPT}
        >
          <Bot size={16} />
          Ask ChatGPT
        </button>
      )}
    </div>
  );
}
