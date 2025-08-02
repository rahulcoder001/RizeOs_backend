// server/utils/nlpUtils.js
const natural = require('natural');
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;

// Skill database (can be extended)
const skillsDB = [
  'javascript', 'typescript', 'react', 'node.js', 'python', 'java', 'c++', 
  'html', 'css', 'sass', 'redux', 'graphql', 'mongodb', 'postgresql', 
  'docker', 'kubernetes', 'aws', 'azure', 'git', 'blockchain', 'solidity', 
  'machine learning', 'ai', 'nlp', 'web3', 'ethereum', 'solana', 'smart contracts'
];

// Extract skills from text
exports.extractSkills = (text) => {
  const tokens = tokenizer.tokenize(text.toLowerCase());
  const stems = tokens.map(token => stemmer.stem(token));
  
  const foundSkills = new Set();
  
  // Match against skillsDB
  skillsDB.forEach(skill => {
    const skillTokens = skill.split(' ');
    const skillStems = skillTokens.map(token => stemmer.stem(token));
    
    // Check for exact match
    if (skillStems.every(stem => stems.includes(stem))) {
      foundSkills.add(skill);
      return;
    }
    
    // Check for similar matches
    const distance = natural.JaroWinklerDistance(
      skillStems.join(' '), 
      stems.join(' ')
    );
    
    if (distance > 0.85) {
      foundSkills.add(skill);
    }
  });
  
  return Array.from(foundSkills);
};

// Calculate similarity between two texts
exports.calculateSimilarity = (text1, text2) => {
  const tokens1 = tokenizer.tokenize(text1.toLowerCase());
  const tokens2 = tokenizer.tokenize(text2.toLowerCase());
  
  const stems1 = tokens1.map(token => stemmer.stem(token));
  const stems2 = tokens2.map(token => stemmer.stem(token));
  
  const set1 = new Set(stems1);
  const set2 = new Set(stems2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
};

// Find closest matches with typo tolerance
exports.findClosestMatches = (query, options) => {
  const queryStem = stemmer.stem(query.toLowerCase());
  
  return options
    .map(option => {
      const optionStem = stemmer.stem(option.toLowerCase());
      const distance = natural.JaroWinklerDistance(queryStem, optionStem);
      return { option, distance };
    })
    .filter(match => match.distance > 0.7)
    .sort((a, b) => b.distance - a.distance)
    .map(match => match.option);
};

// Get skill suggestions
exports.getSkillSuggestions = (query, allSkills) => {
  const queryStem = stemmer.stem(query.toLowerCase());
  
  return allSkills
    .filter(skill => {
      const skillStem = stemmer.stem(skill.toLowerCase());
      return (
        skill.includes(query.toLowerCase()) ||
        natural.JaroWinklerDistance(queryStem, skillStem) > 0.7
      );
    })
    .slice(0, 5);
};