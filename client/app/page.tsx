'use client';

import { Music, Heart, Sparkles, Play, Headphones, Waves, Mic2, Disc3, Radio, Volume2, Star, Zap, Shuffle, ArrowUp } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    VANTA: {
      WAVES: (options: {
        el: string | HTMLElement;
        mouseControls?: boolean;
        touchControls?: boolean;
        gyroControls?: boolean;
        minHeight?: number;
        minWidth?: number;
        scale?: number;
        scaleMobile?: number;
        color?: number;
        shininess?: number;
        waveHeight?: number;
        waveSpeed?: number;
        zoom?: number;
      }) => {
        destroy: () => void;
      };
    };
    THREE: unknown;
  }
}

export default function HomePage() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const vantaRef = useRef<HTMLDivElement>(null);
  const vantaEffect = useRef<ReturnType<typeof window.VANTA.WAVES> | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);

  useEffect(() => {
    let threeScript: HTMLScriptElement | null = null;
    let vantaScript: HTMLScriptElement | null = null;

    const initVanta = () => {
      if (window.VANTA && vantaRef.current && !vantaEffect.current) {
        vantaEffect.current = window.VANTA.WAVES({
          el: vantaRef.current,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200.00,
          minWidth: 200.00,
          scale: 1.00,
          scaleMobile: 1.00,
          color: 0x5171f,
          shininess: 30,
          waveHeight: 15,
          waveSpeed: 1,
          zoom: 1
        });
      }
    };

    if (!window.THREE) {
      threeScript = document.createElement('script');
      threeScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js';
      threeScript.async = true;
      threeScript.onload = () => {
        vantaScript = document.createElement('script');
        vantaScript.src = 'https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.waves.min.js';
        vantaScript.async = true;
        vantaScript.onload = initVanta;
        document.body.appendChild(vantaScript);
      };
      document.body.appendChild(threeScript);
    } else if (!window.VANTA?.WAVES) {
      vantaScript = document.createElement('script');
      vantaScript.src = 'https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.waves.min.js';
      vantaScript.async = true;
      vantaScript.onload = initVanta;
      document.body.appendChild(vantaScript);
    } else {
      initVanta();
    }

    return () => {
      if (vantaEffect.current) {
        vantaEffect.current.destroy();
        vantaEffect.current = null;
      }
      if (threeScript && document.body.contains(threeScript)) {
        document.body.removeChild(threeScript);
      }
      if (vantaScript && document.body.contains(vantaScript)) {
        document.body.removeChild(vantaScript);
      }
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
      setShowScrollButton(window.scrollY > 300);
    };
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const floatingIcons = [
    { icon: Music, className: "top-[10%] left-[5%] sm:top-[15%] sm:left-[8%] text-purple-400/50", delay: "delay-300", size: "w-6 h-6 sm:w-8 sm:h-8" },
    { icon: Headphones, className: "top-[20%] right-[8%] sm:top-[25%] sm:right-[12%] text-pink-400/50", delay: "delay-700", size: "w-6 h-6 sm:w-8 sm:h-8" },
    { icon: Waves, className: "bottom-[25%] left-[10%] sm:bottom-[30%] sm:left-[15%] text-blue-400/50", delay: "delay-500", size: "w-6 h-6 sm:w-8 sm:h-8" },
    { icon: Heart, className: "bottom-[15%] right-[12%] sm:bottom-[20%] sm:right-[16%] text-red-400/50", delay: "delay-1000", size: "w-6 h-6 sm:w-8 sm:h-8" },
    { icon: Mic2, className: "top-[35%] right-[20%] sm:top-[40%] sm:right-[25%] text-purple-300/40", delay: "delay-1200", size: "w-5 h-5 sm:w-6 sm:h-6" },
    { icon: Disc3, className: "bottom-[45%] left-[15%] sm:bottom-[50%] sm:left-[20%] text-blue-300/40", delay: "delay-800", size: "w-5 h-5 sm:w-6 sm:h-6" },
    { icon: Radio, className: "top-[60%] right-[25%] sm:top-[65%] sm:right-[30%] text-pink-300/40", delay: "delay-600", size: "w-5 h-5 sm:w-6 sm:h-6" },
    { icon: Volume2, className: "top-[45%] left-[8%] text-green-300/40", delay: "delay-400", size: "w-4 h-4 sm:w-5 sm:h-5" },
    { icon: Star, className: "bottom-[60%] right-[8%] text-yellow-300/40", delay: "delay-900", size: "w-4 h-4 sm:w-5 sm:h-5" },
    { icon: Zap, className: "top-[75%] left-[25%] text-orange-300/40", delay: "delay-1100", size: "w-4 h-4 sm:w-5 sm:h-5" },
    { icon: Shuffle, className: "bottom-[35%] right-[35%] text-indigo-300/40", delay: "delay-1300", size: "w-4 h-4 sm:w-5 sm:h-5" }
  ];

  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  return (
    <main className={`min-h-screen relative overflow-hidden transition-all duration-500 ease-out ${isScrolled ? 'pt-4 sm:pt-8' : 'pt-0'}`}>
      {/* Vanta.js background with overlay */}
      <div ref={vantaRef} className="fixed top-0 left-0 w-full h-screen z-0" />
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-pink-900/20 z-5" />
      
      {/* Dynamic cursor glow effect */}
      <div 
        className="hidden lg:block fixed pointer-events-none z-10 w-96 h-96 opacity-20 transition-opacity duration-300"
        style={{
          left: mousePosition.x - 192,
          top: mousePosition.y - 192,
          background: 'radial-gradient(circle, rgba(147, 51, 234, 0.1) 0%, transparent 70%)',
          filter: 'blur(40px)'
        }}
      />

      {/* Floating elements */}
      {floatingIcons.map(({ icon: Icon, className, delay, size }, index) => (
        <div key={index} className={`absolute ${className} animate-float ${delay} z-10 hidden sm:block`}>
          <Icon className={size} />
        </div>
      ))}

      {/* Mobile floating elements */}
      <div className="sm:hidden">
        <div className="absolute top-[10%] left-[5%] text-purple-400/30 animate-float delay-300 z-10">
          <Music className="w-5 h-5" />
        </div>
        <div className="absolute top-[15%] right-[8%] text-pink-400/30 animate-float delay-700 z-10">
          <Headphones className="w-5 h-5" />
        </div>
        <div className="absolute bottom-[20%] left-[8%] text-blue-400/30 animate-float delay-500 z-10">
          <Waves className="w-5 h-5" />
        </div>
        <div className="absolute bottom-[10%] right-[10%] text-red-400/30 animate-float delay-1000 z-10">
          <Heart className="w-5 h-5" />
        </div>
      </div>

      <div className={`relative z-10 flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8 transition-all duration-1000 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="text-center max-w-7xl mx-auto w-full">
          {/* Logo section with fixed top padding */}
          <div className="mb-8 sm:mb-12 lg:mb-16 pt-8 sm:pt-12">
            <div className="flex justify-center mb-6 sm:mb-8 lg:mb-10">
              <div className="relative group">
                <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 xl:w-32 xl:h-32 bg-gradient-to-br from-purple-500 via-purple-600 to-pink-500 rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-2xl transform rotate-12 group-hover:rotate-0 transition-all duration-700 hover:shadow-purple-500/25 backdrop-blur-sm">
                  <Music className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 xl:w-16 xl:h-16 text-white group-hover:animate-pulse" />
                </div>
                
                <div className="absolute -top-2 -right-2 sm:-top-3 sm:-right-3 lg:-top-4 lg:-right-4 group-hover:-top-3 group-hover:-right-3 sm:group-hover:-top-4 sm:group-hover:-right-4 lg:group-hover:-top-5 lg:group-hover:-right-5 transition-all duration-300">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full flex items-center justify-center animate-bounce shadow-lg backdrop-blur-sm">
                    <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-white" />
                  </div>
                </div>
                
                <div className="absolute -bottom-2 -left-2 sm:-bottom-3 sm:-left-3 lg:-bottom-4 lg:-left-4 group-hover:-bottom-3 group-hover:-left-3 sm:group-hover:-bottom-4 sm:group-hover:-left-4 lg:group-hover:-bottom-5 lg:group-hover:-left-5 transition-all duration-300">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 bg-gradient-to-r from-green-400 to-blue-400 rounded-full flex items-center justify-center animate-pulse shadow-lg backdrop-blur-sm">
                    <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4 text-white ml-0.5" />
                  </div>
                </div>

                <div className="absolute top-1/2 -right-8 sm:-right-10 lg:-right-12 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-500">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 bg-gradient-to-r from-pink-400 to-red-400 rounded-full animate-ping backdrop-blur-sm"></div>
                </div>
              </div>
            </div>

<div className="inline-block mb-4 sm:mb-6 lg:mb-8 group">
  <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-200 to-pink-200 leading-tight relative inline-block">
    Music Stream
    <span className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-pink-400 transform scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500"></span>
  </h1>
</div>
            
            {/* Subheading */}
            <div className="relative space-y-3 sm:space-y-4 lg:space-y-6">
              <p className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl text-purple-200 font-light tracking-wider">
                Experience <span className="font-medium bg-gradient-to-r from-pink-400 to-purple-400 text-transparent bg-clip-text animate-pulse">mood-based</span> music playback
              </p>
              <p className="text-sm sm:text-base lg:text-lg xl:text-xl text-purple-300/90 max-w-xs sm:max-w-md lg:max-w-2xl xl:max-w-3xl mx-auto leading-relaxed tracking-wide px-2 sm:px-0">
                Let your emotions guide your playlist. Discover music that perfectly matches your current vibe and transforms your listening experience into something extraordinary.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 lg:gap-6 mb-12 sm:mb-16 lg:mb-20 px-4 sm:px-0">
            <Link href="/sign-up" className="group relative px-6 sm:px-8 lg:px-10 py-3 sm:py-4 lg:py-5 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl sm:rounded-2xl shadow-xl hover:shadow-2xl hover:shadow-purple-500/25 transition-all duration-300 transform hover:scale-105 active:scale-95 overflow-hidden backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-700 to-pink-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative flex items-center justify-center gap-2 sm:gap-3">
                <span className="text-sm sm:text-base lg:text-lg tracking-wide">Get Started Free</span>
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 group-hover:animate-spin" />
              </div>
              <div className="absolute inset-0 bg-white/20 transform -skew-x-12 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
            </Link>

            <Link href="/sign-in" className="group relative px-6 sm:px-8 lg:px-10 py-3 sm:py-4 lg:py-5 bg-white/10 backdrop-blur-sm text-white font-semibold rounded-xl sm:rounded-2xl border border-white/20 hover:bg-white/20 hover:border-white/30 transition-all duration-300 transform hover:scale-105 active:scale-95 overflow-hidden">
              <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative flex items-center justify-center gap-2 sm:gap-3">
                <span className="text-sm sm:text-base lg:text-lg tracking-wide">Sign In</span>
                <Play className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform duration-300" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-white/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            </Link>
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 max-w-6xl mx-auto px-2 sm:px-0">
            {[
              {
                icon: <Heart className="w-5 h-5 sm:w-6 sm:h-6 text-white" />,
                title: "Mood Detection",
                desc: "AI-powered mood analysis to curate perfect playlists for every moment",
                gradient: "from-purple-500 to-blue-500"
              },
              {
                icon: <Headphones className="w-5 h-5 sm:w-6 sm:h-6 text-white" />,
                title: "Smart Playlists",
                desc: "Dynamically generated playlists that evolve with your taste and preferences",
                gradient: "from-pink-500 to-red-500"
              },
              {
                icon: <Waves className="w-5 h-5 sm:w-6 sm:h-6 text-white" />,
                title: "Seamless Flow",
                desc: "Smooth transitions that match your emotional journey throughout the day",
                gradient: "from-blue-500 to-green-500"
              }
            ].map((feature, index) => (
              <div 
                key={index}
                className="bg-white/5 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:shadow-purple-500/10 transform"
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className={`w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-gradient-to-r ${feature.gradient} rounded-lg sm:rounded-xl flex items-center justify-center mb-3 sm:mb-4 lg:mb-6 mx-auto shadow-lg backdrop-blur-sm`}>
                  {feature.icon}
                </div>
                <h3 className="text-white font-semibold mb-2 sm:mb-3 tracking-wide text-sm sm:text-base lg:text-lg">{feature.title}</h3>
                <p className="text-purple-200 text-xs sm:text-sm lg:text-base tracking-wide leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>

          {/* Final CTA */}
          <div className="mt-12 sm:mt-16 lg:mt-20 mb-8 sm:mb-12">
            <p className="text-purple-200/90 mb-4 sm:mb-6 lg:mb-8 tracking-wider text-sm sm:text-base lg:text-lg">Ready to transform your music experience?</p>
            <button 
              onClick={scrollToTop}
              className="group relative px-6 sm:px-8 lg:px-12 py-3 sm:py-4 lg:py-5 bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 text-white font-semibold rounded-full shadow-xl hover:shadow-2xl hover:shadow-cyan-500/25 transition-all duration-300 transform hover:scale-105 active:scale-95 overflow-hidden backdrop-blur-sm"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative flex items-center justify-center gap-2 sm:gap-3 lg:gap-4">
                <span className="text-sm sm:text-base lg:text-lg xl:text-xl tracking-wider">Start Your Musical Journey</span>
                <Play className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-white group-hover:animate-ping" />
              </div>
              <div className="absolute inset-0 bg-white/10 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-left rounded-full"></div>
            </button>
          </div>
        </div>
      </div>

      {/* Scroll to top button */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-50 w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 transform ${showScrollButton ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
      >
        <ArrowUp className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
      </button>

      {/* Bottom gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 sm:h-40 lg:h-48 bg-gradient-to-t from-black/50 via-black/20 to-transparent z-5"></div>
      
      {/* Mobile bottom padding */}
      <div className="h-8 sm:h-0"></div>
    </main>
  );
}