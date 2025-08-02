// server/routes/jobs.js
const express = require('express');
const router = express.Router();
const { InfuraProvider, formatEther } = require('ethers'); // ✅ Correct destructured import
const Job = require('../models/job');
const User = require('../models/User');
const verifyToken = require('../middleware/auth');

// Admin wallet address (set in .env)
const ADMIN_WALLET = process.env.ADMIN_WALLET;

// Create job (with payment verification)
const { 
  extractSkills, 
  calculateSimilarity, 
  findClosestMatches,
  getSkillSuggestions
} = require('../utils/nlpUtils');

// Get all unique skills from database
router.get('/skills', async (req, res) => {
  try {
    const jobs = await Job.find();
    const allSkills = new Set();
    
    jobs.forEach(job => {
      job.skills.forEach(skill => allSkills.add(skill.toLowerCase()));
    });
    
    res.json(Array.from(allSkills));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enhanced job search with NLP
router.get('/search', async (req, res) => {
  try {
    const { q, skills, location, tags } = req.query;
    let filter = {};
    
    // Apply filters
    if (location) filter.location = new RegExp(location, 'i');
    if (tags) filter.tags = { $in: tags.split(',').map(tag => new RegExp(tag, 'i')) };
    
    let jobs = await Job.find(filter)
      .populate('createdBy', 'name walletAddress')
      .sort({ createdAt: -1 });
    
    // Apply NLP-based search
    if (q) {
      const query = q.toLowerCase();
      
      jobs = jobs.filter(job => {
        // Combine all searchable fields
        const searchText = [
          job.title,
          job.description,
          job.skills.join(' '),
          job.tags.join(' ')
        ].join(' ').toLowerCase();
        
        // Check for direct match
        if (searchText.includes(query)) return true;
        
        // Check for similar matches
        const closestMatches = findClosestMatches(query, searchText.split(' '));
        return closestMatches.length > 0;
      });
    }
    
    // Apply skills filter with NLP
    if (skills) {
      const requiredSkills = skills.split(',').map(skill => skill.trim().toLowerCase());
      
      jobs = jobs.filter(job => {
        const jobSkills = job.skills.map(skill => skill.toLowerCase());
        return requiredSkills.every(skill => 
          jobSkills.some(js => natural.JaroWinklerDistance(skill, js) > 0.8)
        );
      });
    }
    
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get job recommendations for a user
router.get('/recommendations/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const jobs = await Job.find().populate('createdBy', 'name walletAddress');
    const userProfileText = [
      user.bio || '',
      (user.skills || []).join(' ')
    ].join(' ');
    
    const scoredJobs = jobs.map(job => {
      const jobText = [
        job.title,
        job.description,
        job.skills.join(' ')
      ].join(' ');
      
      const similarity = calculateSimilarity(userProfileText, jobText);
      return { ...job.toObject(), similarity };
    });
    
    // Filter and sort by similarity
    const recommendations = scoredJobs
      .filter(job => job.similarity > 0.3)
      .sort((a, b) => b.similarity - a.distance)
      .slice(0, 10);
    
    res.json(recommendations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const { title, description, skills, budget, salary, location, tags, paymentTxHash } = req.body;
    const userId = req.user.id; // From JWT middleware

    // ✅ Verify payment transaction using InfuraProvider
    const provider = new InfuraProvider('sepolia', process.env.INFURA_API_KEY);
    const tx = await provider.getTransaction(paymentTxHash);

    if (!tx) {
      return res.status(400).json({ error: 'Transaction not found' });
    }

    const receipt = await tx.wait();
    const amount = formatEther(tx.value); // ✅
    const minAmount = 0.001;

    if (
      tx.to.toLowerCase() !== ADMIN_WALLET.toLowerCase() ||
      parseFloat(amount) < minAmount ||
      receipt.status !== 1
    ) {
      return res.status(400).json({ error: 'Invalid payment transaction' });
    }

    // ✅ Create job after payment verification
    const job = new Job({
      title,
      description,
      skills: skills.split(',').map(skill => skill.trim()),
      budget,
      salary,
      location,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      createdBy: userId,
      paymentTxHash
    });

    await job.save();
    res.status(201).json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get jobs with filters
router.get('/', async (req, res) => {
  try {
    const { skills, location, tags, search } = req.query;
    const filter = {};

    if (skills) {
      filter.skills = { $in: skills.split(',').map(skill => new RegExp(skill, 'i')) };
    }

    if (location) {
      filter.location = new RegExp(location, 'i');
    }

    if (tags) {
      filter.tags = { $in: tags.split(',').map(tag => new RegExp(tag, 'i')) };
    }

    if (search) {
      filter.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }

    const jobs = await Job.find(filter)
      .populate('createdBy', 'name walletAddress')
      .sort({ createdAt: -1 });

    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
