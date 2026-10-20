import { useEffect } from 'react';

export function useInteractiveEffects() {
  useEffect(() => {
    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isFinePointer = window.matchMedia('(pointer: fine)').matches && !isReducedMotion;
    const root = document.documentElement;
    const preloader = document.getElementById('pt');
    const dot = document.getElementById('cd');
    const ring = document.getElementById('cr');
    const spBar = document.getElementById('sp');
    const nav = document.querySelector('nav');
    const orbs = document.querySelector('.orbs') as HTMLElement | null;

    // 1. Preloader dismissal
    let preloaderTimer: ReturnType<typeof setTimeout> | undefined;
    if (preloader) {
      if (isReducedMotion) {
        preloader.style.display = 'none';
      } else {
        preloaderTimer = setTimeout(() => {
          preloader.style.transition = 'transform 0.5s cubic-bezier(0.76, 0, 0.24, 1)';
          preloader.style.transform = 'translateY(-100%)';
        }, 350);
      }
    }

    // 2. Scroll measurements and progress bar
    let scrollScheduled = false;
    let maxScroll = 0;
    let isScrolled = false;

    const measureScroll = () => {
      maxScroll = Math.max(0, root.scrollHeight - window.innerHeight);
    };

    const handleScroll = () => {
      if (scrollScheduled) return;
      scrollScheduled = true;
      requestAnimationFrame(() => {
        scrollScheduled = false;
        const currentY = window.scrollY;

        // Background orb translation
        if (orbs) {
          orbs.style.setProperty('--sy', String(currentY));
        }

        // Top progress bar
        if (spBar) {
          const progress = maxScroll > 0 ? Math.min(1, currentY / maxScroll) : 0;
          spBar.style.transform = `scaleX(${progress})`;
        }

        // Nav scrolled state
        const scrolled = currentY > 8;
        if (nav && scrolled !== isScrolled) {
          isScrolled = scrolled;
          nav.classList.toggle('scrolled', scrolled);
        }
      });
    };

    measureScroll();
    window.addEventListener('resize', measureScroll);
    window.addEventListener('scroll', handleScroll, { passive: true });

    const resizeObserver = new ResizeObserver(measureScroll);
    resizeObserver.observe(document.body);

    // 3. Mouse interactions (Card Glow, 3D Tilt, Custom Cursor)
    let clientX = 0;
    let clientY = 0;
    let ringX = 0;
    let ringY = 0;
    let scale = 1;
    let targetScale = 1;
    let cursorVisible = false;
    let cursorRaf = 0;

    const handleMouseMove = (e: MouseEvent) => {
      clientX = e.clientX;
      clientY = e.clientY;
      const target = e.target as HTMLElement | null;

      // Card spotlight glow
      const gcard = target?.closest?.('.gcard') as HTMLElement | null;
      if (gcard) {
        const rect = gcard.getBoundingClientRect();
        gcard.style.setProperty('--mx', `${clientX - rect.left}px`);
        gcard.style.setProperty('--my', `${clientY - rect.top}px`);
      }

      if (!isFinePointer) return;

      // 3D Tilt
      const tiltEl = target?.closest?.('.tilt') as HTMLElement | null;
      if (tiltEl) {
        const rect = tiltEl.getBoundingClientRect();
        const rx = (0.5 - (clientY - rect.top) / rect.height) * 7;
        const ry = ((clientX - rect.left) / rect.width - 0.5) * 7;
        tiltEl.style.setProperty('--rx', `${rx}deg`);
        tiltEl.style.setProperty('--ry', `${ry}deg`);
      }

      // Cursor movement
      if (dot && ring) {
        if (!cursorVisible) {
          cursorVisible = true;
          ringX = clientX;
          ringY = clientY;
          dot.style.opacity = '1';
          ring.style.opacity = '1';
        }
        dot.style.transform = `translate3d(${clientX}px, ${clientY}px, 0) translate(-50%, -50%)`;

        const isHoverable = target?.closest?.('a, button, select, [role="tab"], input, textarea');
        targetScale = isHoverable ? 1.8 : 1;
        ring.classList.toggle('hv', Boolean(isHoverable));
      }
    };

    const animateCursor = () => {
      ringX += (clientX - ringX) * 0.2;
      ringY += (clientY - ringY) * 0.2;
      scale += (targetScale - scale) * 0.2;
      if (ring) {
        ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%) scale(${scale})`;
      }
      cursorRaf = requestAnimationFrame(animateCursor);
    };

    const handleMouseOut = (e: MouseEvent) => {
      const tiltEl = (e.target as HTMLElement | null)?.closest?.('.tilt') as HTMLElement | null;
      if (tiltEl && !(e.relatedTarget && tiltEl.contains(e.relatedTarget as Node))) {
        tiltEl.style.setProperty('--rx', '0deg');
        tiltEl.style.setProperty('--ry', '0deg');
      }
    };

    const handleMouseDown = () => {
      targetScale = 0.7;
    };

    const handleMouseUp = () => {
      targetScale = 1;
    };

    const handleMouseLeaveDoc = () => {
      if (dot && ring) {
        dot.style.opacity = '0';
        ring.style.opacity = '0';
      }
      cursorVisible = false;
    };

    if (isFinePointer) {
      document.body.classList.add('hc');
      animateCursor();
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseout', handleMouseOut);
      window.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mouseup', handleMouseUp);
      document.documentElement.addEventListener('mouseleave', handleMouseLeaveDoc);
    }

    handleScroll();

    // 4. Cleanup
    return () => {
      if (preloaderTimer) clearTimeout(preloaderTimer);
      cancelAnimationFrame(cursorRaf);
      window.removeEventListener('resize', measureScroll);
      window.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();

      if (isFinePointer) {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseout', handleMouseOut);
        window.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mouseup', handleMouseUp);
        document.documentElement.removeEventListener('mouseleave', handleMouseLeaveDoc);
      }
    };
  }, []);
}
