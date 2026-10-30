// Work carousel
// Desktop: pinned horizontal scroll. Vertical scrolling moves the cards
//          sideways until the last card arrives, then the page continues.
// Tablet, phone, reduced motion: native swipe/drag carousel.

const pin = document.querySelector(".work-pin");
const sticky = document.querySelector(".work-sticky");
const track = document.querySelector(".work");
const root = document.documentElement;
const pinQuery = window.matchMedia("(min-width: 1101px) and (prefers-reduced-motion: no-preference)");

// Only on pages with the work carousel (Home).
if (track) {
  // ---------- pinned mode ----------
  let travel = 0;     // horizontal distance the track moves, in px
  let target = 0;     // where scroll says the track should be
  let current = 0;    // where the track is drawn (eased towards target)
  let rafId = null;

  function measure() {
    // Travel = how far the last card's right edge sits past the right margin.
    const last = track.lastElementChild;
    const margin = parseFloat(getComputedStyle(track).paddingRight);
    travel = Math.max(0, last.offsetLeft + last.offsetWidth + margin - sticky.clientWidth);
    pin.style.height = `${window.innerHeight + travel}px`;
    update();
  }

  function update() {
    const start = pin.getBoundingClientRect().top + window.scrollY;
    const progress = Math.min(1, Math.max(0, (window.scrollY - start) / (travel || 1)));
    target = progress * travel;
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  function tick() {
    // Light easing so trackpad and wheel input feel smooth, settling exactly on target.
    current += (target - current) * 0.2;
    if (Math.abs(target - current) < 0.5) current = target;
    track.style.transform = `translate3d(${-current}px, 0, 0)`;
    rafId = current === target ? null : requestAnimationFrame(tick);
  }

  function enablePin() {
    root.classList.add("is-pinned");
    track.scrollLeft = 0;
    measure();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", measure);
    // Cards that load later can change the track width.
    track.querySelectorAll("img").forEach((img) => img.complete || img.addEventListener("load", measure, { once: true }));
  }

  function disablePin() {
    root.classList.remove("is-pinned");
    window.removeEventListener("scroll", update);
    window.removeEventListener("resize", measure);
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    current = target = 0;
    pin.style.height = "";
    track.style.transform = "";
  }

  const setMode = () => (pinQuery.matches ? enablePin() : disablePin());
  pinQuery.addEventListener("change", setMode);
  setMode();

  // ---------- native carousel: mouse drag ----------
  // Capture the pointer only once a drag starts, so a plain click still
  // reaches the card's link; a click that ends a drag is swallowed.
  let startX = 0;
  let startScroll = 0;
  let pressing = false;
  let moved = false;
  let justDragged = false;

  track.addEventListener("pointerdown", (e) => {
    if (root.classList.contains("is-pinned") || e.pointerType !== "mouse" || e.button !== 0) return;
    startX = e.clientX;
    startScroll = track.scrollLeft;
    pressing = true;
    moved = false;
  });

  track.addEventListener("pointermove", (e) => {
    if (!pressing) return;
    const dx = e.clientX - startX;
    if (!moved && Math.abs(dx) > 4) {
      moved = true;
      try { track.setPointerCapture(e.pointerId); } catch {}
      track.classList.add("is-dragging");
    }
    if (moved) track.scrollLeft = startScroll - dx;
  });

  const endDrag = (e) => {
    if (!pressing) return;
    pressing = false;
    if (track.hasPointerCapture(e.pointerId)) track.releasePointerCapture(e.pointerId);
    if (!moved) return;
    justDragged = true;
    setTimeout(() => { justDragged = false; }, 0);
    track.classList.remove("is-dragging");
    const step = cardStep();
    track.scrollTo({ left: Math.round(track.scrollLeft / step) * step, behavior: "smooth" });
  };
  track.addEventListener("pointerup", endDrag);
  track.addEventListener("pointercancel", endDrag);
  track.addEventListener("click", (e) => {
    if (justDragged) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  // ---------- keyboard: arrows move one card ----------
  function cardStep() {
    const card = track.querySelector(".card");
    return card.offsetWidth + parseFloat(getComputedStyle(track).columnGap || 0);
  }

  track.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    // Pinned: horizontal travel maps 1:1 to vertical scroll, so scroll the page.
    if (root.classList.contains("is-pinned")) window.scrollBy({ top: dir * cardStep(), behavior: "smooth" });
    else track.scrollBy({ left: dir * cardStep(), behavior: "smooth" });
  });
}

// ---------- nav over the work carousel: always the small version ----------
const nav = document.querySelector(".nav");

if (nav && track) {
  let queued = false;
  const updateNav = () => {
    queued = false;
    const n = nav.getBoundingClientRect();
    const w = track.getBoundingClientRect();
    // Cards overlap the nav's band (with a little breathing room) → compact.
    const overlap = w.top < n.bottom + 24 && w.bottom > n.top - 24;
    nav.classList.toggle("is-over-work", overlap);
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(updateNav); } };
  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", queue);
  updateNav();
}

