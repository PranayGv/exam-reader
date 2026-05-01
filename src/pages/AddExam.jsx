import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Upload, FileText } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import './AddExam.css';

export default function AddExam() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    date: ''
  });
  const [syllabusPdf, setSyllabusPdf] = useState(null);
  const [files, setFiles] = useState([]);

  const handleSyllabusFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf') {
        setSyllabusPdf(file);
      } else {
        alert('Please upload a PDF file for the syllabus');
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter(file => file.type === 'application/pdf');
      setFiles([...files, ...newFiles]);
    }
  };

  const handleRemoveFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.date) return alert('Name and Date are required');
    
    setLoading(true);
    try {
      const examId = uuidv4();
      const pdfsMeta = [];

      // Save PDFs
      for (const file of files) {
        const fileId = uuidv4();
        await db.savePdf(fileId, file);
        pdfsMeta.push({
          id: fileId,
          name: file.name,
          size: file.size,
          numPages: 0,
          visitedPages: []
        });
      }

      let syllabusMeta = null;
      if (syllabusPdf) {
        const fileId = uuidv4();
        await db.savePdf(fileId, syllabusPdf);
        syllabusMeta = {
          id: fileId,
          name: syllabusPdf.name,
          size: syllabusPdf.size,
          numPages: 0,
          visitedPages: []
        };
      }

      const examData = {
        id: examId,
        name: formData.name,
        date: formData.date,
        syllabusPdf: syllabusMeta,
        pdfs: pdfsMeta,
        progress: 0,
        createdAt: new Date().toISOString()
      };

      await db.addExam(examData);
      navigate(`/exam/${examId}`);
    } catch (error) {
      console.error('Error saving exam:', error);
      alert('Failed to save exam');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container add-exam">
      <div className="mb-8">
        <h1>Add New Exam</h1>
        <p>Set up your study materials and track your progress.</p>
      </div>

      <form onSubmit={handleSubmit} className="glass-panel form-container">
        <div className="form-group">
          <label>Exam Name</label>
          <input 
            type="text" 
            placeholder="e.g. Final Mathematics Exam" 
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label>Exam Date</label>
          <input 
            type="date" 
            value={formData.date}
            onChange={e => setFormData({ ...formData, date: e.target.value })}
            required
          />
        </div>

        <div className="form-divider"></div>

        <div className="form-group">
          <label>Syllabus (PDF)</label>
          <div className="file-upload-wrapper">
            <input 
              type="file" 
              id="syllabus-upload" 
              accept=".pdf"
              onChange={handleSyllabusFileChange}
              className="file-input"
            />
            <label htmlFor="syllabus-upload" className="file-upload-label" style={{ padding: '1.5rem' }}>
              <Upload size={20} className="mb-2" />
              <span>{syllabusPdf ? 'Change Syllabus PDF' : 'Upload Syllabus PDF'}</span>
            </label>
          </div>
          {syllabusPdf && (
            <div className="file-item mt-2">
              <FileText size={18} className="text-accent" />
              <span className="flex-1 truncate">{syllabusPdf.name}</span>
              <button 
                type="button" 
                className="btn-icon text-danger" 
                onClick={() => setSyllabusPdf(null)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>

        <div className="form-divider"></div>

        <div className="form-group">
          <label>Study Materials (PDFs)</label>
          
          <div className="file-upload-wrapper">
            <input 
              type="file" 
              id="file-upload" 
              multiple 
              accept=".pdf"
              onChange={handleFileChange}
              className="file-input"
            />
            <label htmlFor="file-upload" className="file-upload-label">
              <Upload size={24} className="mb-2" />
              <span>Click to upload PDFs</span>
              <span className="text-sm text-muted">or drag and drop</span>
            </label>
          </div>

          {files.length > 0 && (
            <div className="file-list mt-4">
              {files.map((file, index) => (
                <div key={index} className="file-item">
                  <FileText size={18} className="text-accent" />
                  <span className="flex-1 truncate">{file.name}</span>
                  <span className="text-muted text-sm mr-4">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                  <button 
                    type="button" 
                    className="btn-icon text-danger" 
                    onClick={() => handleRemoveFile(index)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-actions mt-8 pt-6 border-t">
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={() => navigate('/')}
            disabled={loading}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Save Exam'}
          </button>
        </div>
      </form>
    </div>
  );
}
