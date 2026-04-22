/**
 * MTAA CONNECT — COMPLETE SELF-CONTAINED BACKEND
 * ALL routes defined inline. Nothing can go missing on Render.
 *
 * Render settings:
 *   Root Directory : backend
 *   Build Command  : npm install
 *   Start Command  : node server.js
 *
 * Environment variables required on Render:
 *   MONGO_URI     = mongodb+srv://...
 *   JWT_SECRET    = (any long random string)
 *   NODE_ENV      = production
 *   FRONTEND_URL  = https://mtaa-connection.vercel.app
 */

require('dotenv').config();
const express   = require('express');
const http      = require('http');
const socketio  = require('socket.io');
const mongoose  = require('mongoose');
const cors      = require('cors');
const helmet    = require('helmet');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const app    = express();
const server = http.createServer(app);
const JWT_SECRET = process.env.JWT_SECRET || 'mtaa_connect_default_secret_change_in_prod';

// ══════════════════════════════════════════════════════════════════
// CORS
// ══════════════════════════════════════════════════════════════════
const corsOptions = {
  origin: (origin, cb) => {
    // Allow no-origin (Postman, mobile), vercel.app, onrender.com, localhost
    if (!origin) return cb(null, true);
    if (origin.endsWith('.vercel.app'))   return cb(null, true);
    if (origin.endsWith('.onrender.com')) return cb(null, true);
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) return cb(null, true);
    // In production be permissive — don't block real users
    console.warn('[CORS] Unknown origin:', origin);
    cb(null, true);
  },
  credentials: false,
  methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','Accept','X-Requested-With'],
  optionsSuccessStatus: 200
};
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

// ══════════════════════════════════════════════════════════════════
// SOCKET.IO
// ══════════════════════════════════════════════════════════════════
const io = socketio(server, {
  cors: { origin: '*', methods: ['GET','POST'], credentials: false }
});
app.set('io', io);

// ══════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ══════════════════════════════════════════════════════════════════
app.use(helmet({ crossOriginResourcePolicy:false, crossOriginOpenerPolicy:false, crossOriginEmbedderPolicy:false }));
app.use(express.json({ limit:'10mb' }));
app.use(express.urlencoded({ extended:true, limit:'10mb' }));
app.use('/api/', rateLimit({ windowMs:15*60*1000, max:500, message:{ success:false, message:'Too many requests.' } }));

// ══════════════════════════════════════════════════════════════════
// DATABASE
// ══════════════════════════════════════════════════════════════════
if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI environment variable is not set!');
  console.error('   Set it in Render dashboard: Environment → Add Environment Variable');
  process.exit(1);
}
mongoose.connect(process.env.MONGO_URI)
  .then(() => { console.log('✅ MongoDB connected'); seedAdmin(); })
  .catch(err => { console.error('❌ MongoDB failed:', err.message); process.exit(1); });

// ══════════════════════════════════════════════════════════════════
// MODELS
// ══════════════════════════════════════════════════════════════════
const userSchema = new mongoose.Schema({
  name:            { type:String, required:true, trim:true },
  username:        { type:String, unique:true, sparse:true, lowercase:true, trim:true },
  phone:           { type:String, required:true, unique:true, trim:true },
  email:           { type:String, unique:true, sparse:true, lowercase:true, trim:true },
  password:        { type:String, required:true, minlength:6, select:false },
  avatar:          { type:String, default:'' },
  area:            { type:String, default:'Nairobi' },
  role:            { type:String, enum:['user','admin','super_admin'], default:'user' },
  adminCategories: [String],
  isVerified:      { type:Boolean, default:false },
  isActive:        { type:Boolean, default:true },
  isBanned:        { type:Boolean, default:false },
  bio:             { type:String, default:'', maxlength:300 },
  shareLocation:   { type:Boolean, default:false },
  location:        { type:{ type:String, default:'Point' }, coordinates:{ type:[Number], default:[36.8219,-1.2921] } },
  locationUpdatedAt: Date,
  postsCount:      { type:Number, default:0 },
  followersCount:  { type:Number, default:0 },
  followingCount:  { type:Number, default:0 },
  followers:       [{ type:mongoose.Schema.Types.ObjectId, ref:'User' }],
  following:       [{ type:mongoose.Schema.Types.ObjectId, ref:'User' }],
  subscription:    { plan:{ type:String, default:'free' }, expiresAt:Date },
  lastSeen:        { type:Date, default:Date.now }
}, { timestamps:true });
userSchema.index({ location:'2dsphere' });
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});
userSchema.methods.comparePassword = async function(pw) { return bcrypt.compare(pw, this.password); };
userSchema.methods.toJSON = function() { const o = this.toObject(); delete o.password; return o; };
const User = mongoose.models.User || mongoose.model('User', userSchema);

const commentSchema = new mongoose.Schema({ author:{ type:mongoose.Schema.Types.ObjectId, ref:'User' }, content:String, likes:[{ type:mongoose.Schema.Types.ObjectId }], createdAt:{ type:Date, default:Date.now } });
const postSchema = new mongoose.Schema({
  author:{ type:mongoose.Schema.Types.ObjectId, ref:'User', required:true }, title:{ type:String, required:true }, content:{ type:String, required:true },
  category:{ type:String, default:'story' }, tags:[String], media:[{ url:String, type:String }],
  status:{ type:String, enum:['pending','approved','rejected','featured'], default:'pending' }, rejectionReason:String, featuredAt:Date,
  likes:[{ type:mongoose.Schema.Types.ObjectId, ref:'User' }], comments:[commentSchema],
  shares:{ type:Number, default:0 }, views:{ type:Number, default:0 }, saves:[{ type:mongoose.Schema.Types.ObjectId, ref:'User' }],
  location:{ area:String }, isAnonymous:{ type:Boolean, default:false }, isPinned:{ type:Boolean, default:false }
}, { timestamps:true });
const Post = mongoose.models.Post || mongoose.model('Post', postSchema);

