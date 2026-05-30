const API = {
  profile: "/api/profile",
  posts: "/api/posts",
  certs: "/api/certificates",
  aboutPhotos: "/api/about-photos"
};

const CERT_INTERVAL_MS = 6000;
const ABOUT_INTERVAL_MS = 4000;

const state = {
  profile: null,
  posts: [],
  certs: [],
  search: "",
  certIndex: 0,
  certTimer: null,
  certProgressTimer: null,
  certProgressStart: 0,
  aboutPhotos: [],
  aboutIndex: 0,
  aboutTimer: null,
  aboutProgressTimer: null,
  aboutProgressStart: 0,
  currentView: "about"
};

const qs = (id) => document.getElementById(id);

const ui = {
  toggleAdmin: qs("toggle-admin"),
  navLinks: document.querySelectorAll(".top-nav a[data-route]"),
  searchInput: qs("search-input"),
  tagList: qs("tag-list"),
  postsList: qs("posts-list"),
  certsList: qs("certs-list"),
  certPrev: qs("cert-prev"),
  certNext: qs("cert-next"),
  certCounter: qs("cert-counter"),
  certProgress: qs("cert-progress"),
  aboutPrev: qs("about-prev"),
  aboutNext: qs("about-next"),
  aboutCounter: qs("about-counter"),
  aboutProgress: qs("about-progress"),
  aboutPhoto: qs("about-photo"),
  aboutPhotoEmpty: qs("about-photo-empty"),
  aboutAddPhoto: qs("about-add-photo"),
  aboutDeletePhoto: qs("about-delete-photo"),
  aboutAddPhotoFile: qs("about-add-photo-file"),

  profilePhoto: qs("profile-photo"),
  profileName: qs("profile-name"),
  profileRole: qs("profile-role"),
  profileUni: qs("profile-uni"),
  profileBio: qs("profile-bio"),
  socialList: qs("social-list"),

  profileDialog: qs("profile-dialog"),
  postDialog: qs("post-dialog"),
  certDialog: qs("cert-dialog"),

  profileForm: qs("profile-form"),
  postForm: qs("post-form"),
  certForm: qs("cert-form"),

  postTemplate: qs("post-template"),
  certTemplate: qs("cert-template"),
  postTitleEditor: qs("p-title-editor"),
  postContentEditor: qs("p-content-editor"),
  postInlineImageFile: qs("p-inline-image-file"),
  editorButtons: document.querySelectorAll("[data-editor-cmd], [data-editor-action]")
};

function getCurrentBlockTag() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return "";
  let node = selection.anchorNode;
  if (!node) return "";
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  if (!node || !ui.postContentEditor.contains(node)) return "";

  const block = node.closest("h1, h2, h3, p, blockquote, li");
  return block ? block.tagName : "";
}

function setToolActiveBySelector(selector, isActive) {
  const btn = document.querySelector(selector);
  if (btn) btn.classList.toggle("active", Boolean(isActive));
}

function updateEditorToolbarState() {
  const blockTag = getCurrentBlockTag();
  const isH1 = blockTag === "H1";
  const isH2 = blockTag === "H2";
  const isCode = blockTag === "PRE";

  setToolActiveBySelector('[data-editor-cmd="formatBlock"][data-editor-value="H1"]', isH1);
  setToolActiveBySelector('[data-editor-cmd="formatBlock"][data-editor-value="H2"]', isH2);
  setToolActiveBySelector('[data-editor-action="code"]', isCode);

  setToolActiveBySelector('[data-editor-cmd="bold"]', document.queryCommandState("bold"));
  setToolActiveBySelector('[data-editor-cmd="italic"]', document.queryCommandState("italic"));
  setToolActiveBySelector('[data-editor-cmd="insertUnorderedList"]', document.queryCommandState("insertUnorderedList"));
}

