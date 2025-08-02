// server/routes/ai.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdf = require('pdf-parse');
const { extractSkills } = require('../utils/nlpUtils');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Extract skills from resume
router.post('/extract-skills', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Parse PDF
    const data = await pdf(req.file.buffer);
    const text = data.text;
    
    // Extract skills using NLP
    const skills = extractSkills(text);
    
    res.json({ skills });
  } catch (err) {
    console.error('Error extracting skills:', err);
    res.status(500).json({ error: 'Failed to extract skills' });
  }
});

module.exports = router;