const jobSchema = new mongoose.Schema({
  postedBy:{ type:mongoose.Schema.Types.ObjectId, ref:'User', required:true }, title:String, description:String, category:{ type:String, default:'casual' },
  location:String, pay:String, payType:{ type:String, default:'daily' }, slots:{ type:Number, default:1 }, contact:String, requirements:[String],
  tier:{ type:String, enum:['free','featured','sponsored'], default:'free' }, status:{ type:String, enum:['active','filled','expired','removed'], default:'active' },
  applicants:[{ type:mongoose.Schema.Types.ObjectId, ref:'User' }], views:{ type:Number, default:0 }
}, { timestamps:true });
const Job = mongoose.models.Job || mongoose.model('Job', jobSchema);

const bizSchema = new mongoose.Schema({
  owner:{ type:mongoose.Schema.Types.ObjectId, ref:'User', required:true }, name:String, category:{ type:String, default:'other' }, description:String,
  location:String, phone:String, plan:{ type:String, enum:['basic','standard','premium'], default:'basic' },
  isVerified:{ type:Boolean, default:false }, isActive:{ type:Boolean, default:false },
  reviews:[{ user:{ type:mongoose.Schema.Types.ObjectId, ref:'User' }, rating:Number, comment:String, createdAt:{ type:Date, default:Date.now } }],
  averageRating:{ type:Number, default:0 }, reviewCount:{ type:Number, default:0 }
}, { timestamps:true });
const Business = mongoose.models.Business || mongoose.model('Business', bizSchema);

const donationSchema = new mongoose.Schema({
  requestedBy:{ type:mongoose.Schema.Types.ObjectId, ref:'User' }, isAnonymous:{ type:Boolean, default:false }, area:String, familySize:Number, situation:String,
  needs:[String], urgency:{ type:String, enum:['low','medium','urgent'], default:'medium' }, status:{ type:String, enum:['pending','verified','fulfilled','closed'], default:'pending' },
  verifiedBy:{ type:mongoose.Schema.Types.ObjectId, ref:'User' }, responses:[{ ngo:{ type:mongoose.Schema.Types.ObjectId, ref:'User' }, message:String, date:Date }]
}, { timestamps:true });
const Donation = mongoose.models.Donation || mongoose.model('Donation', donationSchema);

const reportSchema = new mongoose.Schema({
  reportedBy:{ type:mongoose.Schema.Types.ObjectId, ref:'User' }, isAnonymous:{ type:Boolean, default:true }, type:String, description:String, location:String,
  status:{ type:String, enum:['open','in_progress','resolved','closed'], default:'open' }, upvotes:[{ type:mongoose.Schema.Types.ObjectId, ref:'User' }], resolution:String, resolvedAt:Date
}, { timestamps:true });
const Report = mongoose.models.Report || mongoose.model('Report', reportSchema);

const emergencySchema = new mongoose.Schema({
  triggeredBy:{ type:mongoose.Schema.Types.ObjectId, ref:'User', required:true }, type:String, description:String, location:String, area:String,
  severity:{ type:String, default:'high' }, status:{ type:String, enum:['active','responding','resolved'], default:'active' }, resolvedAt:Date
}, { timestamps:true });
const Emergency = mongoose.models.Emergency || mongoose.model('Emergency', emergencySchema);

const safetySchema = new mongoose.Schema({ reportedBy:{ type:mongoose.Schema.Types.ObjectId, ref:'User' }, type:String, location:String, description:String, contact:String, status:{ type:String, default:'new' } }, { timestamps:true });
const Safety = mongoose.models.Safety || mongoose.model('Safety', safetySchema);

const skillSchema = new mongoose.Schema({
  title:String, category:String, description:String, instructor:{ type:mongoose.Schema.Types.ObjectId, ref:'User' }, instructorName:String,
  type:{ type:String, default:'video' }, location:String, schedule:String, isFree:{ type:Boolean, default:true }, price:{ type:Number, default:0 },
  videos:[{ title:String, url:String, duration:String }], enrolled:[{ type:mongoose.Schema.Types.ObjectId, ref:'User' }],
  enrollCount:{ type:Number, default:0 }, rating:{ type:Number, default:0 }, isActive:{ type:Boolean, default:true }
}, { timestamps:true });
const SkillCourse = mongoose.models.SkillCourse || mongoose.model('SkillCourse', skillSchema);

const msgSchema = new mongoose.Schema({ sender:{ type:mongoose.Schema.Types.ObjectId, ref:'User', required:true }, recipient:{ type:mongoose.Schema.Types.ObjectId, ref:'User', required:true }, content:{ type:String, required:true }, isRead:{ type:Boolean, default:false } }, { timestamps:true });
const Message = mongoose.models.Message || mongoose.model('Message', msgSchema);

const notifSchema = new mongoose.Schema({ recipient:{ type:mongoose.Schema.Types.ObjectId, ref:'User', required:true }, type:String, title:String, body:String, link:String, isRead:{ type:Boolean, default:false } }, { timestamps:true });
const Notification = mongoose.models.Notification || mongoose.model('Notification', notifSchema);