function escapeHtml(text = "") {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function decorateCodeBlocks(root) {
  const codeBlocks = root.querySelectorAll("pre");
  codeBlocks.forEach((pre) => {
    if (pre.parentElement?.classList.contains("code-block")) return;
    const wrapper = document.createElement("div");
    wrapper.className = "code-block";
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "copy-code-btn";
    copy.textContent = "Copy";
    copy.addEventListener("click", async () => {
      const text = pre.innerText || "";
      try {
        await navigator.clipboard.writeText(text);
        copy.textContent = "Copied";
        setTimeout(() => {
          copy.textContent = "Copy";
        }, 1200);
      } catch {
        copy.textContent = "Failed";
        setTimeout(() => {
          copy.textContent = "Copy";
        }, 1200);
      }
    });

    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.append(copy, pre);
  });
}

async function request(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const payload = await res.json();
      detail = payload?.detail || payload?.message || detail;
    } catch {
      // Ignore parse errors and keep default status message.
    }
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

function normalizePath(path) {
  if (!path) return "/about";
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

function getViewFromPath(path) {
  const normalized = normalizePath(path);
  if (normalized === "/" || normalized === "/about") return "about";
  if (normalized === "/blogs") return "blogs";
  if (normalized === "/certificates") return "certificates";
  return "about";
}

function setActiveNav(path) {
  const normalized = normalizePath(path);
  ui.navLinks.forEach((link) => {
    const route = link.dataset.route;
    link.classList.toggle("active", route === normalized);
  });
}

function stopCertAutoplay() {
  clearInterval(state.certTimer);
  clearInterval(state.certProgressTimer);
  state.certTimer = null;
  state.certProgressTimer = null;
  state.certProgressStart = 0;
}

function setCertProgress(percent) {
  ui.certProgress.style.width = `${Math.max(0, Math.min(100, percent))}%`;
}

function restartCertAutoplay() {
  stopCertAutoplay();
  setCertProgress(0);

  if (state.currentView !== "certificates" || state.certs.length <= 1) return;

  state.certProgressStart = Date.now();

  state.certProgressTimer = setInterval(() => {
    const elapsed = Date.now() - state.certProgressStart;
    const percent = (elapsed / CERT_INTERVAL_MS) * 100;
    setCertProgress(percent);
  }, 120);

  state.certTimer = setInterval(() => {
    state.certIndex = (state.certIndex + 1) % state.certs.length;
    renderCertificates();
    state.certProgressStart = Date.now();
    setCertProgress(0);
  }, CERT_INTERVAL_MS);
}

function getAboutPhotos() {
  return state.aboutPhotos;
}

function stopAboutAutoplay() {
  clearInterval(state.aboutTimer);
  clearInterval(state.aboutProgressTimer);
  state.aboutTimer = null;
  state.aboutProgressTimer = null;
  state.aboutProgressStart = 0;
}

function setAboutProgress(percent) {
  ui.aboutProgress.style.width = `${Math.max(0, Math.min(100, percent))}%`;
}

function restartAboutAutoplay() {
  stopAboutAutoplay();
  setAboutProgress(0);

  const photos = getAboutPhotos();
  if (state.currentView !== "about" || photos.length <= 1) return;

  state.aboutProgressStart = Date.now();

  state.aboutProgressTimer = setInterval(() => {
    const elapsed = Date.now() - state.aboutProgressStart;
    const percent = (elapsed / ABOUT_INTERVAL_MS) * 100;
    setAboutProgress(percent);
  }, 120);

  state.aboutTimer = setInterval(() => {
    state.aboutIndex = (state.aboutIndex + 1) % photos.length;
    renderAboutCarousel();
    state.aboutProgressStart = Date.now();
    setAboutProgress(0);
  }, ABOUT_INTERVAL_MS);
}

function applyView(view) {
  state.currentView = view;
  document.body.classList.remove("view-about", "view-blogs", "view-certificates");
  document.body.classList.add(`view-${view}`);

  if (view === "certificates") {
    restartCertAutoplay();
  } else {
    stopCertAutoplay();
    setCertProgress(0);
  }

  if (view === "about") {
    restartAboutAutoplay();
  } else {
    stopAboutAutoplay();
    setAboutProgress(0);
  }
}

function navigate(path, push = true) {
  const normalized = normalizePath(path);
  const view = getViewFromPath(normalized);

  if (push && normalizePath(location.pathname) !== normalized) {
    history.pushState({}, "", normalized);
  }

  setActiveNav(normalized);
  applyView(view);
}

async function loadAll() {
  const [profile, posts, certs, aboutPhotosData] = await Promise.all([
    request(API.profile),
    request(API.posts),
    request(API.certs),
    request(API.aboutPhotos)
  ]);

  state.profile = profile;
  state.posts = posts;
  state.certs = certs;
  state.aboutPhotos = Array.isArray(aboutPhotosData) ? aboutPhotosData.filter(Boolean) : [];

  if (state.certIndex >= state.certs.length) {
    state.certIndex = 0;
  }

  const aboutPhotos = getAboutPhotos();
  if (state.aboutIndex >= aboutPhotos.length) {
    state.aboutIndex = 0;
  }

  renderProfile();
  renderPosts();
  renderCertificates();
  renderTags();

  navigate(location.pathname, false);
}

function renderProfile() {
  const p = state.profile;
  ui.profilePhoto.src = p.photo || "https://placehold.co/200x200/ffffff/c10e86?text=YOU";
  ui.profileName.textContent = p.name;
  ui.profileRole.textContent = p.role;
  ui.profileUni.textContent = p.university;
  ui.profileBio.textContent = p.bio;

  renderAboutCarousel();

  ui.socialList.innerHTML = "";
  Object.entries(p.socials || {}).forEach(([key, value]) => {
    if (!value) return;
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = key === "email" ? `mailto:${value}` : value;
    a.textContent = key.toUpperCase();
    a.target = key === "email" ? "_self" : "_blank";
    if (key !== "email") a.rel = "noreferrer noopener";
    li.append(a);
    ui.socialList.append(li);
  });
}

function renderAboutCarousel() {
  const photos = getAboutPhotos();

  if (!photos.length) {
    ui.aboutCounter.textContent = "0 / 0";
    ui.aboutPhoto.hidden = true;
    ui.aboutPhotoEmpty.hidden = false;
    setAboutProgress(0);
    return;
  }

  ui.aboutCounter.textContent = `${state.aboutIndex + 1} / ${photos.length}`;
  const current = photos[state.aboutIndex];
  ui.aboutPhoto.src = current?.src || "";
  ui.aboutPhoto.hidden = false;
  ui.aboutPhotoEmpty.hidden = true;
}

async function createAboutPhoto(payload) {
  await request(API.aboutPhotos, { method: "POST", body: payload });
  await loadAll();
}

async function deleteAboutPhoto(id) {
  await request(`${API.aboutPhotos}/${id}`, { method: "DELETE" });
  await loadAll();
}

function openAboutPhotoPicker() {
  ui.aboutAddPhotoFile.value = "";
  try {
    if (typeof ui.aboutAddPhotoFile.showPicker === "function") {
      ui.aboutAddPhotoFile.showPicker();
      return;
    }
  } catch {
    // Fall through to click() fallback.
  }
  ui.aboutAddPhotoFile.click();
}

function formatDate(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function toTagArray(tagsText = "") {
  return tagsText
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function isPdfSource(url = "") {
  const normalized = String(url).trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.startsWith("data:application/pdf")) return true;
  const clean = normalized.split("#")[0].split("?")[0];
  return clean.endsWith(".pdf");
}

async function renderPdfToCanvas(url, canvas) {
  if (!window.pdfjsLib || !canvas) return false;
  try {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }

    const task = pdfjsLib.getDocument(url);
    const pdf = await task.promise;
    const page = await pdf.getPage(1);

    const maxWidth = Math.min(980, canvas.parentElement?.clientWidth || 980);
    const maxHeight = 460;
    const base = page.getViewport({ scale: 1 });
    const cssScale = Math.min(maxWidth / base.width, maxHeight / base.height);
    const displayViewport = page.getViewport({ scale: cssScale });
    const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    const renderViewport = page.getViewport({ scale: cssScale * pixelRatio });

    const ctx = canvas.getContext("2d");
    canvas.width = Math.floor(renderViewport.width);
    canvas.height = Math.floor(renderViewport.height);
    canvas.style.width = `${Math.floor(displayViewport.width)}px`;
    canvas.style.height = `${Math.floor(displayViewport.height)}px`;

    await page.render({ canvasContext: ctx, viewport: renderViewport }).promise;
    return true;
  } catch (err) {
    console.error("PDF preview render failed:", err);
    return false;
  }
}

function renderPosts() {
  ui.postsList.innerHTML = "";
  const search = state.search.toLowerCase().trim().replace(/^#/, "");

  const filtered = state.posts.filter((post) => {
    if (!search) return true;
    const tags = toTagArray(post.tags).map((tag) => tag.toLowerCase());
    return tags.some((tag) => tag.includes(search));
  });

  filtered.forEach((post) => {
    const node = ui.postTemplate.content.firstElementChild.cloneNode(true);
    const img = node.querySelector(".entry-image");
    if (post.image) {
      img.hidden = false;
      img.src = post.image;
    }

    node.querySelector(".entry-title").textContent = post.title;
    node.querySelector(".entry-date").textContent = formatDate(post.updatedAt);
    node.querySelector(".entry-content").innerHTML = post.content;
    decorateCodeBlocks(node.querySelector(".entry-content"));

    const chips = node.querySelector(".chips");
    toTagArray(post.tags).forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = `#${tag}`;
      chips.append(chip);
    });

    node.querySelector(".edit").addEventListener("click", () => openPostDialog(post));
    node.querySelector(".delete").addEventListener("click", async () => {
      if (!confirm("Delete this post?")) return;
      await request(`${API.posts}/${post.id}`, { method: "DELETE" });
      await loadAll();
    });

    ui.postsList.append(node);
  });

  if (!filtered.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "No posts found.";
    ui.postsList.append(p);
  }
}

function renderCertificates() {
  ui.certsList.innerHTML = "";

  if (!state.certs.length) {
    ui.certCounter.textContent = "0 / 0";
    setCertProgress(0);
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "No certificates yet.";
    ui.certsList.append(p);
    return;
  }

  const cert = state.certs[state.certIndex];
  ui.certCounter.textContent = `${state.certIndex + 1} / ${state.certs.length}`;

  const node = ui.certTemplate.content.firstElementChild.cloneNode(true);
  const img = node.querySelector(".entry-image");
  const pdfCanvas = node.querySelector(".cert-pdf-canvas");
  if (cert.image) {
    if (isPdfSource(cert.image)) {
      img.hidden = true;
      pdfCanvas.hidden = false;
      renderPdfToCanvas(cert.image, pdfCanvas).then((ok) => {
        if (!ok) {
          pdfCanvas.hidden = true;
        }
      });
    } else {
      pdfCanvas.hidden = true;
      img.hidden = false;
      img.src = cert.image;
      img.classList.add("cert-image");
    }
  } else {
    img.hidden = true;
    pdfCanvas.hidden = true;
  }

  const link = node.querySelector(".entry-link");
  const platform = node.querySelector(".cert-platform");
  platform.textContent = `Platform: ${cert.platform}`;
  if (cert.link || isPdfSource(cert.image)) {
    link.href = cert.link || cert.image;
    link.textContent = cert.link ? "View Credential" : "Open PDF";
  } else {
    link.remove();
  }

  node.querySelector(".edit").addEventListener("click", () => openCertDialog(cert));
  node.querySelector(".delete").addEventListener("click", async () => {
    if (!confirm("Delete this certificate?")) return;
    await request(`${API.certs}/${cert.id}`, { method: "DELETE" });
    if (state.certIndex > 0) state.certIndex -= 1;
    await loadAll();
  });

  ui.certsList.append(node);
}

function renderTags() {
  const counts = new Map();

  state.posts.forEach((post) => {
    toTagArray(post.tags).forEach((tag) => {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    });
  });

  ui.tagList.innerHTML = "";
  if (!counts.size) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "No tags yet.";
    ui.tagList.append(p);
    return;
  }

  [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([tag, count]) => {
      const span = document.createElement("span");
      span.className = "chip";
      span.textContent = `#${tag} (${count})`;
      ui.tagList.append(span);
    });
}