// ---------- compact nav: shrink while scrolling down, restore on scroll up ----------
// Only once the nav has stuck (it stays full size near the top of the page).
// Hover and keyboard focus restore it in CSS.
if (nav) {
  let lastY = window.scrollY;
  let ticking = false;
  const STICK_AT = 64;   // past the point where the nav sticks (73 → 32px)
  const NUDGE = 6;       // ignore tiny scroll jitter

  const onScroll = () => {
    ticking = false;
    const y = window.scrollY;
    const dy = y - lastY;
    if (y < STICK_AT) nav.classList.remove("is-compact");
    else if (dy > NUDGE) nav.classList.add("is-compact");
    else if (dy < -NUDGE) nav.classList.remove("is-compact");
    if (Math.abs(dy) > NUDGE || y < STICK_AT) lastY = y;
  };
  window.addEventListener("scroll", () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
}

// ---------- hover badge ----------
// One grey circle that follows the mouse over anything with data-icon
// (project cards, Notes and Contact links), offset up and to the right.
const badge = document.querySelector(".hover-badge");

if (badge) {
  let pointer = null; // last known mouse position
  let scrollTimer = null;

  // Position follows the pointer on a light spring: a touch of lag and a small
  // overshoot. Snaps into place when it first appears; instant with reduced motion.
  const springy = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const STIFFNESS = 0.14, DAMPING = 0.62;   // per frame: ~130ms to catch up, ~4% overshoot
  const pos = { x: 0, y: 0 }, vel = { x: 0, y: 0 }, target = { x: 0, y: 0 };
  let raf = null;
  const render = () => {
    badge.style.setProperty("--x", `${pos.x}px`);
    badge.style.setProperty("--y", `${pos.y}px`);
  };
  const step = () => {
    for (const k of ["x", "y"]) {
      vel[k] = (vel[k] + (target[k] - pos[k]) * STIFFNESS) * DAMPING;
      pos[k] += vel[k];
    }
    render();
    const moving = Math.abs(vel.x) + Math.abs(vel.y) > 0.05 || Math.abs(target.x - pos.x) + Math.abs(target.y - pos.y) > 0.1;
    raf = moving ? requestAnimationFrame(step) : null;
  };
  const place = (x, y) => {
    target.x = x; target.y = y;
    if (!springy || !badge.classList.contains("is-visible")) {
      pos.x = x; pos.y = y; vel.x = vel.y = 0; render();   // appear exactly at the pointer
      return;
    }
    if (!raf) raf = requestAnimationFrame(step);
  };
  const show = (el) => {
    badge.dataset.icon = el.dataset.icon;
    if (el.dataset.brand) badge.dataset.brand = el.dataset.brand;
    else delete badge.dataset.brand;
    badge.classList.add("is-visible");
  };
  const hide = () => badge.classList.remove("is-visible");

  // Show or hide based on what is under the given point.
  const check = (x, y, target = document.elementFromPoint(x, y)) => {
    const el = target && target.closest("[data-icon]");
    if (el && !document.querySelector(".work.is-dragging")) {
      place(x, y);
      show(el);
    } else {
      hide();
    }
  };

  document.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    pointer = { x: e.clientX, y: e.clientY };
    check(pointer.x, pointer.y, e.target);
  });
  document.documentElement.addEventListener("pointerleave", hide);

  // Scrolling moves content under a still pointer (and the pinned carousel
  // slides cards sideways), so re-check once scrolling settles.
  window.addEventListener("scroll", () => {
    if (!pointer) return;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => check(pointer.x, pointer.y), 60);
  }, { passive: true });

  // Keyboard: anchor the badge to the end of the focused link.
  document.querySelectorAll(".hover-link, .case-nav__link").forEach((link) => {
    link.addEventListener("focus", () => {
      if (!link.matches(":focus-visible")) return;
      const r = link.getBoundingClientRect();
      place(r.right, r.top + r.height / 2);
      show(link);
    });
    link.addEventListener("blur", hide);
  });
}