const paySchema = new mongoose.Schema({ user:{ type:mongoose.Schema.Types.ObjectId, ref:'User', required:true }, amount:Number, purpose:String, mpesaCode:String, phone:String, status:{ type:String, enum:['pending','completed','failed'], default:'pending' }, metadata:mongoose.Schema.Types.Mixed }, { timestamps:true });
const Payment = mongoose.models.Payment || mongoose.model('Payment', paySchema);

// ══════════════════════════════════════════════════════════════════
// AUTH HELPERS
// ══════════════════════════════════════════════════════════════════
const signToken = id => jwt.sign({ id }, JWT_SECRET, { expiresIn:'30d' });

const protect = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ success:false, message:'Not authorized. Please login.' });
    const decoded = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user)        return res.status(401).json({ success:false, message:'User not found.' });
    if (user.isBanned) return res.status(403).json({ success:false, message:'Account suspended.' });
    req.user = user; next();
  } catch { return res.status(401).json({ success:false, message:'Token invalid or expired. Please login again.' }); }
};

const adminOnly = (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin'))
    return res.status(403).json({ success:false, message:'Admin access required.' });
  next();
};

const optionalAuth = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      const decoded = jwt.verify(auth.split(' ')[1], JWT_SECRET);
      req.user = await User.findById(decoded.id);
    }
  } catch { /* ignore */ }
  next();
};

// ══════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ══════════════════════════════════════════════════════════════════
app.get('/', (req, res) => res.json({ status:'OK', app:'Mtaa Connect API v2', time:new Date() }));
app.get('/api/health', (req, res) => res.json({ status:'OK', app:'Mtaa Connect API v2', db:mongoose.connection.readyState===1?'connected':'disconnected', time:new Date() }));

// ══════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════════════════════════════
const authR = express.Router();

authR.post('/register', async (req, res) => {
  try {
    const { name, phone, email, password, area, bio, username } = req.body;
    if (!name?.trim())    return res.status(400).json({ success:false, message:'Name is required.' });
    if (!phone?.trim())   return res.status(400).json({ success:false, message:'Phone number is required.' });
    if (!password || password.length < 6) return res.status(400).json({ success:false, message:'Password must be at least 6 characters.' });
    if (!area?.trim())    return res.status(400).json({ success:false, message:'Area/estate is required.' });

    if (await User.findOne({ phone:phone.trim() }))
      return res.status(400).json({ success:false, message:'This phone number is already registered. Please login instead.' });
    if (email && await User.findOne({ email:email.toLowerCase().trim() }))
      return res.status(400).json({ success:false, message:'This email is already registered.' });
    if (username && await User.findOne({ username:username.toLowerCase().trim() }))
      return res.status(400).json({ success:false, message:'This username is already taken.' });

    const data = { name:name.trim(), phone:phone.trim(), password, area:area.trim() };
    if (email)    data.email    = email.toLowerCase().trim();
    if (bio)      data.bio      = bio.trim();
    if (username) data.username = username.toLowerCase().trim();

    const user  = await User.create(data);
    const token = signToken(user._id);
    res.status(201).json({ success:true, token, user });
  } catch(err) {
    console.error('Register error:', err);
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern||{})[0] || 'field';
      return res.status(400).json({ success:false, message:`That ${field} is already in use.` });
    }
    res.status(500).json({ success:false, message:'Registration failed. Please try again.' });
  }
});

authR.post('/login', async (req, res) => {
  try {
    // Accept identifier, phone, username, or email — whichever is sent
    const { identifier, phone, username, email, password } = req.body;
    const loginId = (identifier || phone || username || email || '').toString().trim();

    if (!loginId) return res.status(400).json({ success:false, message:'Please enter your phone number or username.' });
    if (!password) return res.status(400).json({ success:false, message:'Please enter your password.' });

    const user = await User.findOne({
      $or: [
        { phone:    loginId },
        { username: loginId.toLowerCase() },
        { email:    loginId.toLowerCase() }
      ]
    }).select('+password');

    if (!user)         return res.status(401).json({ success:false, message:'No account found with that phone number or username. Please register first.' });
    if (user.isBanned) return res.status(403).json({ success:false, message:'Account suspended. Please contact support.' });
    if (!(await user.comparePassword(password))) return res.status(401).json({ success:false, message:'Incorrect password. Please try again.' });

    user.lastSeen = new Date();
    await user.save({ validateBeforeSave:false });

    res.json({ success:true, token:signToken(user._id), user });
  } catch(err) {
    console.error('Login error:', err);
    res.status(500).json({ success:false, message:'Login failed due to a server error. Please try again.' });
  }
});

authR.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success:false, message:'User not found.' });
    res.json({ success:true, user });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

authR.put('/profile', protect, async (req, res) => {
  try {
    const allowed = ['name','email','bio','area','avatar','shareLocation','username'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new:true, runValidators:true });
    res.json({ success:true, user });
  } catch(err) {
    if (err.code===11000) return res.status(400).json({ success:false, message:'Username already taken.' });
    res.status(500).json({ success:false, message:err.message });
  }
});

authR.put('/password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword||!newPassword) return res.status(400).json({ success:false, message:'Provide current and new password.' });
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword))) return res.status(400).json({ success:false, message:'Current password is incorrect.' });
    user.password = newPassword; await user.save();
    res.json({ success:true, message:'Password updated.' });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

