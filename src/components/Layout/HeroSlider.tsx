// src/components/HeroSlider.tsx
import React, { useMemo, useRef, useCallback } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, Navigation, A11y, Keyboard } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
import { Link } from 'react-router-dom';

type Slide = {
  link: string;
  bg: string;        // file in /public
  alt: string;
  position?: string; // CSS object-position
};

const slides: Slide[] = [
  { link: '/products', bg: '/ban1.webp', alt: 'Premium TWS earbuds', position: 'center' },
  { link: '/oem',      bg: '/ban5.webp', alt: 'Wholesale accessories', position: 'center' },
  { link: '/products', bg: '/ban10.webp', alt: 'Fast charging cable', position: 'center' },
  { link: '/products', bg: '/ban11.webp', alt: 'Premium charger set', position: 'right center' },
  { link: '/oem',      bg: '/ban2.webp', alt: 'Bulk B2B orders', position: 'center' },
  { link: '/oem',      bg: '/bna7.webp', alt: 'OEM services', position: 'center' },
];

const HeroSlider: React.FC = () => {
  const prefersReduced = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches,
    []
  );
  const swiperRef = useRef<SwiperType | null>(null);
  const stop = useCallback(() => swiperRef.current?.autoplay?.stop?.(), []);
  const start = useCallback(() => { if (!prefersReduced) swiperRef.current?.autoplay?.start?.(); }, [prefersReduced]);

  return (
    <section className="w-full relative" aria-label="Hero banners" onMouseEnter={stop} onMouseLeave={start}>
      <Swiper
        modules={[Autoplay, Pagination, Navigation, A11y, Keyboard]}
        onSwiper={(sw) => (swiperRef.current = sw)}
        slidesPerView={1}
        centeredSlides
        loop
        spaceBetween={0}
        autoplay={prefersReduced ? false : { delay: 3500, disableOnInteraction: false }}
        pagination={{ clickable: true }}
        navigation
        keyboard={{ enabled: true, onlyInViewport: true }}
        a11y={{ enabled: true }}
        className="hero-swiper"
      >
        {slides.map((s, i) => (
          <SwiperSlide key={i}>
            <Link to={s.link} className="block">
              {/* fixed heights + safe bg behind object-contain on small screens */}
              <div className="w-full h-[230px] xs:h-[280px] sm:h-[360px] md:h-[480px] lg:h-[560px] xl:h-[620px] relative overflow-hidden bg-neutral-900">
                <img
                  src={s.bg}
                  alt={s.alt}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-contain sm:object-cover"
                  style={{ objectPosition: s.position || 'center' }}
                />
              </div>
            </Link>
          </SwiperSlide>
        ))}
      </Swiper>

      <style>{`
        .hero-swiper,
        .hero-swiper .swiper,
        .hero-swiper .swiper-wrapper,
        .hero-swiper .swiper-slide { height: auto; }
        .hero-swiper { --swiper-theme-color: #fff; }
        .hero-swiper .swiper-pagination-bullet { opacity:.7 }
        .hero-swiper .swiper-pagination-bullet-active { opacity:1 }
        .hero-swiper .swiper-button-next, .hero-swiper .swiper-button-prev {
          color:#fff; text-shadow:0 2px 10px rgba(0,0,0,.35)
        }
        @media (max-width:640px){
          .hero-swiper .swiper-button-next, .hero-swiper .swiper-button-prev { width:40px; height:40px }
        }
      `}</style>
    </section>
  );
};

export default HeroSlider;
