/* app.js — IdeaBrief Interactivity */

(function () {
  'use strict';

  // Mark JS as loaded
  document.documentElement.classList.add('js-loaded');

  // ── Theme (default dark — this IS the dark site) ──
  const root = document.documentElement;
  // Dark by default. Only switch to light if system explicitly prefers it
  // and we haven't overridden.
  if (!root.getAttribute('data-theme')) {
    root.setAttribute('data-theme', 'dark');
  }

  // ── Scroll Reveal (JS fallback for browsers without scroll-driven animations) ──
  const supportsScrollTimeline = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('animation-timeline: scroll()');

  if (!supportsScrollTimeline) {
    const reveals = document.querySelectorAll('.js-reveal');
    if (reveals.length > 0) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
      );
      reveals.forEach((el) => observer.observe(el));
    }
  }

  // ── Score Bar Animation ──
  const scoreBar = document.querySelector('.idea-card__score-fill');
  if (scoreBar) {
    const barObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            scoreBar.classList.add('animate');
            barObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.3 }
    );
    barObserver.observe(scoreBar.closest('.idea-card'));
  }

  // ── Smooth Scroll for Anchor Links ──
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ── Header Scroll Behavior ──
  const header = document.querySelector('.header');
  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const current = window.scrollY;
    if (current > 80) {
      header.style.boxShadow = 'var(--shadow-md)';
    } else {
      header.style.boxShadow = 'none';
    }
    lastScroll = current;
  }, { passive: true });

  // ── Vault Card Stagger Animation ──
  const vaultCards = document.querySelectorAll('.vault-card');
  if (vaultCards.length > 0) {
    const vaultObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const cards = entry.target.querySelectorAll('.vault-card');
            cards.forEach((card, i) => {
              card.style.opacity = '0';
              card.style.transition = `opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${i * 60}ms`;
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  card.style.opacity = '1';
                });
              });
            });
            vaultObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    const vaultGrid = document.querySelector('.vault-grid');
    if (vaultGrid) vaultObserver.observe(vaultGrid);
  }

  // ── Pricing Card Hover Glow (desktop only) ──
  if (window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.pricing-card:not(.pricing-card--disabled)').forEach((card) => {
      card.addEventListener('mouseenter', () => {
        if (!card.classList.contains('pricing-card--featured')) {
          card.style.boxShadow = 'var(--shadow-md)';
        }
      });
      card.addEventListener('mouseleave', () => {
        if (!card.classList.contains('pricing-card--featured')) {
          card.style.boxShadow = '';
        }
      });
    });
  }

})();