authR.post('/location', protect, async (req, res) => {
  try {
    const { lat, lng, shareLocation } = req.body;
    const upd = { locationUpdatedAt:new Date() };
    if (lat&&lng) upd.location = { type:'Point', coordinates:[parseFloat(lng),parseFloat(lat)] };
    if (shareLocation!==undefined) upd.shareLocation = shareLocation;
    await User.findByIdAndUpdate(req.user._id, upd);
    res.json({ success:true });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

authR.post('/follow/:id', protect, async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success:false, message:'User not found.' });
    if (target._id.toString()===req.user._id.toString()) return res.status(400).json({ success:false, message:"You can't follow yourself." });
    const isF = req.user.following?.some(f=>f.toString()===target._id.toString());
    if (isF) {
      await User.findByIdAndUpdate(req.user._id,{ $pull:{ following:target._id },$inc:{ followingCount:-1 } });
      await User.findByIdAndUpdate(target._id,  { $pull:{ followers:req.user._id },$inc:{ followersCount:-1 } });
      res.json({ success:true, following:false });
    } else {
      await User.findByIdAndUpdate(req.user._id,{ $addToSet:{ following:target._id },$inc:{ followingCount:1 } });
      await User.findByIdAndUpdate(target._id,  { $addToSet:{ followers:req.user._id },$inc:{ followersCount:1 } });
      res.json({ success:true, following:true });
    }
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

app.use('/api/auth', authR);

// ══════════════════════════════════════════════════════════════════
// POSTS
// ══════════════════════════════════════════════════════════════════
const postsR = express.Router();
postsR.get('/', optionalAuth, async (req,res) => {
  try {
    const { page=1,limit=10,category,sort='latest' } = req.query;
    const q = { status:{ $in:['approved','featured'] } };
    if (category&&category!=='all') q.category=category;
    const sb = sort==='trending'?{ views:-1,createdAt:-1 }:{ isPinned:-1,createdAt:-1 };
    const [posts,total] = await Promise.all([
      Post.find(q).populate('author','name avatar area role').sort(sb).skip((parseInt(page)-1)*parseInt(limit)).limit(parseInt(limit)).lean(),
      Post.countDocuments(q)
    ]);
    const uid = req.user?._id?.toString();
    res.json({ success:true, posts:posts.map(p=>({ ...p, likesCount:p.likes?.length||0, commentsCount:p.comments?.length||0, isLiked:uid?(p.likes||[]).some(l=>l.toString()===uid):false, isSaved:uid?(p.saves||[]).some(s=>s.toString()===uid):false, comments:undefined,likes:undefined,saves:undefined })), total, pages:Math.ceil(total/parseInt(limit)) });
  } catch(err) { res.status(500).json({ success:false,message:err.message }); }
});
postsR.get('/trending', async (req,res) => {
  try { const p=await Post.find({ status:{ $in:['approved','featured'] } }).select('title category likes comments views createdAt author').populate('author','name area').sort({ views:-1,createdAt:-1 }).limit(10).lean(); res.json({ success:true,posts:p }); }
  catch(err) { res.status(500).json({ success:false,message:err.message }); }
});
postsR.get('/admin/pending', protect, adminOnly, async (req,res) => {
  try { const p=await Post.find({ status:'pending' }).populate('author','name phone area avatar').sort({ createdAt:-1 }); res.json({ success:true,posts:p }); }
  catch(err) { res.status(500).json({ success:false,message:err.message }); }
});
postsR.get('/:id', optionalAuth, async (req,res) => {
  try { const p=await Post.findByIdAndUpdate(req.params.id,{ $inc:{ views:1 } },{ new:true }).populate('author','name avatar area bio role').populate('comments.author','name avatar area'); if(!p) return res.status(404).json({ success:false,message:'Post not found.' }); res.json({ success:true,post:p }); }
  catch(err) { res.status(500).json({ success:false,message:err.message }); }
});
postsR.post('/', protect, async (req,res) => {
  try {
    const { title,content,category,tags,media,location,isAnonymous } = req.body;
    if (!title||!content) return res.status(400).json({ success:false,message:'Title and content are required.' });
    const isAdm = ['admin','super_admin'].includes(req.user.role);
    const p = await Post.create({ author:req.user._id,title,content,category:category||'story',tags,media,isAnonymous,location:location||{ area:req.user.area },status:isAdm?'approved':'pending' });
    req.app.get('io')?.to('admins').emit('new_post_pending',{ postId:p._id,title,authorName:req.user.name });
    res.status(201).json({ success:true,post:p,message:isAdm?'Post published!':'Post submitted for review.' });
  } catch(err) { res.status(500).json({ success:false,message:err.message }); }
});
postsR.post('/:id/like', protect, async (req,res) => {
  try { const p=await Post.findById(req.params.id); if(!p) return res.status(404).json({ success:false,message:'Post not found.' }); const liked=p.likes.some(l=>l.toString()===req.user._id.toString()); if(liked) p.likes.pull(req.user._id); else p.likes.push(req.user._id); await p.save(); res.json({ success:true,liked:!liked,likesCount:p.likes.length }); }
  catch(err) { res.status(500).json({ success:false,message:err.message }); }
});
postsR.post('/:id/comment', protect, async (req,res) => {
  try { const { content }=req.body; if(!content) return res.status(400).json({ success:false,message:'Content required.' }); const p=await Post.findById(req.params.id); if(!p) return res.status(404).json({ success:false,message:'Post not found.' }); p.comments.push({ author:req.user._id,content }); await p.save(); await p.populate('comments.author','name avatar area'); res.json({ success:true,comment:p.comments[p.comments.length-1] }); }
  catch(err) { res.status(500).json({ success:false,message:err.message }); }
});
postsR.post('/:id/save', protect, async (req,res) => {
  try { const p=await Post.findById(req.params.id); if(!p) return res.status(404).json({ success:false,message:'Not found.' }); const s=p.saves.some(x=>x.toString()===req.user._id.toString()); if(s) p.saves.pull(req.user._id); else p.saves.push(req.user._id); await p.save(); res.json({ success:true,saved:!s }); }
  catch(err) { res.status(500).json({ success:false,message:err.message }); }
});
postsR.post('/:id/share', async (req,res) => { try { await Post.findByIdAndUpdate(req.params.id,{ $inc:{ shares:1 } }); res.json({ success:true }); } catch(err) { res.status(500).json({ success:false,message:err.message }); } });
postsR.put('/:id/moderate', protect, adminOnly, async (req,res) => {
  try {
    const { action,reason }=req.body;
    const map={ approve:{ status:'approved' },reject:{ status:'rejected',rejectionReason:reason },feature:{ status:'featured',featuredAt:new Date() },pin:{ isPinned:true },unpin:{ isPinned:false } };
    if (!map[action]) return res.status(400).json({ success:false,message:'Invalid action.' });
    const p=await Post.findByIdAndUpdate(req.params.id,map[action],{ new:true }).populate('author','name');
    if (!p) return res.status(404).json({ success:false,message:'Not found.' });
    req.app.get('io')?.to(p.author._id.toString()).emit('post_moderated',{ action,postId:p._id });
    res.json({ success:true,post:p });
  } catch(err) { res.status(500).json({ success:false,message:err.message }); }
});
postsR.delete('/:id', protect, async (req,res) => {
  try { const p=await Post.findById(req.params.id); if(!p) return res.status(404).json({ success:false,message:'Not found.' }); const ok=p.author.toString()===req.user._id.toString()||['admin','super_admin'].includes(req.user.role); if(!ok) return res.status(403).json({ success:false,message:'Not authorized.' }); await p.deleteOne(); res.json({ success:true }); }
  catch(err) { res.status(500).json({ success:false,message:err.message }); }
});
app.use('/api/posts', postsR);

// ══════════════════════════════════════════════════════════════════
// JOBS
// ══════════════════════════════════════════════════════════════════
const jobsR = express.Router();
jobsR.get('/', optionalAuth, async (req,res) => {
  try { const { page=1,limit=10,category }=req.query; const q={ status:'active' }; if(category&&category!=='all') q.category=category; const [jobs,total]=await Promise.all([Job.find(q).populate('postedBy','name avatar area').sort({ tier:-1,createdAt:-1 }).skip((parseInt(page)-1)*parseInt(limit)).limit(parseInt(limit)).lean(),Job.countDocuments(q)]); res.json({ success:true,jobs,total,pages:Math.ceil(total/parseInt(limit)) }); }
  catch(err) { res.status(500).json({ success:false,message:err.message }); }
});
jobsR.post('/', protect, async (req,res) => {
  try { const j=await Job.create({ ...req.body,postedBy:req.user._id }); req.app.get('io')?.emit('new_job',{ jobId:j._id,title:j.title,location:j.location,pay:j.pay }); res.status(201).json({ success:true,job:j }); }
  catch(err) { res.status(500).json({ success:false,message:err.message }); }
});
jobsR.post('/:id/apply', protect, async (req,res) => {
  try { const j=await Job.findById(req.params.id); if(!j) return res.status(404).json({ success:false,message:'Not found.' }); if(j.applicants.some(a=>a.toString()===req.user._id.toString())) return res.status(400).json({ success:false,message:'Already applied.' }); j.applicants.push(req.user._id); await j.save(); res.json({ success:true,message:'Application sent!' }); }
  catch(err) { res.status(500).json({ success:false,message:err.message }); }
});
app.use('/api/jobs', jobsR);

// ══════════════════════════════════════════════════════════════════
// REMAINING ROUTES (donations, reports, businesses, safety, skills, emergency, messages, notifications, payments, maps, admin)
// ══════════════════════════════════════════════════════════════════
const donR=express.Router();
donR.get('/', async (req,res) => { try { const d=await Donation.find({ status:{ $in:['pending','verified'] } }).populate('requestedBy','name avatar area').sort({ urgency:-1,createdAt:-1 }); res.json({ success:true,donations:d }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
donR.post('/', protect, async (req,res) => { try { const d=await Donation.create({ ...req.body,requestedBy:req.user._id }); res.status(201).json({ success:true,donation:d }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
donR.put('/:id/verify', protect, adminOnly, async (req,res) => { try { const d=await Donation.findByIdAndUpdate(req.params.id,{ status:'verified',verifiedBy:req.user._id },{ new:true }); res.json({ success:true,donation:d }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
donR.post('/:id/respond', protect, async (req,res) => { try { const d=await Donation.findById(req.params.id); if(!d) return res.status(404).json({ success:false,message:'Not found.' }); d.responses.push({ ngo:req.user._id,message:req.body.message||'We can help.',date:new Date() }); await d.save(); res.json({ success:true }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
app.use('/api/donations', donR);

const repR=express.Router();
repR.get('/', async (req,res) => { try { const r=await Report.find({ status:{ $in:['open','in_progress'] } }).populate('reportedBy','name area').sort({ createdAt:-1 }); res.json({ success:true,reports:r }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
repR.post('/', protect, async (req,res) => { try { const r=await Report.create({ ...req.body,reportedBy:req.user._id }); res.status(201).json({ success:true,report:r }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
repR.post('/:id/upvote', protect, async (req,res) => { try { const r=await Report.findById(req.params.id); if(!r) return res.status(404).json({ success:false,message:'Not found.' }); const v=r.upvotes.some(u=>u.toString()===req.user._id.toString()); if(v) r.upvotes.pull(req.user._id); else r.upvotes.push(req.user._id); await r.save(); res.json({ success:true,upvotes:r.upvotes.length }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
repR.put('/:id/status', protect, adminOnly, async (req,res) => { try { const upd={ status:req.body.status }; if(req.body.resolution) upd.resolution=req.body.resolution; if(req.body.status==='resolved') upd.resolvedAt=new Date(); const r=await Report.findByIdAndUpdate(req.params.id,upd,{ new:true }); res.json({ success:true,report:r }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
app.use('/api/reports', repR);

const bizR=express.Router();
bizR.get('/', async (req,res) => { try { const { category,page=1,limit=12 }=req.query; const q={ isActive:true }; if(category&&category!=='all') q.category=category; const [b,total]=await Promise.all([Business.find(q).populate('owner','name avatar').sort({ plan:-1,averageRating:-1 }).skip((parseInt(page)-1)*parseInt(limit)).limit(parseInt(limit)),Business.countDocuments(q)]); res.json({ success:true,businesses:b,total }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
bizR.post('/', protect, async (req,res) => { try { const b=await Business.create({ ...req.body,owner:req.user._id,isActive:false }); res.status(201).json({ success:true,business:b }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
bizR.post('/:id/review', protect, async (req,res) => { try { const b=await Business.findById(req.params.id); if(!b) return res.status(404).json({ success:false,message:'Not found.' }); b.reviews.push({ user:req.user._id,rating:parseInt(req.body.rating),comment:req.body.comment }); b.reviewCount=b.reviews.length; b.averageRating=+(b.reviews.reduce((a,r)=>a+r.rating,0)/b.reviews.length).toFixed(1); await b.save(); res.json({ success:true,averageRating:b.averageRating }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
bizR.put('/:id/verify', protect, adminOnly, async (req,res) => { try { const b=await Business.findByIdAndUpdate(req.params.id,{ isVerified:true,isActive:true },{ new:true }); res.json({ success:true,business:b }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
app.use('/api/businesses', bizR);

const sfR=express.Router();
sfR.post('/', protect, async (req,res) => { try { const r=await Safety.create({ ...req.body,reportedBy:req.user._id }); res.status(201).json({ success:true,report:r,message:'Report received confidentially.' }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
sfR.get('/', protect, adminOnly, async (req,res) => { try { const r=await Safety.find().sort({ createdAt:-1 }); res.json({ success:true,reports:r }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
app.use('/api/safety', sfR);

const skR=express.Router();
skR.get('/', async (req,res) => { try { const c=await SkillCourse.find({ isActive:true }).populate('instructor','name avatar bio').sort({ enrollCount:-1 }); res.json({ success:true,courses:c }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
skR.post('/', protect, adminOnly, async (req,res) => { try { const c=await SkillCourse.create({ ...req.body,instructor:req.user._id }); res.status(201).json({ success:true,course:c }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
skR.post('/:id/enroll', protect, async (req,res) => { try { const c=await SkillCourse.findById(req.params.id); if(!c) return res.status(404).json({ success:false,message:'Not found.' }); if(c.enrolled.some(e=>e.toString()===req.user._id.toString())) return res.status(400).json({ success:false,message:'Already enrolled.' }); c.enrolled.push(req.user._id); c.enrollCount+=1; await c.save(); res.json({ success:true,message:'Enrolled!' }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
app.use('/api/skills', skR);

const emR=express.Router();
emR.post('/', protect, async (req,res) => { try { const em=await Emergency.create({ ...req.body,triggeredBy:req.user._id }); req.app.get('io')?.emit('emergency_broadcast',{ id:em._id,...req.body,triggeredBy:{ name:req.user.name,phone:req.user.phone },timestamp:new Date() }); res.status(201).json({ success:true,emergency:em,message:'Alert sent!' }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
emR.get('/', protect, async (req,res) => { try { const em=await Emergency.find({ status:{ $ne:'resolved' } }).populate('triggeredBy','name phone area').sort({ createdAt:-1 }).limit(20); res.json({ success:true,emergencies:em }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
emR.put('/:id/resolve', protect, adminOnly, async (req,res) => { try { const em=await Emergency.findByIdAndUpdate(req.params.id,{ status:'resolved',resolvedAt:new Date() },{ new:true }); req.app.get('io')?.emit('emergency_resolved',{ emergencyId:em._id }); res.json({ success:true,emergency:em }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
app.use('/api/emergency', emR);

const msgR=express.Router();
msgR.get('/conversations', protect, async (req,res) => { try { const ms=await Message.find({ $or:[{ sender:req.user._id },{ recipient:req.user._id }] }).sort({ createdAt:-1 }).populate('sender','name avatar').populate('recipient','name avatar'); const seen=new Set(),convs=[]; for(const m of ms){ const oid=m.sender._id.toString()===req.user._id.toString()?m.recipient._id.toString():m.sender._id.toString(); if(!seen.has(oid)){ seen.add(oid); convs.push({ other:m.sender._id.toString()===req.user._id.toString()?m.recipient:m.sender,lastMessage:m }); } } res.json({ success:true,conversations:convs }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
msgR.get('/:userId', protect, async (req,res) => { try { const ms=await Message.find({ $or:[{ sender:req.user._id,recipient:req.params.userId },{ sender:req.params.userId,recipient:req.user._id }] }).sort({ createdAt:1 }).populate('sender','name avatar'); await Message.updateMany({ sender:req.params.userId,recipient:req.user._id,isRead:false },{ isRead:true }); res.json({ success:true,messages:ms }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
msgR.post('/', protect, async (req,res) => { try { const { recipientId,content }=req.body; if(!recipientId||!content) return res.status(400).json({ success:false,message:'Recipient and content required.' }); const m=await Message.create({ sender:req.user._id,recipient:recipientId,content }); await m.populate('sender','name avatar'); req.app.get('io')?.to(recipientId).emit('new_message',m); res.status(201).json({ success:true,message:m }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
app.use('/api/messages', msgR);

const ntR=express.Router();
ntR.get('/', protect, async (req,res) => { try { const [n,u]=await Promise.all([Notification.find({ recipient:req.user._id }).sort({ createdAt:-1 }).limit(30),Notification.countDocuments({ recipient:req.user._id,isRead:false })]); res.json({ success:true,notifications:n,unreadCount:u }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
ntR.put('/read-all', protect, async (req,res) => { try { await Notification.updateMany({ recipient:req.user._id,isRead:false },{ isRead:true }); res.json({ success:true }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
app.use('/api/notifications', ntR);

const payR=express.Router();
payR.post('/initiate', protect, async (req,res) => { try { const { phone,amount,purpose,metadata }=req.body; const p=await Payment.create({ user:req.user._id,amount,purpose,phone:phone||req.user.phone,metadata,status:'pending' }); setTimeout(async()=>{ try { await Payment.findByIdAndUpdate(p._id,{ status:'completed',mpesaCode:'SANDBOX_'+Date.now() }); if(purpose==='admin_subscription'&&metadata?.category){ await User.findByIdAndUpdate(req.user._id,{ role:'admin',$addToSet:{ adminCategories:metadata.category },'subscription.plan':'admin','subscription.expiresAt':new Date(Date.now()+30*24*60*60*1000) }); } req.app.get('io')?.to(req.user._id.toString()).emit('payment_confirmed',{ paymentId:p._id,purpose,amount }); }catch(e){} },2000); res.json({ success:true,payment:p,message:'Payment initiated.' }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
payR.get('/history', protect, async (req,res) => { try { const p=await Payment.find({ user:req.user._id }).sort({ createdAt:-1 }).limit(20); res.json({ success:true,payments:p }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
payR.get('/pricing', (req,res) => res.json({ success:true,pricing:{ admin:{ jobs:2000,business_directory:3500,skills:1500,stories:1000,donations:800 },jobs:{ featured:500,sponsored:2000 },business:{ basic:500,standard:1200,premium:2000 } }}));
app.use('/api/payments', payR);

const mpR=express.Router();
mpR.get('/overview', optionalAuth, async (req,res) => { try { const [businesses,jobs,emergencies,reports]=await Promise.all([Business.find({ isActive:true }).select('name category location coordinates averageRating plan isVerified').limit(50),Job.find({ status:'active' }).select('title category location pay tier').limit(30),Emergency.find({ status:{ $ne:'resolved' },createdAt:{ $gte:new Date(Date.now()-24*60*60*1000) } }).select('type area coordinates severity status createdAt').limit(20),Report.find({ status:{ $in:['open','in_progress'] } }).select('type location status upvotes createdAt').limit(30)]); let userLocs=[]; if(req.user?.role==='admin'||req.user?.role==='super_admin'){ userLocs=await User.find({ locationUpdatedAt:{ $gte:new Date(Date.now()-60*60*1000) } }).select('name avatar area role location locationUpdatedAt').limit(100); } res.json({ success:true,layers:{ businesses:businesses.map(b=>({ id:b._id,type:'business',name:b.name,category:b.category,location:b.location,rating:b.averageRating,plan:b.plan,verified:b.isVerified })),jobs:jobs.map(j=>({ id:j._id,type:'job',title:j.title,category:j.category,location:j.location,pay:j.pay,tier:j.tier })),emergencies:emergencies.map(e=>({ id:e._id,type:'emergency',emergencyType:e.type,area:e.area,severity:e.severity,status:e.status,createdAt:e.createdAt })),reports:reports.map(r=>({ id:r._id,type:'report',reportType:r.type,location:r.location,status:r.status,upvotes:r.upvotes?.length||0 })),users:userLocs.map(u=>({ id:u._id,type:'user',name:u.name,area:u.area,role:u.role,coordinates:u.location?.coordinates||[],lastSeen:u.locationUpdatedAt })) } }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
mpR.post('/update-location', protect, async (req,res) => { try { const { lat,lng,shareLocation }=req.body; const u={ locationUpdatedAt:new Date() }; if(lat&&lng) u.location={ type:'Point',coordinates:[parseFloat(lng),parseFloat(lat)] }; if(shareLocation!==undefined) u.shareLocation=shareLocation; await User.findByIdAndUpdate(req.user._id,u); res.json({ success:true }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
mpR.get('/admin/all-users', protect, adminOnly, async (req,res) => { try { const u=await User.find({ locationUpdatedAt:{ $exists:true } }).select('name phone avatar area role location locationUpdatedAt isActive isBanned').sort({ locationUpdatedAt:-1 }).limit(200); res.json({ success:true,users:u }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
app.use('/api/maps', mpR);

const adR=express.Router();
adR.get('/dashboard', protect, adminOnly, async (req,res) => { try { const [totalUsers,approvedPosts,pendingPosts,activeJobs,activeBusinesses,revAgg,activeEmergencies,openReports,recentPayments,recentUsers]=await Promise.all([User.countDocuments(),Post.countDocuments({ status:{ $in:['approved','featured'] } }),Post.countDocuments({ status:'pending' }),Job.countDocuments({ status:'active' }),Business.countDocuments({ isActive:true }),Payment.aggregate([{ $match:{ status:'completed' } },{ $group:{ _id:null,total:{ $sum:'$amount' } } }]),Emergency.countDocuments({ status:'active' }),Report.countDocuments({ status:'open' }),Payment.find({ status:'completed' }).sort({ createdAt:-1 }).limit(10).populate('user','name phone'),User.find().sort({ createdAt:-1 }).limit(10).select('name phone area role createdAt')]); res.json({ success:true,stats:{ totalUsers,approvedPosts,pendingPosts,activeJobs,activeBusinesses,revenue:revAgg[0]?.total||0,activeEmergencies,openReports },recentPayments,recentUsers }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
adR.get('/users', protect, adminOnly, async (req,res) => { try { const { page=1,limit=20,search,role }=req.query; const q={}; if(search) q.$or=[{ name:new RegExp(search,'i') },{ phone:new RegExp(search,'i') },{ username:new RegExp(search,'i') }]; if(role) q.role=role; const [users,total]=await Promise.all([User.find(q).sort({ createdAt:-1 }).skip((parseInt(page)-1)*parseInt(limit)).limit(parseInt(limit)),User.countDocuments(q)]); res.json({ success:true,users,total }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
adR.put('/users/:id/ban', protect, adminOnly, async (req,res) => { try { const u=await User.findByIdAndUpdate(req.params.id,{ isBanned:req.body.ban },{ new:true }); res.json({ success:true,user:u }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
adR.put('/users/:id/role', protect, adminOnly, async (req,res) => { try { const u=await User.findByIdAndUpdate(req.params.id,{ role:req.body.role,adminCategories:req.body.adminCategories||[] },{ new:true }); res.json({ success:true,user:u }); } catch(err) { res.status(500).json({ success:false,message:err.message }); }});
app.use('/api/admin', adR);

// ══════════════════════════════════════════════════════════════════
// 404 + ERROR HANDLER
// ══════════════════════════════════════════════════════════════════
app.use((req,res) => res.status(404).json({ success:false, message:`Route ${req.method} ${req.path} not found` }));
app.use((err,req,res,next) => { console.error('Error:', err.message); res.status(err.status||500).json({ success:false, message:err.message||'Server error' }); });

// ══════════════════════════════════════════════════════════════════
// SOCKET.IO EVENTS
// ══════════════════════════════════════════════════════════════════
const online = {};
io.on('connection', socket => {
  socket.on('join', uid => { if(uid){ online[uid]=socket.id; socket.join(uid); io.emit('users_online',Object.keys(online).length); } });
  socket.on('join_admin', () => socket.join('admins'));
  socket.on('emergency_alert', data => io.emit('emergency_broadcast',{ ...data, timestamp:new Date() }));
  socket.on('share_location', data => { if(data.userId){ socket.broadcast.emit('user_location_update',data); socket.to('admins').emit('user_location_update',data); } });
  socket.on('send_message', data => { if(data.recipientId) io.to(data.recipientId).emit('new_message',data); });
  socket.on('disconnect', () => { const uid=Object.keys(online).find(k=>online[k]===socket.id); if(uid) delete online[uid]; io.emit('users_online',Object.keys(online).length); });
});

// ══════════════════════════════════════════════════════════════════
// AUTO-SEED ADMIN ACCOUNT
// ══════════════════════════════════════════════════════════════════
async function seedAdmin() {
  try {
    const existing = await User.findOne({ $or:[{ username:'denis254' },{ phone:'+254000000001' }] });
    if (!existing) {
      // Use new User() + .save() so the pre('save') hook hashes the password ONCE
      const admin = new User({ name:'Denis Admin', username:'denis254', phone:'+254000000001', password:'denodeno254', area:'Nairobi', role:'super_admin', adminCategories:['jobs','stories','businesses','skills','donations','reports'], isVerified:true, isActive:true, isBanned:false });
      await admin.save();
      console.log('✅ Admin created — username: denis254 | password: denodeno254');
    } else {
      // Reset password via .save() so pre('save') hook hashes it correctly
      existing.password = 'denodeno254'; existing.role = 'super_admin';
      existing.adminCategories = ['jobs','stories','businesses','skills','donations','reports'];
      existing.isVerified = true; existing.isActive = true; existing.isBanned = false; existing.username = 'denis254';
      await existing.save();
      console.log('✅ Admin verified — username: denis254 | password: denodeno254');
    }
  } catch(err) { console.warn('⚠️  Admin seed warning:', err.message); }
}

// ══════════════════════════════════════════════════════════════════
// START
// ══════════════════════════════════════════════════════════════════
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Mtaa Connect API on port ${PORT}`);
  console.log(`   Admin: username=denis254 | password=denodeno254`);
  console.log(`   Health check: GET /api/health\n`);
});

module.exports = { app, server };
