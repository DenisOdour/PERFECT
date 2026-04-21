const express = require('express');
const router = express.Router();
const { Payment, Job, Business } = require('../models/index');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

router.post('/initiate', protect, async (req, res) => {
  try {
    const { phone, amount, purpose, metadata } = req.body;
    const payment = await Payment.create({ user: req.user._id, amount, purpose, phone: phone || req.user.phone, metadata, status: 'pending' });
    // In sandbox/dev mode, auto-confirm after 2 seconds
    setTimeout(async () => {
      try {
        await processPayment(payment._id, purpose, metadata, req.user._id, amount, 'SANDBOX_' + Date.now());
        req.app.get('io')?.to(req.user._id.toString()).emit('payment_confirmed', { paymentId: payment._id, purpose, amount });
      } catch (e) { console.error('Auto-confirm error:', e.message); }
    }, 2000);
    res.json({ success: true, payment, message: 'Payment initiated. In sandbox mode it will confirm in 2 seconds.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

async function processPayment(paymentId, purpose, metadata, userId, amount, mpesaCode) {
  await Payment.findByIdAndUpdate(paymentId, { status: 'completed', mpesaCode });
  if (purpose === 'admin_subscription') {
    const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await User.findByIdAndUpdate(userId, { role: 'admin', $addToSet: { adminCategories: metadata?.category }, 'subscription.plan': 'admin', 'subscription.expiresAt': expiry });
  } else if (purpose === 'job_featured' && metadata?.jobId) {
    await Job.findByIdAndUpdate(metadata.jobId, { tier: metadata.tier || 'featured', featuredUntil: new Date(Date.now() + 7*24*60*60*1000), mpesaRef: mpesaCode });
  } else if (purpose === 'business_listing' && metadata?.businessId) {
    await Business.findByIdAndUpdate(metadata.businessId, { plan: metadata.plan || 'basic', isActive: true, planExpiresAt: new Date(Date.now() + 30*24*60*60*1000), mpesaRef: mpesaCode });
  }
}

router.get('/history', protect, async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, payments });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/pricing', (req, res) => {
  res.json({ success: true, pricing: {
    admin: { jobs: 5000, business_directory: 3500, skills: 4500, stories: 2000, donations: 4000 },
    jobs:  { featured: 500, sponsored: 2000 },
    business: { basic: 2500, standard: 5000, premium: 7500 }
  }});
});

module.exports = router;
