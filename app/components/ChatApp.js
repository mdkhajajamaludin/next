'use client'

import React, { useState, useRef, useEffect } from "react"
import { Copy, ThumbsUp, ThumbsDown, Image as ImageIcon, Paperclip, ChevronDown, Send, Sparkles, Loader2, LogOut, User, Settings, Trash2, Crown, Zap, Plus, Code, Check } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from "./avatar"
import { Button } from "./button"
import { Input } from "./input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu"
import { ScrollArea } from "./Scrollarea"
import { motion, AnimatePresence } from "framer-motion"
import { auth } from '../firebase/config'
import { supabase } from '../supabase/config'
import { signOut } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import ImageToTextComponent from './ImageToText'
import Image from 'next/image';

const AI_MODELS = [
  {
    id: "hf:Qwen/Qwen2.5-Coder-32B-Instruct",
    name: "Qwen 2.5 Coder",
    description: "Specialized in coding assistance",
    icon: <Code className="w-4 h-4 mr-2" />
  },
  {
    id: "hf:google/gemma-2-9b-it",
    name: "Gemma 2B",
    description: "Google's efficient language model",
    icon: <Sparkles className="w-4 h-4 mr-2" />
  }
];

const formatExplanationResponse = (content) => {
  // Format headings with special styling
  let formatted = content.replace(/^# (.*$)/gm, 
    '<div class="explanation-heading">$1</div>');
  
  // Format subheadings
  formatted = formatted.replace(/^## (.*$)/gm, 
    '<div class="explanation-subheading">$1</div>');
  
  // Format bullet points
  formatted = formatted.replace(/^\* (.*$)/gm, 
    '<div class="explanation-bullet">• $1</div>');
  
  // Format numbered points
  formatted = formatted.replace(/^(\d+)\. (.*$)/gm, 
    '<div class="explanation-step"><span class="step-number">$1.</span> $2</div>');
  
  // Format bold text
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  return `
    <div class="explanation-container">
      ${formatted}
    </div>
  `;
}

const formatAIResponse = (content) => {
  // Check if this is an explanation response (starts with #)
  if (content.trim().startsWith('#')) {
    return formatExplanationResponse(content);
  }
  
  // Format code blocks first with HTML escaping
  let formatted = content.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    // Escape HTML characters in code blocks
    const escapedCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    
    // Remove data-code attribute since we'll get code directly from <code> element
    return `
      <div class="code-block">
        <div class="code-header">
          <span class="code-lang">${lang}</span>
          <button class="copy-button">
            <svg class="copy-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M8 17.929H6c-1.105 0-2-.912-2-2.036V5.036C4 3.912 4.895 3 6 3h8c1.105 0 2 .912 2 2.036v1.866m-6 .17h8c1.105 0 2 .91 2 2.035v10.857C20 21.088 19.105 22 18 22h-8c-1.105 0-2-.911-2-2.036V9.107c0-1.124.895-2.036 2-2.036z"/>
            </svg>
            <span class="copy-text">Copy</span>
          </button>
        </div>
        <pre><code>${escapedCode}</code></pre>
      </div>
    `;
  });
  
  // Rest of the formatting remains the same
  formatted = formatted.replace(/^(\d+)\.\s+(.*$)/gm, 
    '<div class="step"><span class="step-number">$1.</span> <span class="step-content">$2</span></div>');
  formatted = formatted.replace(/#{2,3} (.*$)/gm, '<h2 class="ai-response-heading">$1</h2>');
  formatted = formatted.replace(/^\* (.*$)/gm, '<li class="ai-response-list-item">$1</li>');
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/\n\n/g, '</p><p>');
  
  return `
    <div class="ai-response">
      ${formatted}
      <div class="copy-popup">Copied to clipboard!</div>
    </div>
  `;
}

