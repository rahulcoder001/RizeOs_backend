// server/server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const aiRoutes = require('./routes/ai');
const jobRoutes = require('./routes/jobs');

const app = express();



// Add job routes

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.DATABASE_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error(err));

// Routes

app.use('/api/ai', aiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.get('/',(req,res)=>{
    res.json({msg:'working fine'})
})
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));