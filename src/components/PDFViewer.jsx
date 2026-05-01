import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { db } from '../db';
import './PDFViewer.css';
import { Bot, ZoomIn, ZoomOut } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PDFViewer({ pdfMeta, onProgressUpdate }) {
  const [numPages, setNumPages] = useState(null);
  const [scale, setScale] = useState(1.0);
  const [fileData, setFileData] = useState(null);
  const [containerWidth, setContainerWidth] = useState(null);
  const contentRef = useRef(null);
  const wrapperRef = useRef(null);
  const [initialScrollSet, setInitialScrollSet] = useState(false);
  const [selection, setSelection] = useState({ text: '', x: 0, y: 0, show: false });

  // Measure container width for responsive PDF sizing
  useEffect(() => {
    if (!wrapperRef.current) return;
    const observer = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w) setContainerWidth(w - 32); // subtract padding
    });
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, []);

  // Load PDF blob
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

  // Restore scroll position
  useEffect(() => {
    if (numPages && contentRef.current && !initialScrollSet) {
      const timer = setTimeout(() => {
        const el = contentRef.current;
        if (pdfMeta.progress > 0 && el.scrollHeight > el.clientHeight) {
          el.scrollTop = (pdfMeta.progress / 100) * (el.scrollHeight - el.clientHeight);
        }
        setInitialScrollSet(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [numPages, pdfMeta.progress, initialScrollSet]);

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
  }

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (!numPages || !fileData) return;
    if (scrollHeight <= clientHeight) return;
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
      setSelection({ text, x: rect.left + rect.width / 2, y: rect.top - 44, show: true });
    } else {
      setSelection(s => ({ ...s, show: false }));
    }
  };

  const askChatGPT = () => {
    const query = encodeURIComponent(selection.text);
    window.open(`https://chatgpt.com/?q=${query}`, '_blank');
    setSelection(s => ({ ...s, show: false }));
    window.getSelection().removeAllRanges();
  };

  // Page width: use container width when available, else scale-based
  const pageWidth = containerWidth ? containerWidth * scale : undefined;

  if (!fileData) return <div className="pdf-loading">Loading PDF...</div>;

  return (
    <div className="pdf-viewer-container" onMouseUp={handleSelection}>
      <div className="pdf-toolbar">
        <div className="pdf-title">{pdfMeta.name.replace(/\.pdf$/i, '')}</div>
        <div className="pdf-controls">
          <button className="pdf-ctrl-btn" onClick={() => setScale(s => Math.max(0.4, s - 0.15))} title="Zoom out"><ZoomOut size={16} /></button>
          <span className="pdf-scale-label">{Math.round(scale * 100)}%</span>
          <button className="pdf-ctrl-btn" onClick={() => setScale(s => Math.min(3, s + 0.15))} title="Zoom in"><ZoomIn size={16} /></button>
          <div className="pdf-divider" />
          <span className="pdf-pages-label">{numPages ? `${numPages} pages` : '—'}</span>
        </div>
      </div>

      <div className="pdf-content" onScroll={handleScroll} ref={contentRef}>
        <div className="pdf-continuous-wrapper" ref={wrapperRef}>
          <Document
            file={fileData}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<div className="pdf-loading">Rendering pages...</div>}
            error={<div className="pdf-error">Failed to load PDF.</div>}
          >
            {Array.from(new Array(numPages || 0), (_, index) => (
              <div key={`page_${index + 1}`} className="pdf-page-block">
                <Page
                  pageNumber={index + 1}
                  width={pageWidth}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                />
              </div>
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
          <Bot size={14} />
          Ask ChatGPT
        </button>
      )}
    </div>
  );
}
