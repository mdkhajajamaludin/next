"use client"

import React, { useState, useEffect, useRef } from "react"
import ChatApp from "./components/ChatApp"
import { auth } from "./firebase/config"
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, signInWithPhoneNumber, RecaptchaVerifier } from "firebase/auth"
import { Orbitron } from 'next/font/google'
import Image from 'next/image'

const orbitron = Orbitron({ subsets: ['latin'] })

export default function Home() {
  const [user, setUser] = useState(null)
  const cursorRef = useRef(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loginMethod, setLoginMethod] = useState('email') // 'email' or 'phone'
  const [phoneNumber, setPhoneNumber] = useState('')
  const [otp, setOtp] = useState('')
  const [confirmationResult, setConfirmationResult] = useState(null)
  const [showOtpInput, setShowOtpInput] = useState(false)
  const recaptchaVerifierRef = useRef(null)

  useEffect(() => {
    const cursor = cursorRef.current

    const moveCursor = (e) => {
      const { clientX, clientY } = e
      cursor.style.transform = `translate(${clientX - 16}px, ${clientY - 16}px)`
    }

    const handleMouseDown = (e) => {
      const { clientX, clientY } = e
      cursor.style.transform = `translate(${clientX - 16}px, ${clientY - 16}px) scale(0.8)`
    }

    const handleMouseUp = (e) => {
      const { clientX, clientY } = e
      cursor.style.transform = `translate(${clientX - 16}px, ${clientY - 16}px) scale(1)`
    }

    let frame
    const smoothMoveCursor = (e) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => moveCursor(e))
    }

    document.addEventListener('mousemove', smoothMoveCursor)
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', smoothMoveCursor)
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mouseup', handleMouseUp)
      cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': () => {
          // reCAPTCHA solved, allow signInWithPhoneNumber.
        },
        'expired-callback': () => {
          // Response expired. Ask user to solve reCAPTCHA again.
          setError('reCAPTCHA expired. Please try again.');
        }
      });
    }

    // Cleanup
    return () => {
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }
    };
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider()
    try {
      await signInWithPopup(auth, provider)
    } catch (error) {
      console.error("Error signing in with Google:", error)
    }
  }

  const handleSignIn = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!email || !password) {
        throw new Error('Please fill in all fields')
      }
      
      await signInWithEmailAndPassword(auth, email, password)
    } catch (error) {
      console.error('Error:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSendOtp = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!phoneNumber) {
        throw new Error('Please enter your phone number')
      }

      const formattedPhoneNumber = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`
      if (recaptchaVerifierRef.current) {
        await recaptchaVerifierRef.current.clear()
      }

      recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      })

      const confirmation = await signInWithPhoneNumber(
        auth, 
        formattedPhoneNumber, 
        recaptchaVerifierRef.current
      )
      
      setConfirmationResult(confirmation)
      setShowOtpInput(true)
      setError('OTP sent successfully!')
    } catch (error) {
      console.error('Error:', error)
      setError(error.message || 'Failed to send OTP. Please try again.')
      
      if (recaptchaVerifierRef.current) {
        await recaptchaVerifierRef.current.clear()
      }
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!otp) {
        throw new Error('Please enter the OTP')
      }

      if (!confirmationResult) {
        throw new Error('Please request OTP first')
      }

      await confirmationResult.confirm(otp)
    } catch (error) {
      console.error('Error:', error)
      setError(error.message || 'Invalid OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Custom Cursor */}
      <div 
        ref={cursorRef}
        className="hidden md:block fixed pointer-events-none z-50"
        style={{
          width: '45px',
          height: '45px',
          position: 'relative'
        }}
      >
        <Image
          src="https://i.postimg.cc/T1rgbP9b/set-of-game-cursors-or-pointer-icons-click-arrows-free-vector-removebg-preview.png"
          alt="Custom Cursor"
          fill
          style={{
            filter: 'drop-shadow(0 0 10px rgba(168,85,247,0.5))',
            transition: 'transform 0.05s linear'
          }}
        />
      </div>

      <main className="w-full min-h-screen flex bg-gradient-to-br from-slate-50 to-gray-100 relative overflow-hidden [&_*]:cursor-none">
        {/* Modern geometric background patterns */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(168,85,247,0.1)_0%,rgba(255,255,255,0)_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(249,168,212,0.1)_0%,rgba(255,255,255,0)_100%)]" />
        
        <div className="flex-1 max-w-full relative z-10">
          {user ? (
            <ChatApp user={user} />
          ) : (
            <div className="flex items-center justify-center min-h-screen p-4">
              <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-lg w-full max-w-6xl mx-auto flex flex-col md:flex-row overflow-hidden animate-fadeIn">
                
                {/* Left side - Modernized branding */}
                <div className="w-full md:w-1/2 p-8 md:p-12 flex items-center justify-center bg-gradient-to-br from-violet-50 to-pink-50 animate-slideInLeft">
                  <div className="text-center space-y-6">
                    <div className="relative inline-block animate-float">
                      {/* Main Robot Image */}
                      <Image 
                        src="https://i.postimg.cc/MGN4d54F/319674861336580100-1-unscreen.gif"
                        alt="AI Robot"
                        width={224}
                        height={224}
                        className="w-48 md:w-56 mx-auto drop-shadow-xl hover:scale-105 transition-all duration-500"
                      />
                      
                      {/* Floating Icons */}
                      <div className="absolute inset-0 -z-10">
                        {/* Chat Icon */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-16 animate-orbit-1">
                          <div className="bg-white/80 p-3 rounded-full shadow-lg backdrop-blur-sm animate-float-slow">
                            <svg className="w-6 h-6 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                          </div>
                        </div>

                        {/* AI Brain Icon */}
                        <div className="absolute top-1/2 -right-12 animate-orbit-2">
                          <div className="bg-white/80 p-3 rounded-full shadow-lg backdrop-blur-sm animate-float-slow animation-delay-2000">
                            <svg className="w-6 h-6 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                          </div>
                        </div>

                        {/* Math Icon */}
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-16 animate-orbit-3">
                          <div className="bg-white/80 p-3 rounded-full shadow-lg backdrop-blur-sm animate-float-slow animation-delay-1000">
                            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          </div>
                        </div>

                        {/* Code Icon */}
                        <div className="absolute top-1/2 -left-12 animate-orbit-4">
                          <div className="bg-white/80 p-3 rounded-full shadow-lg backdrop-blur-sm animate-float-slow animation-delay-3000">
                            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      <div className="absolute inset-0 bg-gradient-to-r from-violet-400/20 to-pink-400/20 blur-3xl -z-20 animate-pulse" />
                    </div>
                    
                    <div className="animate-fadeInUp animation-delay-500">
                      <h3 className={`${orbitron.className} text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-pink-600 tracking-wide mb-2`}>
                      Bobocoon AI 
                      </h3>
                      <div className="h-1 w-20 mx-auto bg-gradient-to-r from-violet-400 to-pink-400 rounded-full animate-width" />
                    </div>
                  </div>
                </div>

                {/* Right side - Modern login form */}
                <div className="w-full md:w-1/2 p-8 md:p-12 bg-white animate-slideInRight">
                  <div className="max-w-md mx-auto space-y-8">
                    <div className="text-center">
                      <h2 className={`${orbitron.className} text-2xl font-bold text-gray-800 mb-2`}>
                        Welcome Back
                      </h2>
                      <p className="text-gray-500 text-sm">Sign in to continue your journey</p>
                    </div>

                    {/* Login method selector */}
                    <div className="flex rounded-lg border border-gray-200 p-1">
                      <button
                        onClick={() => setLoginMethod('email')}
                        className={`flex-1 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                          loginMethod === 'email' 
                            ? 'bg-violet-500 text-white' 
                            : 'text-gray-500 hover:text-violet-500'
                        }`}
                      >
                        Email Login
                      </button>
                      <button
                        onClick={() => setLoginMethod('phone')}
                        className={`flex-1 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                          loginMethod === 'phone' 
                            ? 'bg-violet-500 text-white' 
                            : 'text-gray-500 hover:text-violet-500'
                        }`}
                      >
                        Phone Login
                      </button>
                    </div>

                    {/* Error/Success message */}
                    {error && (
                      <div className={`px-4 py-3 rounded-lg text-sm ${
                        error.includes('successfully') 
                          ? 'bg-green-50 text-green-500' 
                          : 'bg-red-50 text-red-500'
                      }`}>
                        {error}
                      </div>
                    )}

                    {loginMethod === 'email' ? (
                      // Existing email login form
                      <form onSubmit={handleSignIn} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">Email</label>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all duration-200 bg-gray-50/50"
                            placeholder="Enter your email"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">Password</label>
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all duration-200 bg-gray-50/50"
                            placeholder="Enter your password"
                            required
                          />
                        </div>

                        {/* Sign in button */}
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full bg-gradient-to-r from-violet-500 to-pink-500 text-white py-3 rounded-xl hover:opacity-90 transition-all duration-200 font-medium relative overflow-hidden group"
                        >
                          <span className={loading ? 'opacity-0' : 'opacity-100'}>
                            Sign In
                          </span>
                          
                          {/* Loading spinner */}
                          {loading && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            </div>
                          )}
                          
                          {/* Button gradient animation */}
                          <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
                        </button>
                      </form>
                    ) : (
                      // Phone OTP login form
                      <form onSubmit={showOtpInput ? handleVerifyOtp : handleSendOtp} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">
                            Phone Number
                          </label>
                          <input
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="+1234567890"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all duration-200 bg-gray-50/50"
                            required
                            disabled={showOtpInput}
                          />
                        </div>

                        {showOtpInput && (
                          <div className="animate-fadeIn">
                            <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">
                              Enter OTP
                            </label>
                            <input
                              type="text"
                              value={otp}
                              onChange={(e) => setOtp(e.target.value)}
                              placeholder="Enter 6-digit OTP"
                              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all duration-200 bg-gray-50/50"
                              required
                              maxLength={6}
                            />
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full bg-gradient-to-r from-violet-500 to-pink-500 text-white py-3 rounded-xl hover:opacity-90 transition-all duration-200 font-medium relative overflow-hidden group"
                        >
                          <span className={loading ? 'opacity-0' : 'opacity-100'}>
                            {showOtpInput ? 'Verify OTP' : 'Send OTP'}
                          </span>
                          
                          {/* Loading spinner */}
                          {loading && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            </div>
                          )}
                        </button>

                        {showOtpInput && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowOtpInput(false)
                              setOtp('')
                              setError('')
                            }}
                            className="w-full text-sm text-gray-500 hover:text-violet-500 transition-colors duration-200"
                          >
                            Change Phone Number
                          </button>
                        )}
                      </form>
                    )}

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-gray-500">Or continue with</span>
                      </div>
                    </div>

                    {/* Google sign in button */}
                    <button
                      onClick={signInWithGoogle}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 py-3 rounded-xl hover:bg-gray-50 transition-colors duration-200"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      <span className="text-gray-600 font-medium">Continue with Google</span>
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      </main>

      {/* Move recaptcha container to the end of the body */}
      <div 
        id="recaptcha-container" 
        className="invisible"
        style={{ position: 'fixed', bottom: 0, left: 0 }}
      ></div>

      <style jsx global>{`
        * {
          cursor: none;
        }

        /* Show default cursor on mobile devices */
        @media (max-width: 768px) {
          * {
            cursor: auto;
          }
        }

        /* Custom hover effects for interactive elements */
        a:hover ~ #cursor,
        button:hover ~ #cursor {
          transform: scale(1.5);
          background-color: rgb(168,85,247);
        }

        input:hover ~ #cursor {
          transform: scale(0.8);
          background-color: rgb(168,85,247);
        }

        @keyframes extend {
          0%, 100% { width: 0%; opacity: 1; }
          50% { width: 100%; opacity: 0.5; }
        }

        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }

        .animate-scan {
          animation: scan 8s linear infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }

        @keyframes width {
          0% { width: 0; }
          100% { width: 5rem; }
        }

        @keyframes blob {
          0% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0, 0) scale(1); }
        }

        .animate-float {
          animation: float 6s ease-in-out infinite;
        }

        .animate-width {
          animation: width 1s ease-out forwards;
        }

        .animate-blob {
          animation: blob 7s infinite;
        }

        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.5s ease-out forwards;
        }

        .animate-slideInLeft {
          animation: slideInLeft 0.5s ease-out forwards;
        }

        .animate-slideInRight {
          animation: slideInRight 0.5s ease-out forwards;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-4000 {
          animation-delay: 4s;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-100px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(100px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        /* Add hover animations for buttons */
        button {
          transition: transform 0.2s ease-in-out;
        }

        button:hover {
          transform: translateY(-2px);
        }

        /* Add input focus animations */
        input {
          transition: all 0.3s ease;
        }

        input:focus {
          transform: scale(1.01);
        }

        @keyframes orbit-1 {
          from { transform: rotate(0deg) translateX(60px) rotate(0deg); }
          to { transform: rotate(360deg) translateX(60px) rotate(-360deg); }
        }

        @keyframes orbit-2 {
          from { transform: rotate(90deg) translateX(70px) rotate(-90deg); }
          to { transform: rotate(450deg) translateX(70px) rotate(-450deg); }
        }

        @keyframes orbit-3 {
          from { transform: rotate(180deg) translateX(60px) rotate(-180deg); }
          to { transform: rotate(540deg) translateX(60px) rotate(-540deg); }
        }

        @keyframes orbit-4 {
          from { transform: rotate(270deg) translateX(70px) rotate(-270deg); }
          to { transform: rotate(630deg) translateX(70px) rotate(-630deg); }
        }

        .animate-orbit-1 {
          animation: orbit-1 12s linear infinite;
        }

        .animate-orbit-2 {
          animation: orbit-2 15s linear infinite;
        }

        .animate-orbit-3 {
          animation: orbit-3 18s linear infinite;
        }

        .animate-orbit-4 {
          animation: orbit-4 20s linear infinite;
        }

        .animate-float-slow {
          animation: float 8s ease-in-out infinite;
        }

        .animation-delay-1000 {
          animation-delay: 1s;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-3000 {
          animation-delay: 3s;
        }
      `}</style>
    </>
  )
}