// ---------- notes: sticky-note pop-up ----------
// One shared panel, filled from <template data-note="…">. Desktop: it floats
// beside the list. Tablet and phone: it moves into the tapped <li> and expands inline.
const notePanel = document.getElementById("note-panel");

if (notePanel) {
  const noteBody = notePanel.querySelector(".note__body");
  const noteHome = notePanel.parentElement;          // where it lives on desktop
  const noteMarker = document.createComment("note-panel");
  noteHome.insertBefore(noteMarker, notePanel);
  const triggers = [...document.querySelectorAll(".note-trigger")];
  const inlineQuery = window.matchMedia("(max-width: 1100px)");
  let active = null;                                  // trigger of the open note

  const place = () => {
    if (inlineQuery.matches && active) active.closest("li").append(notePanel);
    else noteMarker.after(notePanel);
  };

  const openNote = (trigger) => {
    const tpl = document.querySelector(`template[data-note="${trigger.dataset.note}"]`);
    if (!tpl) return;
    const wasOpen = !notePanel.hidden;
    noteBody.replaceChildren(tpl.content.cloneNode(true));
    notePanel.setAttribute("aria-label", trigger.textContent.trim());
    notePanel.dataset.note = trigger.dataset.note;      // drives the note colour
    triggers.forEach((t) => t.setAttribute("aria-expanded", String(t === trigger)));
    active = trigger;
    place();
    notePanel.hidden = false;
    if (!wasOpen) {
      // Entrance only on first open; switching notes swaps content in place.
      notePanel.classList.remove("is-entering");
      void notePanel.offsetWidth;
      notePanel.classList.add("is-entering");
    }
    notePanel.focus({ preventScroll: true });
  };

  const closeNote = ({ restoreFocus = true } = {}) => {
    if (notePanel.hidden) return;
    notePanel.hidden = true;
    notePanel.classList.remove("is-entering");
    triggers.forEach((t) => t.setAttribute("aria-expanded", "false"));
    const opener = active;
    active = null;
    place();
    if (restoreFocus && opener) opener.focus({ preventScroll: true });
  };

  triggers.forEach((t) => t.addEventListener("click", () => {
    if (active === t) closeNote();
    else openNote(t);
  }));
  notePanel.querySelector(".note__close").addEventListener("click", () => closeNote());
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeNote(); });
  document.addEventListener("pointerdown", (e) => {
    if (notePanel.hidden) return;
    if (notePanel.contains(e.target) || e.target.closest(".note-trigger")) return;
    closeNote({ restoreFocus: false });
  });
  inlineQuery.addEventListener("change", place);
}

// ---------- reveal once: [data-reveal] content fades in on first view ----------
// Hidden only when JS runs (so it never stays hidden without it); never replays.
if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.remove("reveal-wait");
      revealIO.unobserve(e.target);
    });
  }, { threshold: 0.45 });
  document.querySelectorAll("[data-reveal]").forEach((el) => {
    el.classList.add("reveal-wait");
    revealIO.observe(el);
  });
}

