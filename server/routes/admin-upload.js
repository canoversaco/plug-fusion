const express = require('express')
const fs = require('fs')
const path = require('path')
const multer = require('multer')

const router = express.Router()

const uploadDir = path.join(__dirname, '..', 'public', 'uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive:true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = (file.originalname||'file').toLowerCase().replace(/[^a-z0-9._-]+/g,'-')
    const ts = Date.now()
    const ext = path.extname(safe) || '.jpg'
    cb(null, `${ts}-${Math.random().toString(36).slice(2)}${ext}`)
  }
})
const upload = multer({ storage })

router.post('/', upload.single('file'), (req, res)=>{
  if (!req.file) return res.status(400).json({ ok:false, error:'no_file' })
  const rel = '/uploads/'+req.file.filename
  res.json({ ok:true, url: rel })
})

module.exports = router