function showDialog(dialog) {
  dialog.showModal();
}

function closeDialogs() {
  [ui.profileDialog, ui.postDialog, ui.certDialog].forEach((d) => d.close());
}

function openProfileDialog() {
  const p = state.profile;
  qs("f-name").value = p.name || "";
  qs("f-role").value = p.role || "";
  qs("f-uni").value = p.university || "";
  qs("f-bio").value = p.bio || "";
  qs("f-photo-url").value = p.photo?.startsWith("/uploads/") ? "" : (p.photo || "");
  qs("profile-existing-photo").value = p.photo || "";
  qs("f-photo-file").value = "";

  qs("f-github").value = p.socials?.github || "";
  qs("f-linkedin").value = p.socials?.linkedin || "";
  qs("f-email").value = p.socials?.email || "";
  qs("f-tryhackme").value = p.socials?.tryhackme || "";
  qs("f-cisco").value = p.socials?.cisco || "";
  qs("f-medium").value = p.socials?.medium || "";

  showDialog(ui.profileDialog);
}

function openPostDialog(post = null) {
  qs("post-id").value = post?.id || "";
  qs("p-tags").value = post?.tags || "";
  qs("post-existing-image").value = post?.image || "";
  ui.postInlineImageFile.value = "";
  ui.postTitleEditor.innerText = post?.title || "";
  ui.postContentEditor.innerHTML = post?.content || "";
  updateEditorToolbarState();
  showDialog(ui.postDialog);
}