// ---------- fade up: page sections rise gently into place the first time they're seen ----------
// Same motion language as [data-reveal] above. Hidden only when JS runs; never replays;
// skipped with reduced motion. Items that arrive together follow each other 70ms apart.
if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
  const targets = document.querySelectorAll([
    ".intro p", ".page-intro", ".case-hero", ".work-pin", ".bio p",
    ".blocks .block", ".side-project__card", ".case-media > *", ".case-nav", ".footer__photo",
  ].join(","));
  const fadeIO = new IntersectionObserver((entries) => {
    let i = 0;
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.style.setProperty("--fade-delay", `${i++ * 70}ms`);
      e.target.classList.add("is-shown");
      fadeIO.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -6% 0px" });
  targets.forEach((el) => { el.classList.add("fade-up"); fadeIO.observe(el); });
}

// ---------- card tags (Quiet Table): the outline bumps once as the tag comes into view ----------
// Starts as the tag comes into view. Never replays.
if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
  const tagIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("tag-on");
      tagIO.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(".qt-tags").forEach((g) => {
    g.querySelectorAll(".qt-tag").forEach((t, i) => t.style.setProperty("--tag-i", i));
    tagIO.observe(g);
  });
}

// ---------- Quiet Table focus lens: start the sequence on first view, pause it off screen ----------
if ("IntersectionObserver" in window) {
  const focusIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) e.target.classList.add("is-on");
      e.target.classList.toggle("is-playing", e.isIntersecting);
    });
  }, { rootMargin: "0px 0px -10% 0px" });
  document.querySelectorAll(".qt-focus").forEach((el) => focusIO.observe(el));
}

// ---------- image loading: fade in once downloaded ----------
// Only images not yet loaded when the script runs (cached ones show at once); an image
// that fails to load is shown anyway, so it never stays hidden.
document.querySelectorAll("main img").forEach((img) => {
  if (img.complete && img.naturalWidth) return;
  img.classList.add("img-wait");
  const done = () => {
    img.classList.remove("img-wait");
    img.classList.add("img-in");
    img.addEventListener("animationend", () => img.classList.remove("img-in"), { once: true });
  };
  img.addEventListener("load", done, { once: true });
  img.addEventListener("error", done, { once: true });
});

// ---------- built-in UI panels (e.g. Dobbin's Team usage card) ----------
// The card is sized in units of its panel's width (1/821 of it, Figma's panel width). Set that
// unit in px from the panel's real width, so every browser scales it the same way.
const statPanels = document.querySelectorAll(".stat-panel");
if (statPanels.length && "ResizeObserver" in window) {
  const ro = new ResizeObserver((entries) => {
    entries.forEach((e) => e.target.style.setProperty("--panel-u", `${e.contentRect.width / 821}px`));
  });
  statPanels.forEach((p) => ro.observe(p));
}

