import localforage from 'localforage';

// Configure localforage instance for exams
const examDb = localforage.createInstance({
  name: 'ExamReader',
  storeName: 'exams'
});

// Configure localforage instance for PDFs to avoid 5MB localStorage limits
const pdfDb = localforage.createInstance({
  name: 'ExamReader',
  storeName: 'pdfs'
});

export const db = {
  // Exam Operations
  async getExams() {
    const exams = [];
    await examDb.iterate((value, key) => {
      exams.push(value);
    });
    return exams.sort((a, b) => new Date(a.date) - new Date(b.date));
  },

  async getExam(id) {
    return await examDb.getItem(id);
  },

  async addExam(exam) {
    return await examDb.setItem(exam.id, exam);
  },

  async updateExam(exam) {
    return await examDb.setItem(exam.id, exam);
  },

  async deleteExam(id) {
    // Delete associated PDFs first
    const exam = await examDb.getItem(id);
    if (exam && exam.pdfs) {
      for (const pdf of exam.pdfs) {
        await pdfDb.removeItem(pdf.id);
      }
    }
    return await examDb.removeItem(id);
  },

  // PDF Operations
  async getPdf(id) {
    return await pdfDb.getItem(id);
  },

  async savePdf(id, fileBlob) {
    return await pdfDb.setItem(id, fileBlob);
  }
};
