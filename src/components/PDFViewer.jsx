import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { db } from '../db';
import './PDFViewer.css';
import { Bot, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

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

  // Measure container width — render PDF at this base width, scale via CSS transform
  useEffect(() => {
    if (!wrapperRef.current) return;
    // Set an immediate fallback so pages render right away on mobile
    setContainerWidth(Math.floor((wrapperRef.current.clientWidth || window.innerWidth) - 24));

    const observer = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w) setContainerWidth(Math.floor(w - 24));
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
        setScale(1.0); // reset zoom on doc switch
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

  const zoomIn  = () => setScale(s => Math.min(3.0, parseFloat((s + 0.2).toFixed(1))));
  const zoomOut = () => setScale(s => Math.max(0.3, parseFloat((s - 0.2).toFixed(1))));
  const resetZoom = () => setScale(1.0);

  if (!fileData) return <div className="pdf-loading">Loading PDF...</div>;

  return (
    <div className="pdf-viewer-container" onMouseUp={handleSelection}>
      {/* Toolbar */}
      <div className="pdf-toolbar">
        <div className="pdf-title">{pdfMeta.name.replace(/\.pdf$/i, '')}</div>
        <div className="pdf-controls">
          <button className="pdf-ctrl-btn" onClick={zoomOut} title="Zoom out" disabled={scale <= 0.3}><ZoomOut size={16} /></button>
          <button className="pdf-scale-label" onClick={resetZoom} title="Reset zoom">{Math.round(scale * 100)}%</button>
          <button className="pdf-ctrl-btn" onClick={zoomIn}  title="Zoom in"  disabled={scale >= 3.0}><ZoomIn  size={16} /></button>
          <div className="pdf-divider" />
          <span className="pdf-pages-label">{numPages ? `${numPages}p` : '—'}</span>
        </div>
      </div>

      {/* Scroll container */}
      <div className="pdf-content" onScroll={handleScroll} ref={contentRef}>
        {/* wrapperRef measures available width */}
        <div className="pdf-continuous-wrapper" ref={wrapperRef}>
          {/* Inner div scaled with CSS transform so zoom doesn't re-render pages */}
          <div
            className="pdf-scaled-inner"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
            }}
          >
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
                    width={containerWidth || Math.floor(window.innerWidth - 48)}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                </div>
              ))}
            </Document>
          </div>
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