// ---------- Dobbin hero: the intro animation ----------
// One looping timeline (T ms). Each part gets a single infinite animation whose keyframes sit at
// times on that timeline, so everything stays in sync and pauses together when off screen.
// Distances are in storyboard units (1/1673 of the panel, times --k on phones), worked out in px.
const dobHero = document.querySelector("[data-dob-hero]");
if (dobHero && "ResizeObserver" in window) {
  const T = 9600;
  const q = (s) => dobHero.querySelector(s);
  const typeEl = q(".dob-hero__type span");
  const text = "Hey @dobbin...";
  typeEl.innerHTML = [...text].map((c) => `<span>${c}</span>`).join("");
  const motion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches && "animate" in dobHero;
  let anims = [], U = 0, onScreen = true;

  // track(el, [[ms, {props}, easing to the next key?], …]): holds the first and last values to the loop's ends
  const track = (el, keys) => {
    const frames = keys.map(([t, props, easing]) => ({ offset: t / T, easing: easing || "ease", ...props }));
    if (frames[0].offset > 0) frames.unshift({ ...frames[0], offset: 0 });
    if (frames.at(-1).offset < 1) frames.push({ ...frames.at(-1), offset: 1 });
    anims.push(el.animate(frames, { duration: T, iterations: Infinity }));
  };
  const out = "cubic-bezier(0.2, 0.7, 0.2, 1)", inOut = "cubic-bezier(0.6, 0, 0.3, 1)", flex = "cubic-bezier(0.3, 1.3, 0.5, 1)";

  const build = () => {
    const at = anims[0] ? anims[0].currentTime : 0;
    anims.forEach((a) => a.cancel());
    anims = [];
    const px = (n) => `${n * U}px`;
    const go = (x, y) => `translate(${px(x)}, ${px(y)})`;
    // the file: fades in, is picked up, dragged over the mark, dropped into it
    track(q(".dob-hero__drag"), [[0, { transform: go(0, 0) }], [900, { transform: go(0, 0) }, inOut], [1500, { transform: go(192, -25) }, "ease-in"],
      [1720, { transform: go(272, 0) }], [9400, { transform: go(272, 0) }, "step-end"], [9401, { transform: go(0, 0) }]]);
    track(q(".dob-hero__file"), [[0, { opacity: 0, transform: "none" }], [300, { opacity: 1, transform: "none" }], [760, { opacity: 1, transform: "none" }, out],
      [870, { opacity: 1, transform: "scale(1.06)" }, inOut], [1500, { opacity: 1, transform: "rotate(15deg) scale(1.06)" }, "ease-in"],
      [1720, { opacity: 0, transform: "rotate(15deg) scale(0.2)" }]]);
    track(q(".dob-hero__sel"), [[0, { opacity: 0 }], [770, { opacity: 0 }], [800, { opacity: 1 }], [1500, { opacity: 1 }], [1600, { opacity: 0 }]]);
    track(q(".dob-hero__cursor"), [[0, { opacity: 0, transform: go(90, 80) }], [300, { opacity: 0, transform: go(90, 80) }, out],
      [760, { opacity: 1, transform: go(0, 0) }], [1600, { opacity: 1, transform: go(0, 0) }], [1750, { opacity: 0, transform: go(0, 0) }]]);
    // the pill flexes out to fit the UI, and back in at the end
    track(q(".dob-hero__pill"), [[0, { width: px(189) }], [1760, { width: px(189) }, flex], [2250, { width: px(952) }], [8750, { width: px(952) }, inOut], [9250, { width: px(189) }]]);
    track(q(".dob-hero__icon"), [[0, { transform: "none" }], [1700, { transform: "none" }, out], [1790, { transform: "scale(0.9)" }, out], [1980, { transform: "none" }]]);
    // loading: the text, then the red bar
    track(q(".dob-hero__load"), [[0, { opacity: 0, transform: go(0, 8) }], [1950, { opacity: 0, transform: go(0, 8) }, out], [2200, { opacity: 1, transform: "none" }],
      [3500, { opacity: 1, transform: "none" }], [3650, { opacity: 0, transform: "none" }]]);
    track(q(".dob-hero__bar span"), [[0, { translate: "-100% 0" }], [2150, { translate: "-100% 0" }, "cubic-bezier(0.5, 0, 0.2, 1)"], [3200, { translate: "0 0" }], [3700, { translate: "0 0" }, "step-end"], [3701, { translate: "-100% 0" }]]);
    // the mark becomes a teammate, who comes online…
    const swap = (el, inAt, outAt) => {
      const on = { opacity: 1, transform: "none" }, off = { opacity: 0, transform: "scale(0.7)" };
      const keys = inAt ? [[0, off], [inAt, off, out], [inAt + 200, on], [outAt, on, "ease-in"], [outAt + 150, off]]
        : [[0, on], [outAt, on, "ease-in"], [outAt + 150, off], [8950, off, out], [9250, on]];
      track(el, keys);
    };
    swap(q(".dob-hero__mark"), 0, 3550);
    // Then a calmer pace (the doc goes in fast; using Dobbin is unhurried): the teammate comes slowly
    // into focus, in soft and blurred, sharp once settled; blurs out on the way out
    const blur = (n, o, sc) => ({ opacity: o, filter: `blur(${px(n)})`, transform: `scale(${sc})` });
    track(q(".dob-hero__avatar"), [[0, blur(14, 0, 1.08)], [3600, blur(14, 0, 1.08), "linear"], [3850, blur(9, 1, 1.05), "cubic-bezier(0.35, 0, 0.25, 1)"],
      [4500, blur(0, 1, 1)], [8550, blur(0, 1, 1), "ease-in-out"], [8900, blur(10, 0, 0.94)]]);
    track(q(".dob-hero__online"), [[0, { scale: "0" }], [4650, { scale: "0" }, flex], [4950, { scale: "1" }], [8450, { scale: "1" }, "ease-in"], [8600, { scale: "0" }]]);
    // …and types "Hey @dobbin..." at a person's pace: a beat after "Hey", another before the dots
    track(q(".dob-hero__type"), [[0, { opacity: 0 }], [4750, { opacity: 0 }], [4900, { opacity: 1 }], [8400, { opacity: 1 }, "ease-in-out"], [8700, { opacity: 0 }]]);
    let t = 5100;
    typeEl.querySelectorAll("span").forEach((s, i) => {
      t += i === 0 ? 0 : i === 4 ? 260 : i === 11 ? 380 : i > 11 ? 170 : 95;
      track(s, [[0, { maxWidth: "0" }], [t, { maxWidth: "0" }, "step-end"], [t + 1, { maxWidth: "1em" }], [8750, { maxWidth: "1em" }, "step-end"], [8751, { maxWidth: "0" }]]);
    });
    anims.forEach((a) => { a.currentTime = at; if (!onScreen) a.pause(); });
  };

  new ResizeObserver(([e]) => {
    const w = e.contentRect.width;
    dobHero.style.setProperty("--hero-u", `${w / 1673}px`);
    const nu = (w / 1673) * (parseFloat(getComputedStyle(dobHero).getPropertyValue("--k")) || 1);
    if (motion && nu !== U) { U = nu; build(); }
  }).observe(dobHero);
  if (motion && "IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      anims.forEach((a) => (onScreen ? a.play() : a.pause()));
    }).observe(dobHero);
  }
}