function extractFirstImageFromHtml(html) {
  const box = document.createElement("div");
  box.innerHTML = html;
  const firstImage = box.querySelector("img");
  return firstImage?.getAttribute("src") || "";
}

function openCertDialog(cert = null) {
  qs("cert-id").value = cert?.id || "";
  qs("c-name").value = cert?.name || "";
  qs("c-platform").value = cert?.platform || "";
  qs("c-date").value = cert?.date || "";
  qs("c-link").value = cert?.link || "";
  qs("c-image-url").value = cert?.image && !cert.image.startsWith("/uploads/") ? cert.image : "";
  qs("cert-existing-image").value = cert?.image || "";
  qs("c-image-file").value = "";
  showDialog(ui.certDialog);
}

ui.navLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    navigate(link.dataset.route, true);
  });
});

window.addEventListener("popstate", () => {
  navigate(location.pathname, false);
});

ui.toggleAdmin.addEventListener("click", () => {
  document.body.classList.toggle("admin");
  ui.toggleAdmin.textContent = document.body.classList.contains("admin") ? "Exit Admin" : "Admin Mode";
});

ui.searchInput.addEventListener("input", (e) => {
  state.search = e.target.value;
  renderPosts();
});

ui.certPrev.addEventListener("click", () => {
  if (!state.certs.length) return;
  state.certIndex = (state.certIndex - 1 + state.certs.length) % state.certs.length;
  renderCertificates();
  restartCertAutoplay();
});

