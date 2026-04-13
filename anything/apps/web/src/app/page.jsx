import React from 'react';
import { motion } from 'motion/react';
import {
  MapPin,
  Car,
  Navigation,
  Search,
  ShieldCheck,
  Clock,
  Star,
  CheckCircle,
  ArrowRight,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15 } },
};

export default function Page() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0b1f33] text-slate-100 font-sans selection:bg-blue-500/30 selection:text-white overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0b1f33]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center gap-2 cursor-pointer">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <MapPin className="text-white fill-white/20" size={24} />
              </div>
              <span className="text-2xl font-bold tracking-tight text-white">ParkMate</span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">How it Works</a>
              <a href="#testimonials" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Reviews</a>
              <button className="bg-white text-[#0b1f33] px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-blue-50 transition-colors shadow-lg shadow-white/10 flex items-center gap-2 group">
                Get Started
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="text-slate-300 hover:text-white p-2"
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden bg-[#0c233d] border-b border-white/5 px-4 py-6 flex flex-col gap-4"
          >
            <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="text-base font-medium text-slate-300 hover:text-white">Features</a>
            <a href="#how-it-works" onClick={() => setIsMobileMenuOpen(false)} className="text-base font-medium text-slate-300 hover:text-white">How it Works</a>
            <a href="#testimonials" onClick={() => setIsMobileMenuOpen(false)} className="text-base font-medium text-slate-300 hover:text-white">Reviews</a>
            <button className="bg-white text-[#0b1f33] px-6 py-3 rounded-xl text-base font-semibold w-full mt-2">
              Get Started for Free
            </button>
          </motion.div>
        )}
      </nav>

      {/* 1. Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[120px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none translate-x-1/2 -translate-y-1/2" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            {/* Hero Content */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="max-w-2xl mx-auto lg:mx-0 text-center lg:text-left pt-10 lg:pt-0"
            >
              <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm font-medium mb-6">
                <CheckCircle size={14} className="text-blue-400" />
                <span>Now covering all of Victoria</span>
              </motion.div>
              
              <motion.h1 variants={fadeInUp} className="text-5xl lg:text-7xl font-bold tracking-tight text-white leading-[1.1] mb-6">
                Find the perfect <br className="hidden lg:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
                  parking spot,
                </span>
                <br /> every time.
              </motion.h1>
              
              <motion.p variants={fadeInUp} className="text-lg lg:text-xl text-slate-300 mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Stop circling the block. ParkMate gives you real-time access to public parking zones, live availability, and turn-by-turn directions right to your spot.
              </motion.p>
              
              <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <button className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-full text-base font-semibold transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 flex items-center justify-center gap-2">
                  Download the App
                  <ArrowRight size={18} />
                </button>
                <button className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-8 py-4 rounded-full text-base font-semibold transition-colors flex items-center justify-center gap-2">
                  See How It Works
                </button>
              </motion.div>
              
              <motion.div variants={fadeInUp} className="mt-10 flex items-center justify-center lg:justify-start gap-4 text-sm text-slate-400">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-[#0b1f33] bg-slate-700 flex items-center justify-center overflow-hidden">
                      <img src={`https://i.pravatar.cc/100?img=${i + 10}`} alt={`User ${i}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center text-yellow-400">
                    {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={14} fill="currentColor" />)}
                  </div>
                  <span>Trusted by 10k+ drivers</span>
                </div>
              </motion.div>
            </motion.div>

            {/* Hero Abstract UI / Mockup */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
              className="relative lg:h-[600px] flex items-center justify-center"
            >
              {/* Decorative elements behind phone */}
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-transparent rounded-full blur-[80px]" />
              
              {/* Abstract Phone Frame */}
              <div className="relative w-[300px] h-[600px] bg-slate-900 rounded-[48px] border-[8px] border-slate-800 shadow-2xl shadow-blue-900/40 overflow-hidden z-10 flex flex-col transform lg:translate-x-12">
                {/* Dynamic Island / Notch */}
                <div className="absolute top-0 inset-x-0 h-7 flex justify-center z-50">
                  <div className="w-32 h-6 bg-slate-950 rounded-b-3xl"></div>
                </div>

                {/* App UI Mockup */}
                <div className="flex-1 bg-[#0b1f33] relative">
                  {/* Map area abstract */}
                  <div className="absolute inset-0 bg-[#0f2942]">
                    <div className="w-full h-full opacity-30" style={{ backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                    
                    {/* Simulated Path */}
                    <svg className="absolute inset-0 w-full h-full text-blue-500 opacity-60" viewBox="0 0 300 600">
                      <path d="M 150 500 C 150 400, 50 350, 100 250 C 150 150, 250 200, 200 100" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeDasharray="10 10" className="animate-[dash_2s_linear_infinite]" />
                    </svg>

                    {/* Parking Pins */}
                    <div className="absolute top-[80px] right-[80px] w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/40 animate-bounce">
                      <span className="text-white font-bold text-xs">P</span>
                    </div>
                    <div className="absolute top-[230px] left-[80px] w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/40 opacity-70">
                      <span className="text-white font-bold text-[10px]">P</span>
                    </div>
                    
                    {/* Car Position */}
                    <div className="absolute bottom-[80px] left-[130px] w-12 h-12 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20">
                      <div className="w-4 h-4 bg-blue-400 rounded-full shadow-[0_0_15px_rgba(96,165,250,1)]"></div>
                    </div>
                  </div>

                  {/* Bottom Sheet UI */}
                  <div className="absolute bottom-0 inset-x-0 h-[45%] bg-slate-900 rounded-t-[32px] border-t border-white/5 p-6 flex flex-col shadow-[0_-20px_40px_rgba(0,0,0,0.5)]">
                    <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mb-6"></div>
                    <h3 className="text-white font-bold text-xl mb-1">Victoria St. Parking</h3>
                    <p className="text-slate-400 text-sm mb-4">2 spots available • 4 min away</p>
                    
                    <div className="flex gap-3 mb-6">
                      <div className="flex-1 bg-slate-800 rounded-xl p-3 flex items-center gap-3">
                        <Clock className="text-blue-400" size={18} />
                        <div>
                          <p className="text-xs text-slate-400">Time Limit</p>
                          <p className="text-sm font-semibold text-white">2 Hours</p>
                        </div>
                      </div>
                      <div className="flex-1 bg-slate-800 rounded-xl p-3 flex items-center gap-3">
                        <ShieldCheck className="text-green-400" size={18} />
                        <div>
                          <p className="text-xs text-slate-400">Zone Type</p>
                          <p className="text-sm font-semibold text-white">Free</p>
                        </div>
                      </div>
                    </div>

                    <button className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-semibold mt-auto flex items-center justify-center gap-2">
                      <Navigation size={18} /> Navigate Here
                    </button>
                  </div>
                </div>
              </div>

              {/* Floating cards */}
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-32 -left-12 lg:-left-20 bg-slate-800/90 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-xl z-20 flex items-center gap-4 hidden sm:flex"
              >
                <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                  <CheckCircle className="text-green-400" size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Spot Found!</p>
                  <p className="text-xs text-slate-400">Saved 15 minutes</p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 2. Social Proof / Stats */}
      <section className="py-10 border-y border-white/5 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-medium text-slate-400 mb-8 uppercase tracking-widest">Powered by official city data</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: 'Parking Zones Mapped', value: '10,000+' },
              { label: 'Active Drivers', value: '50k+' },
              { label: 'Average Time Saved', value: '14 min' },
              { label: 'Cities Covered', value: 'Victoria-wide' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <h4 className="text-3xl font-bold text-white mb-2">{stat.value}</h4>
                <p className="text-sm text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Key Features */}
      <section id="features" className="py-24 lg:py-32 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Everything you need to park perfectly.</h2>
            <p className="text-lg text-slate-300">We've turned parking from a guessing game into an exact science. Enjoy a suite of tools designed specifically for the modern driver.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <Search className="text-blue-400" size={28} />,
                title: "Map Public Parking Zones",
                desc: "Instantly locate free and paid street parking zones around your destination before you even leave.",
              },
              {
                icon: <Clock className="text-cyan-400" size={28} />,
                title: "Live Spot Availability",
                desc: "Get real-time updates on open spaces within busy city grids so you know exactly where to head.",
              },
              {
                icon: <Navigation className="text-purple-400" size={28} />,
                title: "Turn-by-turn Directions",
                desc: "Seamless navigation routes you directly to the available spot, avoiding traffic and one-way confusion.",
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-slate-800/40 border border-white/5 p-8 rounded-3xl hover:bg-slate-800/60 transition-colors relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-150 transition-transform duration-500">
                  {feature.icon}
                </div>
                <div className="w-14 h-14 bg-slate-700/50 rounded-2xl flex items-center justify-center mb-6">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-slate-400 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. How It Works */}
      <section id="how-it-works" className="py-24 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Visual Steps */}
            <div className="order-2 lg:order-1 relative h-[500px] w-full rounded-3xl overflow-hidden bg-gradient-to-br from-[#0c233d] to-slate-900 border border-white/10 p-8 flex items-center justify-center shadow-2xl">
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="relative z-10 w-full max-w-sm"
              >
                <div className="bg-[#0b1f33] rounded-2xl p-6 border border-white/10 shadow-2xl space-y-4">
                  <div className="flex gap-4 items-center mb-6 pb-6 border-b border-white/10">
                    <Search className="text-slate-400" />
                    <div className="flex-1 h-10 bg-slate-800 rounded-lg flex items-center px-4">
                      <span className="text-slate-300 text-sm">Melbourne CBD</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="p-4 bg-slate-800/80 rounded-xl border border-blue-500/30 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">P</div>
                        <div>
                          <p className="text-sm font-semibold text-white">Bourke St Zone</p>
                          <p className="text-xs text-green-400">High availability</p>
                        </div>
                      </div>
                      <button className="bg-blue-600 text-white w-8 h-8 flex flex-col justify-center items-center rounded-full">
                        <Navigation size={14} />
                      </button>
                    </div>
                    <div className="p-4 bg-slate-800/40 rounded-xl border border-white/5 flex items-center justify-between opacity-60">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-700 text-slate-400 flex items-center justify-center font-bold text-xs">P</div>
                        <div>
                          <p className="text-sm font-semibold text-white">Lonsdale St</p>
                          <p className="text-xs text-red-400">Full</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Text Steps */}
            <div className="order-1 lg:order-2">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-10">Three steps to your destination.</h2>
              <div className="space-y-10">
                {[
                  { step: "01", title: "Search your Destination", desc: "Enter where you're heading. We'll scan the surrounding radius for all legal, available public parking zones." },
                  { step: "02", title: "Compare Options & Rules", desc: "Easily view time limits, hourly pricing, and availability odds before you make a decision." },
                  { step: "03", title: "Navigate & Park", desc: "Hit go, and our specialized navigation directs you right to the parking spot, optimizing for traffic and immediate access." }
                ].map((item, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.2 }}
                    className="flex gap-6"
                  >
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20">
                        <span className="text-blue-400 font-bold">{item.step}</span>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                      <p className="text-slate-400 leading-relaxed text-base">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Why Choose ParkMate */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/5"></div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <Car className="mx-auto text-blue-500 mb-6" size={48} />
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-8">Why use ParkMate?</h2>
          <p className="text-xl md:text-2xl text-slate-300 leading-relaxed font-light">
            "Unlike standard maps that just give you driving directions, ParkMate focuses solely on the hardest part of the journey: <span className="text-white font-semibold">arriving and parking.</span> We cut out the parking anxiety with precision accuracy."
          </p>
        </div>
      </section>

      {/* 6. Testimonials */}
      <section id="testimonials" className="py-24 bg-slate-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Drivers love the lack of stress.</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { name: "Sarah T.", role: "Daily Commuter", quote: "I used to spend 15 minutes looking for parking before work. Now I just open ParkMate and drive straight to an open zone." },
              { name: "Mark J.", role: "Weekend Explorer", quote: "The live availability feature is an absolute game-changer for weekend trips to the city. Highly recommend." },
              { name: "Elena R.", role: "Local Resident", quote: "Finally an app that understands local parking rules in Victoria. I haven't had a parking ticket since I downloaded it." }
            ].map((review, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-slate-800/50 p-8 rounded-3xl border border-white/5 flex flex-col justify-between"
              >
                <div className="flex text-yellow-400 mb-6">
                  {[1, 2, 3, 4, 5].map((s) => <Star key={s} size={16} fill="currentColor" />)}
                </div>
                <p className="text-slate-300 mb-8 text-lg italic">"{review.quote}"</p>
                <div className="flex items-center gap-4 mt-auto">
                  <div className="w-12 h-12 bg-slate-700 rounded-full overflow-hidden">
                    <img src={`https://i.pravatar.cc/100?img=${i + 20}`} alt={review.name} />
                  </div>
                  <div>
                    <h4 className="text-white font-bold">{review.name}</h4>
                    <p className="text-slate-400 text-sm">{review.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Final Call to Action */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-900/20"></div>
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px]"></div>
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-cyan-500/20 rounded-full blur-[100px]"></div>
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight">Ready to eliminate parking stress?</h2>
          <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
            Join thousands of smart drivers using ParkMate today. Available on iOS and Android.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button className="bg-white text-[#0b1f33] px-10 py-5 rounded-full text-lg font-bold hover:bg-slate-100 transition-colors shadow-2xl shadow-white/10 flex items-center justify-center gap-2">
              Get Started for Free
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </section>

      {/* 8. Footer */}
      <footer className="border-t border-white/10 bg-[#071524] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <MapPin className="text-blue-500" size={24} />
            <span className="text-xl font-bold text-white tracking-tight">ParkMate</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 md:gap-8">
            <a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">Contact Support</a>
            <a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">Twitter</a>
            <a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">Instagram</a>
          </div>
          <p className="text-slate-500 text-sm">© 2026 ParkMate. All rights reserved.</p>
        </div>
      </footer>
      
      {/* CSS for custom animation */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes dash {
          to {
            stroke-dashoffset: -20;
          }
        }
      `}} />
    </div>
  );
}
