import { useState, useEffect, useRef } from 'react';
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
  const initialScrollSet = useRef(false);
  const numPagesRef = useRef(null);
  const fileDataRef = useRef(null);
  // Keep callback in a ref so scroll handler always has latest version
  const onProgressRef = useRef(onProgressUpdate);
  const [selection, setSelection] = useState({ text: '', x: 0, y: 0, show: false });

  // Always keep ref in sync with prop
  useEffect(() => { onProgressRef.current = onProgressUpdate; }, [onProgressUpdate]);

  // Measure container width immediately + watch for resize
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth || window.innerWidth;
      setContainerWidth(Math.max(100, Math.floor(w - 16)));
    };
    measure(); // immediate
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Load PDF blob
  useEffect(() => {
    if (!pdfMeta?.id) return;
    initialScrollSet.current = false;
    setFileData(null);
    setNumPages(null);
    numPagesRef.current = null;
    fileDataRef.current = null;
    setScale(1.0);

    db.getPdf(pdfMeta.id).then(blob => {
      blob.arrayBuffer().then(buf => {
        fileDataRef.current = buf;
        setFileData(buf);
      });
    }).catch(err => console.error('PDF load error:', err));
  }, [pdfMeta?.id]);

  // Restore scroll position once pages render
  useEffect(() => {
    if (!numPages || !contentRef.current || initialScrollSet.current) return;
    const timer = setTimeout(() => {
      const el = contentRef.current;
      if (!el) return;
      if (pdfMeta.progress > 0 && el.scrollHeight > el.clientHeight) {
        el.scrollTop = (pdfMeta.progress / 100) * (el.scrollHeight - el.clientHeight);
      }
      initialScrollSet.current = true;
    }, 900);
    return () => clearTimeout(timer);
  }, [numPages]);

  // Native scroll listener — attaches AFTER fileData loads (so contentRef.current exists)
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const onScroll = () => {
      if (!numPagesRef.current || !fileDataRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight <= clientHeight) return;
      const pct = (scrollTop / (scrollHeight - clientHeight)) * 100;
      if (onProgressRef.current) {
        onProgressRef.current(Math.min(100, Math.max(0, pct)));
      }
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [fileData]); // ← re-run when fileData changes so ref is populated

  function onDocumentLoadSuccess({ numPages: n }) {
    numPagesRef.current = n;
    setNumPages(n);
  }

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
    window.open(`https://chatgpt.com/?q=${encodeURIComponent(selection.text)}`, '_blank');
    setSelection(s => ({ ...s, show: false }));
    window.getSelection().removeAllRanges();
  };

  const zoomIn  = () => setScale(s => Math.min(3.0, parseFloat((s + 0.2).toFixed(1))));
  const zoomOut = () => setScale(s => Math.max(0.3, parseFloat((s - 0.2).toFixed(1))));

  if (!fileData) return <div className="pdf-loading">Loading PDF...</div>;

  const pageWidth = containerWidth || Math.max(100, window.innerWidth - 32);

  return (
    <div className="pdf-viewer-container" onMouseUp={handleSelection}>
      {/* Toolbar */}
      <div className="pdf-toolbar">
        <div className="pdf-title">{pdfMeta.name.replace(/\.pdf$/i, '')}</div>
        <div className="pdf-controls">
          <button className="pdf-ctrl-btn" onClick={zoomOut} disabled={scale <= 0.3}><ZoomOut size={16} /></button>
          <button className="pdf-scale-label" onClick={() => setScale(1.0)}>{Math.round(scale * 100)}%</button>
          <button className="pdf-ctrl-btn" onClick={zoomIn}  disabled={scale >= 3.0}><ZoomIn  size={16} /></button>
          <div className="pdf-divider" />
          <span className="pdf-pages-label">{numPages ? `${numPages}p` : '—'}</span>
        </div>
      </div>

      {/* Scrollable PDF area */}
      <div className="pdf-content" ref={contentRef}>
        <div className="pdf-continuous-wrapper" ref={wrapperRef}>
          <div
            className="pdf-scaled-inner"
            style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
          >
            <Document
              file={fileData}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<div className="pdf-doc-loading">Rendering document…</div>}
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
        </div>
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