ui.certNext.addEventListener("click", () => {
  if (!state.certs.length) return;
  state.certIndex = (state.certIndex + 1) % state.certs.length;
  renderCertificates();
  restartCertAutoplay();
});

ui.aboutPrev.addEventListener("click", () => {
  const photos = getAboutPhotos();
  if (!photos.length) return;
  state.aboutIndex = (state.aboutIndex - 1 + photos.length) % photos.length;
  renderAboutCarousel();
  restartAboutAutoplay();
});

ui.aboutNext.addEventListener("click", () => {
  const photos = getAboutPhotos();
  if (!photos.length) return;
  state.aboutIndex = (state.aboutIndex + 1) % photos.length;
  renderAboutCarousel();
  restartAboutAutoplay();
});

ui.aboutAddPhoto.addEventListener("click", async () => {
  const url = prompt("Paste image URL for a new photo.\nLeave empty and press OK to choose from your device.");
  if (url === null) return;
  if (url && url.trim()) {
    try {
      const fd = new FormData();
      fd.append("imageUrl", url.trim());
      await createAboutPhoto(fd);
    } catch (err) {
      console.error(err);
      alert("Could not add image URL. Please check the URL and try again.");
    }
    return;
  }
  openAboutPhotoPicker();
});

ui.aboutAddPhotoFile.addEventListener("change", async () => {
  const file = ui.aboutAddPhotoFile.files[0];
  if (!file) return;
  try {
    const fd = new FormData();
    fd.append("image", file);
    await createAboutPhoto(fd);
  } catch (err) {
    console.error(err);
    alert("Could not upload the selected photo. Please try again.");
  } finally {
    ui.aboutAddPhotoFile.value = "";
  }
});

ui.aboutDeletePhoto.addEventListener("click", async () => {
  const photos = getAboutPhotos();
  if (!photos.length) {
    alert("No gallery photo to delete. Add photos first with + Add Photo.");
    return;
  }
  const removeIndex = Math.min(state.aboutIndex, photos.length - 1);
  const target = photos[removeIndex];
  if (!target?.id) return;
  await deleteAboutPhoto(target.id);
  if (state.aboutIndex > 0 && state.aboutIndex >= getAboutPhotos().length) {
    state.aboutIndex -= 1;
  }
  renderAboutCarousel();
  restartAboutAutoplay();
});

