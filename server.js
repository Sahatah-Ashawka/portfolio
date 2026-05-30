const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const UPLOADS_DIR = path.join(__dirname, "uploads");

const defaultData = {
  profile: {
    name: "Your Name",
    role: "Cybersecurity Student",
    university: "Your University",
    bio: "I break, build, and secure systems while documenting my journey.",
    photo: "",
    gallery: [],
    socials: {
      github: "",
      linkedin: "",
      email: "",
      tryhackme: "",
      cisco: "",
      medium: ""
    }
  },
  aboutPhotos: [],
  posts: [],
  certificates: []
};

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultData, null, 2), "utf-8");
  }
}

function readDb() {
  try {
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return structuredClone(defaultData);
  }
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}

function makeId() {
  return crypto.randomUUID();
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOADS_DIR),
  filename: (_, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({ storage });
const profileUpload = upload.fields([
  { name: "photo", maxCount: 1 },
  { name: "galleryPhotos", maxCount: 20 },
  { name: "galleryPhotos[]", maxCount: 20 }
]);

ensureStorage();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/profile", (_, res) => {
  const db = readDb();
  const profile = {
    ...defaultData.profile,
    ...db.profile,
    gallery: db.profile?.gallery || [],
    socials: {
      ...defaultData.profile.socials,
      ...(db.profile?.socials || {})
    }
  };
  res.json(profile);
});

app.get("/api/about-photos", (_, res) => {
  const db = readDb();

  if (!Array.isArray(db.aboutPhotos)) {
    const legacy = Array.isArray(db.profile?.gallery) ? db.profile.gallery : [];
    db.aboutPhotos = legacy
      .filter(Boolean)
      .map((src) => ({ id: makeId(), src, createdAt: new Date().toISOString() }));
    writeDb(db);
  }

  res.json(db.aboutPhotos);
});

app.post("/api/about-photos", upload.single("image"), (req, res) => {
  const db = readDb();
  const body = req.body || {};
  const src = req.file ? `/uploads/${req.file.filename}` : (body.imageUrl || "").trim();

  if (!src) {
    return res.status(400).json({ message: "Photo is required" });
  }

  if (!Array.isArray(db.aboutPhotos)) db.aboutPhotos = [];

  const photo = {
    id: makeId(),
    src,
    createdAt: new Date().toISOString()
  };

  db.aboutPhotos.push(photo);
  writeDb(db);
  res.status(201).json(photo);
});

app.delete("/api/about-photos/:id", (req, res) => {
  const db = readDb();
  if (!Array.isArray(db.aboutPhotos)) db.aboutPhotos = [];

  const before = db.aboutPhotos.length;
  db.aboutPhotos = db.aboutPhotos.filter((photo) => photo.id !== req.params.id);

  if (before === db.aboutPhotos.length) {
    return res.status(404).json({ message: "Photo not found" });
  }

  writeDb(db);
  res.status(204).end();
});

app.put("/api/profile", (req, res, next) => {
  profileUpload(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        message: "Profile upload failed",
        detail: err.message,
        code: err.code || "UPLOAD_ERROR",
        field: err.field || null
      });
    }
    next();
  });
}, (req, res) => {
  const db = readDb();
  const body = req.body;

  let socials = db.profile.socials;
  if (body.socials) {
    try {
      socials = JSON.parse(body.socials);
    } catch {
      socials = db.profile.socials;
    }
  }

  let gallery = db.profile.gallery || [];
  if (body.gallery) {
    try {
      gallery = JSON.parse(body.gallery);
      if (!Array.isArray(gallery)) gallery = db.profile.gallery || [];
    } catch {
      gallery = db.profile.gallery || [];
    }
  }

  const uploadedGallery = [
    ...(req.files?.galleryPhotos || []),
    ...(req.files?.["galleryPhotos[]"] || [])
  ].map((file) => `/uploads/${file.filename}`);
  gallery = [...gallery.filter(Boolean), ...uploadedGallery];

  const photo = req.files?.photo?.[0]
    ? `/uploads/${req.files.photo[0].filename}`
    : (body.existingPhoto || db.profile.photo || "");

  db.profile = {
    name: body.name || db.profile.name,
    role: body.role || db.profile.role,
    university: body.university || db.profile.university,
    bio: body.bio || db.profile.bio,
    photo,
    gallery,
    socials
  };

  writeDb(db);
  res.json(db.profile);
});

app.get("/api/posts", (_, res) => {
  const db = readDb();
  const posts = [...db.posts].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json(posts);
});

app.post("/api/posts", upload.single("image"), (req, res) => {
  const db = readDb();
  const body = req.body;

  const post = {
    id: makeId(),
    title: body.title || "Untitled",
    tags: body.tags || "",
    content: body.content || "",
    image: req.file ? `/uploads/${req.file.filename}` : (body.imageUrl || ""),
    updatedAt: new Date().toISOString()
  };

  db.posts.unshift(post);
  writeDb(db);
  res.status(201).json(post);
});

app.put("/api/posts/:id", upload.single("image"), (req, res) => {
  const db = readDb();
  const index = db.posts.findIndex((post) => post.id === req.params.id);

  if (index === -1) return res.status(404).json({ message: "Post not found" });

  const body = req.body;
  const current = db.posts[index];

  const updated = {
    ...current,
    title: body.title || current.title,
    tags: body.tags || "",
    content: body.content || current.content,
    image: req.file ? `/uploads/${req.file.filename}` : (body.imageUrl || body.existingImage || current.image || ""),
    updatedAt: new Date().toISOString()
  };

  db.posts[index] = updated;
  writeDb(db);
  res.json(updated);
});

app.delete("/api/posts/:id", (req, res) => {
  const db = readDb();
  const before = db.posts.length;
  db.posts = db.posts.filter((post) => post.id !== req.params.id);

  if (before === db.posts.length) {
    return res.status(404).json({ message: "Post not found" });
  }

  writeDb(db);
  res.status(204).end();
});

app.get("/api/certificates", (_, res) => {
  const db = readDb();
  const certs = [...db.certificates].sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(certs);
});

app.post("/api/certificates", upload.single("image"), (req, res) => {
  const db = readDb();
  const body = req.body;

  const cert = {
    id: makeId(),
    name: body.name || "Unnamed Certificate",
    platform: body.platform || "Other",
    date: body.date || "",
    link: body.link || "",
    image: req.file ? `/uploads/${req.file.filename}` : (body.imageUrl || "")
  };

  db.certificates.unshift(cert);
  writeDb(db);
  res.status(201).json(cert);
});

app.put("/api/certificates/:id", upload.single("image"), (req, res) => {
  const db = readDb();
  const index = db.certificates.findIndex((cert) => cert.id === req.params.id);

  if (index === -1) return res.status(404).json({ message: "Certificate not found" });

  const body = req.body;
  const current = db.certificates[index];

  const updated = {
    ...current,
    name: body.name || current.name,
    platform: body.platform || current.platform,
    date: body.date || current.date,
    link: body.link || "",
    image: req.file ? `/uploads/${req.file.filename}` : (body.imageUrl || body.existingImage || current.image || "")
  };

  db.certificates[index] = updated;
  writeDb(db);
  res.json(updated);
});

app.delete("/api/certificates/:id", (req, res) => {
  const db = readDb();
  const before = db.certificates.length;
  db.certificates = db.certificates.filter((cert) => cert.id !== req.params.id);

  if (before === db.certificates.length) {
    return res.status(404).json({ message: "Certificate not found" });
  }

  writeDb(db);
  res.status(204).end();
});

app.get(/.*/, (_, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Cyber portfolio running on http://localhost:${PORT}`);
});
