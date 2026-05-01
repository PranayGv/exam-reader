import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, FileText } from 'lucide-react';
import { db } from '../db';
import PDFViewer from '../components/PDFViewer';
import './StudyWorkspace.css';

export default function StudyWorkspace() {
  const { id } = useParams();
  const [exam, setExam] = useState(null);
  const [activePdf, setActivePdf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const loadExam = async () => {
      const data = await db.getExam(id);
      if (data) {
        setExam(data);
        if (data.pdfs && data.pdfs.length > 0) {
          setActivePdf(data.pdfs[0]);
        }
      }
      setLoading(false);
    };
    loadExam();
  }, [id]);

  const handleProgressUpdate = async (progress) => {
    if (!activePdf) return;
    
    const newExam = { ...exam };
    let pdfMeta;
    
    if (newExam.syllabusPdf?.id === activePdf.id) {
      pdfMeta = newExam.syllabusPdf;
    } else {
      pdfMeta = newExam.pdfs?.find(p => p.id === activePdf.id);
    }

    if (!pdfMeta) return;

    if (Math.abs((pdfMeta.progress || 0) - progress) > 1) { // Only update if changed by > 1% to reduce db writes
      pdfMeta.progress = progress;

      const studyPdfs = newExam.pdfs || [];
      let totalProgress = 0;
      
      studyPdfs.forEach(p => {
        totalProgress += (p.progress || 0);
      });

      newExam.progress = studyPdfs.length > 0 ? (totalProgress / studyPdfs.length) : 0;

      setExam(newExam);
      await db.updateExam(newExam);
    }
  };

  const handleNotesChange = async (e) => {
    const newExam = { ...exam, notes: e.target.value };
    setExam(newExam);
    await db.updateExam(newExam);
  };

  if (loading) return <div className="container mt-8">Loading workspace...</div>;
  if (!exam) return <div className="container mt-8">Exam not found</div>;

  return (
    <div className="workspace-container">
      {/* Sidebar */}
      {isSidebarOpen && (
        <aside className="workspace-sidebar glass-panel" style={{ position: 'relative' }}>
          <button 
            className="btn-icon" 
            onClick={() => setIsSidebarOpen(false)}
            title="Close Sidebar"
            style={{ position: 'absolute', top: '1.25rem', right: '1rem' }}
          >
            <ChevronLeft size={20} />
          </button>

          <div className="sidebar-header">
            <Link to="/" className="back-link">
              <ArrowLeft size={16} /> Back to Dashboard
            </Link>
            <h2 className="exam-title">{exam.name}</h2>
            
            {exam.syllabusPdf && (
              <button 
                className={`btn btn-secondary w-full mt-4 flex justify-center ${activePdf?.id === exam.syllabusPdf.id ? 'active-syllabus' : ''}`}
                onClick={() => setActivePdf(exam.syllabusPdf)}
              >
                <FileText size={16} className="text-accent" />
                View Syllabus PDF
              </button>
            )}

            <div className="overall-progress mt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Completion</span>
                <span className="text-sm font-bold text-accent">{Math.round(exam.progress || 0)}%</span>
              </div>
              <div className="progress-bar-lg">
                <div 
                  className="progress-fill-lg" 
                  style={{ width: `${exam.progress || 0}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="sidebar-section pdf-list-section">
            <h3 className="section-title">Documents</h3>
            <div className="pdf-list">
              {exam.pdfs?.map((pdf) => (
                <button 
                  key={pdf.id}
                  className={`pdf-nav-item flex-col ${activePdf?.id === pdf.id ? 'active' : ''}`}
                  onClick={() => setActivePdf(pdf)}
                >
                  <div className="flex items-center gap-2 w-full">
                    <FileText size={18} />
                    <span className="truncate flex-1">{pdf.name}</span>
                    <span className="text-xs text-muted font-medium">{Math.round(pdf.progress || 0)}%</span>
                  </div>
                  <div className="progress-bar w-full mt-2" style={{ height: '4px', background: 'var(--bg-primary)' }}>
                    <div className="progress-fill" style={{ width: `${pdf.progress || 0}%`, background: 'var(--accent-primary)' }}></div>
                  </div>
                </button>
              ))}
              {(!exam.pdfs || exam.pdfs.length === 0) && (
                <div className="text-sm text-muted">No PDFs uploaded</div>
              )}
            </div>
          </div>

          <div className="sidebar-section notes-section">
            <h3 className="section-title">Notes</h3>
            <textarea
              className="notes-textarea"
              placeholder="Jot down important notes here..."
              value={exam.notes || ''}
              onChange={handleNotesChange}
            ></textarea>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <main className="workspace-main" style={{ position: 'relative' }}>
        {!isSidebarOpen && (
          <div className="floating-nav glass-panel shadow-md flex items-center gap-1 rounded-lg absolute top-4 left-4 z-50" style={{ padding: '0.25rem' }}>
            <button 
              className="btn-icon p-2 rounded-md" 
              onClick={() => setIsSidebarOpen(true)}
              title="Open Sidebar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
            </button>
            <div style={{ background: 'var(--border-color)', width: '1px', height: '20px', margin: '0 4px' }}></div>
            <Link to="/" className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium">
              <ArrowLeft size={16} /> Dashboard
            </Link>
          </div>
        )}

        {activePdf ? (
          <PDFViewer pdfMeta={activePdf} onProgressUpdate={handleProgressUpdate} />
        ) : (
          <div className="empty-state glass-panel h-full">
            <FileText size={48} className="mb-4 text-muted" />
            <h3>No PDF Selected</h3>
            <p>Select a document from the sidebar to start reading.</p>
          </div>
        )}
      </main>
    </div>
  );
}