ui.editorButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    ui.postContentEditor.focus();
    const cmd = btn.dataset.editorCmd;
    const value = btn.dataset.editorValue || undefined;
    const action = btn.dataset.editorAction;

    if (action === "code") {
      const selection = window.getSelection();
      const selected = selection ? selection.toString() : "";
      const codeText = selected || "your code here";
      const html = `<pre><code>${escapeHtml(codeText)}</code></pre><p><br></p>`;
      document.execCommand("insertHTML", false, html);
      updateEditorToolbarState();
      return;
    }

    if (action === "link") {
      const url = prompt("Paste URL");
      if (url && url.trim()) {
        document.execCommand("createLink", false, url.trim());
      }
      updateEditorToolbarState();
      return;
    }

    if (action === "image") {
      const imageUrl = prompt("Paste image URL. Leave empty to upload from your device.");
      if (imageUrl === null) return;
      if (imageUrl && imageUrl.trim()) {
        document.execCommand("insertImage", false, imageUrl.trim());
        updateEditorToolbarState();
        return;
      }
      ui.postInlineImageFile.click();
      return;
    }

    if (cmd === "formatBlock") {
      const isActive = btn.classList.contains("active");
      document.execCommand("formatBlock", false, isActive ? "P" : value);
      updateEditorToolbarState();
      return;
    }

    if (cmd) {
      document.execCommand(cmd, false, value);
      updateEditorToolbarState();
    }
  });
});

ui.postInlineImageFile.addEventListener("change", () => {
  const file = ui.postInlineImageFile.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    ui.postContentEditor.focus();
    document.execCommand("insertImage", false, String(reader.result));
    ui.postInlineImageFile.value = "";
    updateEditorToolbarState();
  };
  reader.readAsDataURL(file);
});

ui.postContentEditor.addEventListener("keyup", updateEditorToolbarState);
ui.postContentEditor.addEventListener("mouseup", updateEditorToolbarState);
document.addEventListener("selectionchange", () => {
  if (ui.postDialog.open) updateEditorToolbarState();
});

qs("new-post").addEventListener("click", () => openPostDialog());
qs("new-cert").addEventListener("click", () => openCertDialog());
qs("edit-profile").addEventListener("click", openProfileDialog);

document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", closeDialogs);
});

ui.profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData();
  fd.append("name", qs("f-name").value.trim());
  fd.append("role", qs("f-role").value.trim());
  fd.append("university", qs("f-uni").value.trim());
  fd.append("bio", qs("f-bio").value.trim());

  const photoFile = qs("f-photo-file").files[0];
  if (photoFile) fd.append("photo", photoFile);
  else fd.append("existingPhoto", qs("f-photo-url").value.trim() || qs("profile-existing-photo").value.trim());

  const socials = {
    github: qs("f-github").value.trim(),
    linkedin: qs("f-linkedin").value.trim(),
    email: qs("f-email").value.trim(),
    tryhackme: qs("f-tryhackme").value.trim(),
    cisco: qs("f-cisco").value.trim(),
    medium: qs("f-medium").value.trim()
  };

  fd.append("socials", JSON.stringify(socials));

  await request(API.profile, { method: "PUT", body: fd });
  closeDialogs();
  await loadAll();
});

ui.postForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = qs("post-id").value;
  const fd = new FormData();
  const title = ui.postTitleEditor.innerText.trim();
  const contentHtml = ui.postContentEditor.innerHTML.trim();
  const contentText = ui.postContentEditor.innerText.trim();

  if (!title) {
    alert("Please add a title.");
    return;
  }

  if (!contentText) {
    alert("Please write your story content.");
    return;
  }

  fd.append("title", title);
  fd.append("tags", qs("p-tags").value.trim());
  fd.append("content", contentHtml);
  fd.append("imageUrl", extractFirstImageFromHtml(contentHtml));
  fd.append("existingImage", qs("post-existing-image").value.trim());

  if (id) {
    await request(`${API.posts}/${id}`, { method: "PUT", body: fd });
  } else {
    await request(API.posts, { method: "POST", body: fd });
  }

  closeDialogs();
  await loadAll();
});

ui.certForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = qs("cert-id").value;
  const fd = new FormData();

  fd.append("name", qs("c-name").value.trim());
  fd.append("platform", qs("c-platform").value.trim());
  fd.append("date", qs("c-date").value);
  fd.append("link", qs("c-link").value.trim());
  fd.append("imageUrl", qs("c-image-url").value.trim());
  fd.append("existingImage", qs("cert-existing-image").value.trim());

  const file = qs("c-image-file").files[0];
  if (file) fd.append("image", file);

  if (id) {
    await request(`${API.certs}/${id}`, { method: "PUT", body: fd });
  } else {
    await request(API.certs, { method: "POST", body: fd });
  }

  closeDialogs();
  await loadAll();
});

if (normalizePath(location.pathname) === "/") {
  history.replaceState({}, "", "/about");
}

loadAll().catch((err) => {
  console.error(err);
  alert("Failed to load platform data. Check server logs.");
});