const TypeWriter = ({ content, onComplete }) => {
  const [displayedContent, setDisplayedContent] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (currentIndex < content.length) {
      const timer = setTimeout(() => {
        setDisplayedContent(prev => prev + content[currentIndex]);
        setCurrentIndex(currentIndex + 1);
        
        if (scrollRef.current) {
          scrollRef.current.scrollIntoView({ 
            behavior: "smooth", 
            block: "end"
          });
        }
      }, 0.5);

      return () => clearTimeout(timer);
    } else {
      onComplete && onComplete();
    }
  }, [currentIndex, content, onComplete]);

  return (
    <div className="ai-response-container">
      <div
        dangerouslySetInnerHTML={{ __html: formatAIResponse(displayedContent) }}
      />
      <div ref={scrollRef} />
    </div>
  );
};

const formatExplanationPrompt = (topic) => {
  return `Please explain ${topic} following this exact format:

# Main Topic Title

## Overview
* Brief introduction of the topic
* Key points to understand

## Detailed Explanation
1. First key point or step
2. Second key point or step
3. Additional points as needed

## Summary
* Main takeaways
* Practical applications or implications

Please ensure all sections are present and properly formatted with the exact heading structure shown above.`
}

export default function ChatApp() {
  const router = useRouter()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const [isTyping, setIsTyping] = useState(false)
  const [userEmail, setUserEmail] = useState("")
  const [chatHistory, setChatHistory] = useState([])
  const [currentChatId, setCurrentChatId] = useState(null)
  const [currentModel, setCurrentModel] = useState(AI_MODELS[0].id);
  const [imageToTextAPI] = useState("https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large");
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        console.log("User authenticated:", user.uid)
        setUserEmail(user.email)
        loadUserChats(user.uid) // Load chats after authentication
      } else {
        console.log("User not authenticated")
        router.push('/')
      }
    })

    return () => unsubscribe()
  }, [router])

  // Load user's chats from Supabase
  const loadUserChats = async (userId) => {
    try {
      const { data: chats, error } = await supabase
        .from('chats')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      console.log('Loaded chats:', chats)
      setChatHistory(chats)
    } catch (error) {
      console.error("Error loading chats:", error)
    }
  }

  // Create new chat
  const createNewChat = async () => {
    if (!auth.currentUser) return null
    
    try {
      const { data: chat, error } = await supabase
        .from('chats')
        .insert([
          { 
            user_id: auth.currentUser.uid,
            title: 'New Chat',
            last_message: ''
          }
        ])
        .select()
        .single()

      if (error) throw error
      
      // Update state and return the new chat ID
      setCurrentChatId(chat.id)
      setChatHistory(prev => [chat, ...prev])
      return chat.id
    } catch (error) {
      console.error("Error creating new chat:", error)
      return null
    }
  }

  // Load messages for current chat
  useEffect(() => {
    if (!currentChatId) return

    const loadMessages = async () => {
      try {
        const { data: messages, error } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_id', currentChatId)
          .order('created_at', { ascending: true })

        if (error) throw error
        setMessages(messages || [])
      } catch (error) {
        console.error("Error loading messages:", error)
      }
    }

    loadMessages()

    // Set up real-time subscription
    const channel = supabase
      .channel(`messages:${currentChatId}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'messages',
          filter: `chat_id=eq.${currentChatId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMessages(prev => [...prev, payload.new])
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [currentChatId])

  // Send message
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return
    
    try {
      let chatId = currentChatId
      console.log("Starting sendMessage with chatId:", chatId)
      
      // Create new chat if none exists
      if (!chatId) {
        chatId = await createNewChat()
        console.log("Created new chat with ID:", chatId)
        
        if (!chatId) {
          throw new Error("Failed to create new chat")
        }
        
        // Update chat title with first message
        const { error: titleError } = await supabase
          .from('chats')
          .update({ 
            title: input.substring(0, 30) + (input.length > 30 ? '...' : ''),
            last_message: input.substring(0, 50) + (input.length > 50 ? '...' : '')
          })
          .eq('id', chatId)

        if (titleError) {
          console.error("Error updating chat title:", titleError)
        }

        // Update local state with new title
        setChatHistory(prev => prev.map(chat => 
          chat.id === chatId 
            ? { ...chat, title: input.substring(0, 30) + (input.length > 30 ? '...' : '') }
            : chat
        ))
        
        // Wait a moment for the state to update
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      setIsLoading(true)
      setIsTyping(true)
      const userMessage = { role: "user", content: input }
      
      // Update local state immediately for user message
      const newUserMessage = {
        chat_id: chatId,
        role: userMessage.role,
        content: userMessage.content,
        created_at: new Date().toISOString()
      }
      
      setMessages(prev => [...prev, newUserMessage])

      // Add message to Supabase
      const { data: savedMessage, error: messageError } = await supabase
        .from('messages')
        .insert([
          {
            chat_id: chatId,
            role: userMessage.role,
            content: userMessage.content
          }
        ])
        .select()
        .single()

      if (messageError) {
        console.error("Error saving message:", messageError)
        throw messageError
      }

      console.log("Saved message:", savedMessage)

      // Update chat's last message
      const { error: chatError } = await supabase
        .from('chats')
        .update({ 
          last_message: input.substring(0, 50) + (input.length > 50 ? '...' : '')
        })
        .eq('id', chatId)

      if (chatError) {
        console.error("Error updating chat:", chatError)
        throw chatError
      }

      setInput("")

      // API call to AI service
      try {
        const response = await fetch("https://glhf.chat/api/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer glhf_1be880cc86f23615140096db254feacd`
          },
          body: JSON.stringify({
            model: currentModel,
            messages: [...messages, userMessage],
          }),
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        const botMessage = data.choices[0].message
        
        // Store bot response in Supabase
        const { error: botMessageError } = await supabase
          .from('messages')
          .insert([
            {
              chat_id: chatId,
              role: botMessage.role,
              content: botMessage.content
            }
          ])

        if (botMessageError) {
          console.error("Error saving bot message:", botMessageError)
          throw botMessageError
        }

        // Update local state with bot message
        setMessages(prev => [...prev, {
          chat_id: chatId,
          role: botMessage.role,
          content: botMessage.content,
          created_at: new Date().toISOString()
        }])

      } catch (error) {
        console.error("Error fetching AI response:", error)
      } finally {
        setIsLoading(false)
        setIsTyping(false)
      }
    } catch (error) {
      console.error("Error in sendMessage:", error)
      setIsLoading(false)
      setIsTyping(false)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.push('/')
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const deleteChat = async (chatId) => {
    try {
      // Delete messages first due to foreign key constraint
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('chat_id', chatId)

      if (messagesError) throw messagesError

      // Then delete the chat
      const { error: chatError } = await supabase
        .from('chats')
        .delete()
        .eq('id', chatId)

      if (chatError) throw chatError

      // Update local state
      setChatHistory(prev => prev.filter(chat => chat.id !== chatId))
      if (currentChatId === chatId) {
        setCurrentChatId(null)
        setMessages([])
      }
    } catch (error) {
      console.error("Error deleting chat:", error)
    }
  }

  // Add this useEffect to handle copy button clicks
  useEffect(() => {
    const handleCopyClick = async (e) => {
      const button = e.target.closest('.copy-button');
      if (!button) return;

      try {
        const codeBlock = button.closest('.code-block');
        // Get the raw text content, trimming any extra whitespace
        const codeText = codeBlock.querySelector('code').textContent.trim();
        const popup = document.querySelector('.copy-popup');
        
        // Decode HTML entities to get proper characters
        const decodedText = codeText
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .replace(/&amp;/g, '&');

        await navigator.clipboard.writeText(decodedText);
        
        // Update UI to show copied state
        const copyText = button.querySelector('.copy-text');
        const originalText = copyText.textContent;
        copyText.textContent = 'Copied!';
        button.classList.add('copied');
        popup.classList.add('show');
        
        setTimeout(() => {
          copyText.textContent = originalText;
          button.classList.remove('copied');
          popup.classList.remove('show');
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    };

    // Add event listener to handle copy button clicks
    document.addEventListener('click', handleCopyClick);

    // Cleanup
    return () => {
      document.removeEventListener('click', handleCopyClick);
    };
  }, []);

  const handleImageToText = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingImage(true);
      console.log("Processing image:", file.name); // Debug log
      
      // Call Hugging Face API
      const response = await fetch("https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large", {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer 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'
        },
        body: file
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("API Response:", result); // Debug log
      
      if (!result || !result[0]?.generated_text) {
        throw new Error("Invalid API response");
      }

      // Create a message with the image description
      const imageDescription = result[0].generated_text;
      console.log("Generated description:", imageDescription); // Debug log
      
      // Set the input and trigger send message
      setInput(`Image Description: ${imageDescription}`);
      // Wait a bit for the state to update
      await new Promise(resolve => setTimeout(resolve, 100));
      // Send the message
      await sendMessage();
      
    } catch (error) {
      console.error('Error processing image:', error);
      alert(`Error processing image: ${error.message}`);
    } finally {
      setIsProcessingImage(false);
    }
  };

  useEffect(() => {
    if (userEmail && messages.length === 0) {
      const welcomeMessage = {
        role: "assistant",
        content: `# BOBOCOON AI 🐼
        
Welcome ${userEmail}! I'm your AI assistant, powered by NAMTECH.

I'm here to help you with any questions or tasks you have. Let's get started! ✨`,
        created_at: new Date().toISOString()
      };

      setMessages([welcomeMessage]);
    }
  }, [userEmail, messages.length]);

  return (
    <div className="flex flex-col min-h-screen w-full bg-[#fafafa]">
      <div className="absolute inset-0 bg-[radial-gradient(#e0e7ff_1px,transparent_1px)] [background-size:16px_16px] opacity-50"></div>
      
      <div className="flex flex-1">
        <div className="hidden md:flex w-64 flex-col fixed h-full bg-white/80 backdrop-blur-xl border-r border-indigo-50 p-4">
          <div className="flex items-center gap-2 px-2 mb-6">
            <div className="flex items-center gap-2">
              <Image 
                src="https://icons.iconarchive.com/icons/iconarchive/incognito-animal-2/512/Panda-icon.png"
                alt="BOBO Logo"
                width={32}
                height={32}
                className="object-contain"
              />
              <div className="text-xl font-medium text-slate-800">BOBO</div>
            </div>
          </div>
          
          <div className="flex flex-col min-h-[calc(100vh-120px)]">
            <div className="flex-1 flex flex-col gap-2">
              <Button 
                variant="ghost" 
                className="justify-start text-left bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                onClick={createNewChat}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                New Chat
              </Button>
              
              <div className="flex-1 mt-4">
                <div className="text-sm font-medium text-slate-500 mb-2">Recent Chats</div>
                <ScrollArea className="h-[calc(100vh-240px)]">
                  {chatHistory.map((chat) => (
                    <div
                      key={chat.id}
                      className="flex items-center justify-between w-full mb-1 group"
                    >
                      <Button
                        variant="ghost"
                        className={`justify-start text-left flex-grow max-w-[85%] ${
                          currentChatId === chat.id ? 'bg-indigo-50 text-indigo-600' : ''
                        }`}
                        onClick={() => setCurrentChatId(chat.id)}
                      >
                        <div className="truncate max-w-[140px]">
                          {chat.title || chat.last_message || 'New Chat'}
                        </div>
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-8 h-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteChat(chat.id)
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-red-500 hover:text-red-600" />
                      </Button>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-indigo-50">
              <Button 
                onClick={handleLogout}
                variant="ghost" 
                className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log out
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center w-full md:ml-64">
          <div className="relative w-full max-w-5xl mx-auto">
            <motion.header 
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="fixed top-0 w-full max-w-5xl z-20 px-4 md:px-6 pt-4"
            >
              <div className="flex items-center justify-between bg-white/80 backdrop-blur-xl rounded-2xl p-3 md:p-4 shadow-lg border border-indigo-50 w-full">
                <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
  <Image 
    src="https://icons.iconarchive.com/icons/iconarchive/incognito-animal-2/512/Panda-icon.png"
    alt="BOBO Logo"
    width={32}
    height={32}
    className="object-contain"
  />
  <div className="text-xl font-medium text-slate-800">BOBO</div>
</div>
                  <div className="h-5 w-px bg-slate-200"></div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-xl px-4 py-2 text-sm">
                        {AI_MODELS.find(model => model.id === currentModel)?.name}
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64 bg-white/95 backdrop-blur-xl border-slate-100 rounded-xl p-2">
                      {AI_MODELS.map((model) => (
                        <DropdownMenuItem 
                          key={model.id}
                          className={`flex items-center gap-2 p-3 cursor-pointer rounded-lg ${
                            currentModel === model.id 
                              ? 'bg-indigo-50 text-indigo-600' 
                              : 'text-slate-600 hover:bg-slate-50'
                          }`}
                          onClick={() => setCurrentModel(model.id)}
                        >
                          <div className="flex items-center gap-2 flex-1">
                            {model.icon}
                            <div className="flex flex-col">
                              <span className="font-medium">{model.name}</span>
                              <span className="text-xs text-slate-500">{model.description}</span>
                            </div>
                          </div>
                          {currentModel === model.id && (
                            <Check className="w-4 h-4" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="rounded-full w-10 h-10 p-0">
                      <Avatar className="h-9 w-9 ring-2 ring-indigo-100">
                        <AvatarFallback className="bg-indigo-500/10">
                          {userEmail.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 mt-2 p-2 bg-white/95 backdrop-blur-xl border-slate-100 rounded-xl shadow-lg">
                    <div className="px-2 py-1.5 mb-2">
                      <div className="font-medium text-sm text-slate-900">My Account</div>
                      <div className="text-xs text-slate-500 truncate">{userEmail}</div>
                    </div>
                    <DropdownMenuItem className="flex items-center gap-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer rounded-lg">
                      <User className="w-4 h-4" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem className="flex items-center gap-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer rounded-lg">
                      <Settings className="w-4 h-4" />
                      Settings
                    </DropdownMenuItem>
                    <div className="h-px bg-slate-200 my-2"></div>
                    <DropdownMenuItem 
                      className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer rounded-lg"
                      onClick={handleLogout}
                    >
                      <LogOut className="w-4 h-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </motion.header>

            <div className="pt-24 pb-32 px-4 md:px-6">
              <ScrollArea className="flex-grow px-1 md:px-2 relative w-full h-[calc(100vh-240px)]">
                <div className="pt-8">
                  <AnimatePresence>
                    {messages.map((msg, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-end gap-3 mb-4 md:mb-6 w-full`}
                      >
                        {msg.role === "user" ? (
                          <div className="flex items-end gap-3 max-w-[85%] md:max-w-[70%]">
                            <div className="message-user max-w-[90%] rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 p-4 shadow-sm">
                              <p className="text-white text-message">{msg.content}</p>
                            </div>
                            <Avatar className="h-8 w-8 ring-2 ring-white/50">
                              <AvatarFallback className="bg-blue-500/10">
                                {userEmail?.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                        ) : (
                          <div className="flex items-start gap-3 max-w-[95%] md:max-w-[85%]">
                            <Avatar className="h-8 w-8 ring-2 ring-slate-100">
                              <AvatarFallback className="bg-indigo-500/10">
                                AI
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col gap-2 message-ai max-w-[90%]">
                              <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-100">
                                <div className="text-message">
                                  {isTyping && index === messages.length - 1 ? (
                                    <TypeWriter 
                                      content={msg.content} 
                                      onComplete={() => setIsTyping(false)}
                                    />
                                  ) : (
                                    <div dangerouslySetInnerHTML={{ __html: formatAIResponse(msg.content) }} />
                                  )}
                                </div>
                                <div className="mt-3 flex items-center gap-2">
                                  <Button variant="ghost" size="sm" className="h-8 px-3 rounded-lg hover:bg-slate-50 text-slate-600">
                                    <Copy className="h-3 w-3 mr-2" />
                                    Copy
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 rounded-lg hover:bg-slate-50 text-slate-600">
                                    <ThumbsUp className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 rounded-lg hover:bg-slate-50 text-slate-600">
                                    <ThumbsDown className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))}
                    {isTyping && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 text-indigo-400 pl-4"
                      >
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Bobo is typing...</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div ref={messagesEndRef} />
              </ScrollArea>
            </div>

            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="fixed bottom-0 w-full max-w-5xl z-20 px-4 md:px-6 pb-4"
            >
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-3 md:p-4 shadow-lg border border-indigo-50 w-full">
                <div className="flex flex-col gap-3 w-full">
                  <div className="flex gap-2 md:gap-3 w-full">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-12 w-12 rounded-xl bg-indigo-50/50 border-indigo-100 hover:bg-indigo-100"
                        >
                          <Plus className="h-5 w-5 text-indigo-600" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56 p-2">
                        <DropdownMenuItem className="flex items-center gap-2 cursor-pointer relative">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageToText}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            disabled={isProcessingImage}
                          />
                          <div className="flex items-center gap-2 w-full">
                            {isProcessingImage ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Processing image...
                              </>
                            ) : (
                              <>
                                <ImageIcon className="h-4 w-4" />
                                Extract text from image
                              </>
                            )}
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="flex items-center gap-2 cursor-pointer">
                          <Paperclip className="h-4 w-4" />
                          Attach file
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Input
                      placeholder="Message Claude..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                      className="message-input flex-grow bg-indigo-50/50 border-indigo-100 rounded-xl text-slate-700 placeholder-slate-400 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300"
                      disabled={isLoading}
                    />
                    <Button 
                      onClick={sendMessage}
                      disabled={isLoading}
                      className="rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white px-4 md:px-5 transition-all duration-200 disabled:opacity-50"
                    >
                      {isLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
      <style jsx global>{`
        /* Message text size - adjust the font-size value as needed */
        .text-message {
          font-size: 16px;  /* Change this value to adjust text size */
          line-height: 1.7;
        }

        /* User message container - adjust width and padding */
        .message-user {
          width: auto;      /* Adjust if you want a specific width */
          padding: 1rem;    /* Adjust padding to change message box size */
        }

        /* AI message container - INCREASED SIZE */
        .message-ai {
          width: 150%;           /* Changed from 100% to 140% */
          max-width: 180%;        /* Increased max-width to allow fuller width */
        }

        /* AI message content */
        .message-ai .rounded-2xl {
          padding: 1rem;         /* Keeping the padding */
          margin: 1rem 0;        /* Keeping the margin */
          border: 1px solid #e2e8f0;  /* Increased border width from 1px to 2px */
        }

        /* AI message text */
        .message-ai .text-message {
          font-size: 17px;       /* Adjusted for better readability */
          line-height: 1.7;      /* Keeping good line height */
        }

        /* Code blocks within AI messages */
        .message-ai .code-block {
          margin: 1.5rem 0;      /* Keeping good spacing */
          border: 2px solid #e2e8f0;  /* Increased border width for code blocks */
        }

        /* Ensuring the container can handle the wider content */
        .message-ai .rounded-2xl {
          width: 100%;          /* Ensures full width within container */
          box-sizing: border-box; /* Includes padding in width calculation */
        }

        /* Input field size - adjust height and padding */
        .message-input {
          font-size: 16px;  /* Change this value to adjust input text size */
          padding: 1rem;    /* Adjust padding to change input box size */
          min-height: 50px; /* Adjust minimum height of input */
        }

        /* Code block styling */
        .code-block {
          background: #f8fafc;
          border-radius: 8px;
          margin: 1rem 0;
          overflow: hidden;
          border: 1px solid #e2e8f0;
          width: 100%;
          max-width: 100%;
        }

        .code-block .code-header {
          background: #f1f5f9;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid #e2e8f0;
          font-family: monospace;
          font-size: 0.875rem;
          color: #64748b;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .code-lang {
          font-weight: 500;
        }

        .copy-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.25rem 0.75rem;
          font-size: 0.75rem;
          color: #64748b;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .copy-button:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
        }

        .copy-button.copied {
          background: #22c55e;
          border-color: #22c55e;
          color: white;
        }

        .copy-icon {
          transition: all 0.2s;
        }

        .copied .copy-icon {
          stroke: white;
        }

        .code-block pre {
          margin: 0;
          padding: 1rem;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .code-block code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 0.875rem;
          line-height: 1.7;
          color: #334155;
          display: block;
          width: 100%;
        }

        /* Responsive adjustments */
        @media (max-width: 640px) {
          .code-block {
            margin: 0.75rem 0;
            font-size: 0.8125rem;
          }
          
          .code-block .code-header {
            padding: 0.5rem 0.75rem;
          }
          
          .code-block pre {
            padding: 0.75rem;
          }
          
          .copy-button {
            padding: 0.25rem 0.5rem;
          }
          
          .copy-text {
            display: none;
          }
          
          .copy-button .copy-icon {
            margin: 0;
          }
        }

        /* Add horizontal scrollbar styling */
        .code-block pre::-webkit-scrollbar {
          height: 8px;
        }

        .code-block pre::-webkit-scrollbar-track {
          background: #f1f5f9;
        }

        .code-block pre::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }

        .code-block pre::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        /* Add these new styles for the copy popup */
        .copy-popup {
          position: fixed;
          bottom: 2rem;
          left: 50%;
          transform: translateX(-50%) translateY(100%);
          background: #1e293b;
          color: white;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-size: 0.875rem;
          opacity: 0;
          visibility: hidden;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 50;
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
        }

        .copy-popup.show {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
          visibility: visible;
        }

        /* Update existing code block styles */
        .code-block .code-header {
          /* ... existing styles ... */
          position: relative;
        }

        .copy-button {
          /* ... existing styles ... */
          backdrop-filter: blur(8px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .copy-button:hover {
          background: #fff;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }

        .copy-button.copied {
          background: #22c55e;
          transform: scale(0.95);
        }

        /* Chat history delete button styles */
        .group {
          position: relative;
          transition: all 0.2s ease;
        }

        .group:hover {
          background: #f8fafc;
          border-radius: 0.5rem;
        }

        .group .opacity-0 {
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .group:hover .opacity-0 {
          opacity: 1 !important;
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .group .opacity-0 {
            opacity: 1;
          }
        }

        /* Explanation formatting styles */
        .explanation-container {
          background: white;
          border-radius: 12px;
          padding: 1.5rem;
          margin: 0.5rem 0;
          border: 1px solid #e5e7eb;
        }

        .explanation-heading {
          font-size: 1.5rem;
          font-weight: 700;
          color: #4f46e5;
          margin-bottom: 1.5rem;
          padding-bottom: 0.75rem;
          border-bottom: 2px solid #e5e7eb;
        }

        .explanation-subheading {
          font-size: 1.25rem;
          font-weight: 600;
          color: #4b5563;
          margin: 1.25rem 0 0.75rem 0;
        }

        .explanation-bullet {
          padding: 0.5rem 0;
          margin-left: 1rem;
          color: #374151;
          line-height: 1.6;
        }

        .explanation-step {
          padding: 0.75rem 0;
          color: #374151;
          line-height: 1.6;
          display: flex;
          gap: 0.75rem;
        }

        .step-number {
          color: #4f46e5;
          font-weight: 600;
          min-width: 1.5rem;
        }

        /* Responsive adjustments */
        @media (max-width: 640px) {
          .explanation-container {
            padding: 1rem;
          }

          .explanation-heading {
            font-size: 1.25rem;
          }

          .explanation-subheading {
            font-size: 1.125rem;
          }
        }

        /* Upgrade card animations and effects */
        .from-indigo-50.via-purple-50.to-pink-50 {
          background-size: 200% 200%;
          animation: gradientFlow 8s ease infinite;
        }

        @keyframes gradientFlow {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        /* Responsive adjustments for upgrade card */
        @media (max-width: 768px) {
          .upgrade-card {
            margin: 1rem;
          }
        }

        @media (max-width: 640px) {
          .upgrade-card {
            padding: 1rem;
          }
        }

        /* Hover effects for feature items */
        .hover\:bg-white\/80:hover {
          backdrop-filter: blur(8px);
          transform: translateX(4px);
        }

        /* Button animation */
        .group:hover .transform {
          transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        }

        .group:hover .opacity-0 {
          opacity: 1;
        }

        .transition-opacity {
          transition: opacity 0.2s ease-in-out;
        }

        .group:hover .opacity-0 {
          opacity: 1;
        }

        .transition-opacity {
          transition: opacity 0.2s ease-in-out;
        }
      `}</style>
    </div>
  )
}

