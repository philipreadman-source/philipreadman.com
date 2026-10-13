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

// ---------- video playback speeds ----------
// data-rate on a <video> slows (or speeds) it; browsers reset playbackRate on load.
document.querySelectorAll("video[data-rate]").forEach((v) => {
  const apply = () => { v.playbackRate = parseFloat(v.dataset.rate); };
  apply();
  v.addEventListener("loadedmetadata", apply);
});

// ---------- reduced motion: no autoplaying video ----------
if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.querySelectorAll("video[autoplay]").forEach((v) => { v.pause(); v.removeAttribute("autoplay"); });
}
