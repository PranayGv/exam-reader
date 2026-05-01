import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { db } from '../db';
import './PDFViewer.css';
import { Bot, ZoomIn, ZoomOut } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Standard PDF page width at 72dpi (letter size)
const NATURAL_PDF_WIDTH = 612;

export default function PDFViewer({ pdfMeta, onProgressUpdate }) {
  const [numPages, setNumPages] = useState(null);
  const [userZoom, setUserZoom] = useState(1.0); // multiplier on top of fit-width
  const [fileData, setFileData] = useState(null);
  const [containerWidth, setContainerWidth] = useState(null);
  const onProgressRef = useRef(onProgressUpdate);
  const numPagesRef   = useRef(null);
  const [selection, setSelection] = useState({ text: '', x: 0, y: 0, show: false });

  useEffect(() => { onProgressRef.current = onProgressUpdate; }, [onProgressUpdate]);

  // Measure container width using a callback ref on the scroll div
  const measureRef = useRef(null);
  const setMeasureRef = useCallback(el => {
    if (!el) return;
    measureRef.current = el;
    const measure = () => setContainerWidth(Math.floor(el.clientWidth - 24));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // Store cleanup
    el._roCleanup = () => ro.disconnect();
  }, []);

  // Attach scroll listener via callback ref on the scrollable div
  const scrollEl = useRef(null);
  const setScrollRef = useCallback(el => {
    // Detach from old
    if (scrollEl.current) {
      scrollEl.current.removeEventListener('scroll', handleScroll);
    }
    scrollEl.current = el;
    if (el) {
      el.addEventListener('scroll', handleScroll, { passive: true });
    }
  }, []); // eslint-disable-line

  function handleScroll() {
    const el = scrollEl.current;
    if (!el || !numPagesRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight) return;
    const pct = (scrollTop / (scrollHeight - clientHeight)) * 100;
    onProgressRef.current?.(Math.min(100, Math.max(0, pct)));
  }

  // Load PDF blob
  useEffect(() => {
    if (!pdfMeta?.id) return;
    setFileData(null);
    setNumPages(null);
    numPagesRef.current = null;
    setUserZoom(1.0);

    db.getPdf(pdfMeta.id)
      .then(blob => blob.arrayBuffer())
      .then(buf => setFileData(buf))
      .catch(err => console.error('PDF load error:', err));
  }, [pdfMeta?.id]);

  // Restore scroll after pages render
  useEffect(() => {
    if (!numPages || !scrollEl.current) return;
    const el = scrollEl.current;
    const timer = setTimeout(() => {
      if (pdfMeta.progress > 0 && el.scrollHeight > el.clientHeight) {
        el.scrollTop = (pdfMeta.progress / 100) * (el.scrollHeight - el.clientHeight);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [numPages]);

  function onDocumentLoadSuccess({ numPages: n }) {
    numPagesRef.current = n;
    setNumPages(n);
  }

  // Compute page render width:
  // - On mobile: fill the container
  // - On desktop: natural width (NATURAL_PDF_WIDTH * userZoom), capped to container
  const isMobile = window.innerWidth <= 768;
  const baseWidth = containerWidth
    ? (isMobile ? containerWidth : Math.min(containerWidth, NATURAL_PDF_WIDTH * 1.2))
    : (isMobile ? window.innerWidth - 16 : NATURAL_PDF_WIDTH * 1.2);
  const pageWidth = Math.round(baseWidth * userZoom);

  const handleSelection = () => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (text?.length > 0) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setSelection({ text, x: rect.left + rect.width / 2, y: rect.top - 44, show: true });
    } else {
      setSelection(s => ({ ...s, show: false }));
    }
  };

  const askChatGPT = () => {
    window.open(`https://chatgpt.com/?q=${encodeURIComponent(selection.text)}`, '_blank');
    setSelection(s => ({ ...s, show: false }));
    window.getSelection()?.removeAllRanges();
  };

  return (
    <div className="pdf-viewer-container" onMouseUp={handleSelection}>

      {/* Toolbar */}
      <div className="pdf-toolbar">
        <div className="pdf-title">{pdfMeta.name.replace(/\.pdf$/i, '')}</div>
        <div className="pdf-controls">
          <button className="pdf-ctrl-btn" onClick={() => setUserZoom(z => Math.max(0.4, parseFloat((z - 0.2).toFixed(1))))} disabled={userZoom <= 0.4}><ZoomOut size={16} /></button>
          <button className="pdf-scale-label" onClick={() => setUserZoom(1.0)} title="Reset zoom">{Math.round(userZoom * 100)}%</button>
          <button className="pdf-ctrl-btn" onClick={() => setUserZoom(z => Math.min(3.0, parseFloat((z + 0.2).toFixed(1))))} disabled={userZoom >= 3.0}><ZoomIn size={16} /></button>
          <div className="pdf-divider" />
          <span className="pdf-pages-label">{numPages ? `${numPages}p` : '—'}</span>
        </div>
      </div>

      {/* THE KEY FIX: display:block (not flex) so overflow-y works correctly */}
      <div
        className="pdf-scroll-area"
        ref={el => { setScrollRef(el); setMeasureRef(el); }}
      >
        {!fileData ? (
          <div className="pdf-loading">Loading PDF…</div>
        ) : (
          <div className="pdf-pages-wrapper">
            <Document
              file={fileData}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<div className="pdf-loading">Rendering…</div>}
              error={<div className="pdf-error">Failed to load PDF.</div>}
            >
              {Array.from({ length: numPages || 0 }, (_, i) => (
                <div key={i + 1} className="pdf-page-block">
                  <Page
                    pageNumber={i + 1}
                    width={pageWidth}
                    renderTextLayer
                    renderAnnotationLayer
                  />
                </div>
              ))}
            </Document>
          </div>
        )}
      </div>

      {selection.show && (
        <button
          className="chatgpt-popup"
          style={{ left: selection.x, top: selection.y }}
          onClick={askChatGPT}
        >
          <Bot size={14} /> Ask ChatGPT
        </button>
      )}
    </div>
  );
}