// ---------- video playback speeds ----------
// data-rate on a <video> slows (or speeds) it; browsers reset playbackRate on load.
document.querySelectorAll("video[data-rate]").forEach((v) => {
  const apply = () => { v.playbackRate = parseFloat(v.dataset.rate); };
  apply();
  v.addEventListener("loadedmetadata", apply);
});

// ---------- videos: load and play only when near the screen ----------
// Videos carry data-autoplay (not autoplay) and preload="none", so nothing downloads
// on page load. Each starts about a screen before it comes into view (half a screen
// sideways, for the carousel), so it's already running on arrival, and pauses once
// well out of view. The poster shows until then. Reduced motion: posters only.
if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const videos = document.querySelectorAll("video[data-autoplay]");
  const play = (v) => { const p = v.play(); if (p) p.catch(() => {}); };
  const near = new Set();   // videos currently near the screen
  if ("IntersectionObserver" in window) {
    const videoIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { near.add(e.target); play(e.target); }
        else { near.delete(e.target); e.target.pause(); }
      });
    }, { rootMargin: "100% 50% 100% 50%" });
    videos.forEach((v) => videoIO.observe(v));
  } else {
    videos.forEach((v) => { near.add(v); play(v); });
  }
  // iPhone Low Power Mode (and some data savers) refuse to start a video until the
  // visitor has touched the page. Any tap is that permission, so retry the ones nearby
  // that were refused; later videos then start as they come near.
  const retry = () => near.forEach((v) => { if (v.paused) play(v); });
  ["touchend", "click", "keydown"].forEach((t) => document.addEventListener(t, retry, { passive: true }));
}

// ---------- work card captions on tablet / phone: no hover, so each one fades in by itself ----------
// The row arrives first (its fade-up), then SuperRare's caption; after that each card's caption
// follows 0.3s after the card is swiped into view. Shown once, never hidden again.
const capCards = document.querySelectorAll(".work .card");
if (capCards.length && window.matchMedia("(max-width: 1100px)").matches) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    capCards.forEach((c) => c.classList.add("is-captioned"));
  } else {
    const ROW_IN = 900, DELAY = 300;  // the row's fade-up, then the caption delay
    let rowAt = null;  // when the row started fading up
    const capIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        capIO.unobserve(e.target);
        if (rowAt === null) rowAt = performance.now();
        const wait = Math.max(DELAY, rowAt + ROW_IN + DELAY - performance.now());
        setTimeout(() => e.target.classList.add("is-captioned"), wait);
      });
    }, { threshold: 0.6 });
    capCards.forEach((c) => capIO.observe(c));
  }
}
